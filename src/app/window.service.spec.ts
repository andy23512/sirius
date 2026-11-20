import { TestBed } from '@angular/core/testing';
import { SiriusApi, WindowControls, WindowState } from './global-key';
import { WindowService } from './window.service';

interface Fake {
  controls: jasmine.SpyObj<WindowControls>;
  state: (s: WindowState) => void;
  openSettings: () => void;
  resolveState: (s: WindowState) => void;
}

function installControls(): Fake {
  let state!: (s: WindowState) => void;
  let openSettings!: () => void;
  let resolveState!: (s: WindowState) => void;
  const controls = jasmine.createSpyObj<WindowControls>('controls', [
    'getState',
    'setFramed',
    'setAlwaysOnTop',
    'setPassthrough',
    'setInteractive',
    'moveBy',
    'minimize',
    'close',
    'onState',
    'onOpenSettings',
  ]);
  controls.getState.and.returnValue(new Promise<WindowState>((r) => (resolveState = r)));
  controls.onState.and.callFake((cb) => {
    state = cb;
    return () => undefined;
  });
  controls.onOpenSettings.and.callFake((cb) => {
    openSettings = cb;
    return () => undefined;
  });
  window.sirius = { onKey: () => () => undefined, windowControls: controls } as SiriusApi;
  return {
    controls,
    state: (s) => state(s),
    openSettings: () => openSettings(),
    resolveState: (s) => resolveState(s),
  };
}

const flush = () => new Promise((r) => setTimeout(r));

describe('WindowService', () => {
  afterEach(() => {
    delete window.sirius;
  });

  describe('in a plain browser', () => {
    let service: WindowService;
    beforeEach(() => {
      delete window.sirius;
      service = TestBed.inject(WindowService);
    });

    it('says window effects are not available, and starts with everything off', () => {
      expect(service.available()).toBeFalse();
      expect(service.framed()).toBeFalse();
      expect(service.alwaysOnTop()).toBeFalse();
      expect(service.passthrough()).toBeFalse();
      expect(service.settingsRequested()).toBe(0);
    });

    it('still flips the toggles, so the look can be previewed', () => {
      service.toggleAlwaysOnTop();
      expect(service.alwaysOnTop()).toBeTrue();
      service.toggleAlwaysOnTop();
      expect(service.alwaysOnTop()).toBeFalse();
      service.togglePassthrough();
      expect(service.passthrough()).toBeTrue();
      service.toggleFramed();
      expect(service.framed()).toBeTrue();
    });

    it('does nothing for the window commands, without an error', () => {
      expect(() => {
        service.setInteractive(true);
        service.moveBy(1, 2);
        service.minimize();
        service.close();
      }).not.toThrow();
    });

    describe('the shortcut for leaving passthrough', () => {
      const press = (init: KeyboardEventInit): KeyboardEvent => {
        const event = new KeyboardEvent('keydown', { cancelable: true, ...init });
        window.dispatchEvent(event);
        return event;
      };

      it('toggles it with Ctrl+Shift+O, and stops the browser from acting on the key', () => {
        const event = press({ ctrlKey: true, shiftKey: true, code: 'KeyO' });
        expect(service.passthrough()).toBeTrue();
        expect(event.defaultPrevented).toBeTrue();
        press({ ctrlKey: true, shiftKey: true, code: 'KeyO' });
        expect(service.passthrough()).toBeFalse();
      });

      it('also takes Cmd+Shift+O', () => {
        press({ metaKey: true, shiftKey: true, code: 'KeyO' });
        expect(service.passthrough()).toBeTrue();
      });

      it('needs Shift', () => {
        const event = press({ ctrlKey: true, code: 'KeyO' });
        expect(service.passthrough()).toBeFalse();
        expect(event.defaultPrevented).toBeFalse();
      });

      it('needs Ctrl or Cmd', () => {
        press({ shiftKey: true, code: 'KeyO' });
        expect(service.passthrough()).toBeFalse();
      });

      it('needs the O key', () => {
        press({ ctrlKey: true, shiftKey: true, code: 'KeyP' });
        expect(service.passthrough()).toBeFalse();
      });
    });
  });

  describe('with the Electron bridge', () => {
    let fake: Fake;
    let service: WindowService;
    beforeEach(() => {
      fake = installControls();
      service = TestBed.inject(WindowService);
    });

    it('says window effects are available', () => {
      expect(service.available()).toBeTrue();
    });

    it('takes the state the main process has once it answers', async () => {
      fake.resolveState({ framed: true, alwaysOnTop: true, passthrough: false });
      await flush();
      expect(service.framed()).toBeTrue();
      expect(service.alwaysOnTop()).toBeTrue();
      expect(service.passthrough()).toBeFalse();
    });

    it('follows state changes from the main process', () => {
      fake.state({ framed: false, alwaysOnTop: false, passthrough: true });
      expect(service.passthrough()).toBeTrue();
      expect(service.framed()).toBeFalse();
      fake.state({ framed: true, alwaysOnTop: true, passthrough: false });
      expect(service.framed()).toBeTrue();
      expect(service.alwaysOnTop()).toBeTrue();
      expect(service.passthrough()).toBeFalse();
    });

    it('counts each request from the tray menu to open settings', () => {
      fake.openSettings();
      expect(service.settingsRequested()).toBe(1);
      fake.openSettings();
      expect(service.settingsRequested()).toBe(2);
    });

    it('tells the main process what each toggle becomes', () => {
      service.toggleAlwaysOnTop();
      expect(fake.controls.setAlwaysOnTop).toHaveBeenCalledOnceWith(true);
      service.toggleAlwaysOnTop();
      expect(fake.controls.setAlwaysOnTop).toHaveBeenCalledWith(false);
      service.togglePassthrough();
      expect(fake.controls.setPassthrough).toHaveBeenCalledOnceWith(true);
      service.toggleFramed();
      expect(fake.controls.setFramed).toHaveBeenCalledOnceWith(true);
    });

    it('turns passthrough off when the window gets a frame, since a framed window cannot be one', () => {
      service.togglePassthrough();
      expect(service.passthrough()).toBeTrue();
      service.toggleFramed();
      expect(service.framed()).toBeTrue();
      expect(service.passthrough()).toBeFalse();
    });

    // Current behavior: only the local state is reset; the main process is
    // not told, so it learns about it from its own state report.
    it('does not send a passthrough change when the frame turns it off', () => {
      service.togglePassthrough();
      fake.controls.setPassthrough.calls.reset();
      service.toggleFramed();
      expect(fake.controls.setPassthrough).not.toHaveBeenCalled();
    });

    it('leaves passthrough alone when the frame is taken off', () => {
      service.toggleFramed();
      service.togglePassthrough();
      service.toggleFramed();
      expect(service.framed()).toBeFalse();
      expect(service.passthrough()).toBeTrue();
    });

    it('passes on the window commands', () => {
      service.setInteractive(true);
      service.moveBy(3, -4);
      service.minimize();
      service.close();
      expect(fake.controls.setInteractive).toHaveBeenCalledOnceWith(true);
      expect(fake.controls.moveBy).toHaveBeenCalledOnceWith(3, -4);
      expect(fake.controls.minimize).toHaveBeenCalledTimes(1);
      expect(fake.controls.close).toHaveBeenCalledTimes(1);
    });

    it('does not listen for the browser shortcut', () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { ctrlKey: true, shiftKey: true, code: 'KeyO' }),
      );
      expect(service.passthrough()).toBeFalse();
      expect(fake.controls.setPassthrough).not.toHaveBeenCalled();
    });
  });
});
