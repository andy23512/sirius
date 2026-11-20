import { TestBed } from '@angular/core/testing';
import { GlobalKeyEvent, SiriusApi } from './global-key';
import { GlobalKeyService } from './global-key.service';

function bridgeEvent(over: Partial<GlobalKeyEvent> = {}): GlobalKeyEvent {
  return {
    type: 'keydown',
    keycode: 30,
    key: 'A',
    code: 'KeyA',
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    time: 1000,
    ...over,
  };
}

function dom(type: 'keydown' | 'keyup', init: KeyboardEventInit = {}): void {
  window.dispatchEvent(new KeyboardEvent(type, { code: 'KeyA', ...init }));
}

describe('GlobalKeyService', () => {
  afterEach(() => {
    delete window.sirius;
  });

  describe('in a plain browser', () => {
    let service: GlobalKeyService;
    beforeEach(() => {
      delete window.sirius;
      service = TestBed.inject(GlobalKeyService);
    });

    it('is not connected, but input is available', () => {
      expect(service.connected()).toBeFalse();
      expect(service.available()).toBeTrue();
    });

    it('starts empty', () => {
      expect(service.events()).toEqual([]);
      expect(service.pressedCodes().size).toBe(0);
      expect(service.lastKeyDown()).toBeNull();
    });

    it('logs a key press from the window, with the fields copied over', () => {
      dom('keydown', {
        code: 'KeyA',
        keyCode: 65,
        shiftKey: true,
        ctrlKey: true,
        altKey: true,
        metaKey: true,
      });
      const [event] = service.events();
      expect(event.type).toBe('keydown');
      expect(event.keycode).toBe(65);
      expect(event.key).toBe('KeyA');
      expect(event.code).toBe('KeyA');
      expect(event.shiftKey).toBeTrue();
      expect(event.ctrlKey).toBeTrue();
      expect(event.altKey).toBeTrue();
      expect(event.metaKey).toBeTrue();
      expect(typeof event.time).toBe('number');
    });

    it('logs the modifiers as false when they are not held', () => {
      dom('keydown');
      const [event] = service.events();
      expect([event.shiftKey, event.ctrlKey, event.altKey, event.metaKey]).toEqual([
        false,
        false,
        false,
        false,
      ]);
    });

    it('holds a code from keydown until keyup', () => {
      dom('keydown', { code: 'KeyA' });
      dom('keydown', { code: 'ShiftLeft' });
      expect([...service.pressedCodes()].sort()).toEqual(['KeyA', 'ShiftLeft']);
      dom('keyup', { code: 'KeyA' });
      expect([...service.pressedCodes()]).toEqual(['ShiftLeft']);
    });

    it('logs key releases too', () => {
      dom('keydown');
      dom('keyup');
      expect(service.events().map((e) => e.type)).toEqual(['keyup', 'keydown']);
    });

    it('ignores auto-repeat', () => {
      dom('keydown', { repeat: false });
      dom('keydown', { repeat: true });
      dom('keydown', { repeat: true });
      expect(service.events().length).toBe(1);
      expect(service.lastKeyDown()?.seq).toBe(1);
    });

    it('puts the newest event first', () => {
      dom('keydown', { code: 'KeyA' });
      dom('keydown', { code: 'KeyB' });
      dom('keydown', { code: 'KeyC' });
      expect(service.events().map((e) => e.code)).toEqual(['KeyC', 'KeyB', 'KeyA']);
    });

    it('numbers the key presses, so the same key twice is still a new press', () => {
      dom('keydown', { code: 'KeyA' });
      expect(service.lastKeyDown()).toEqual({ code: 'KeyA', seq: 1 });
      dom('keyup', { code: 'KeyA' });
      dom('keydown', { code: 'KeyA' });
      expect(service.lastKeyDown()).toEqual({ code: 'KeyA', seq: 2 });
      dom('keydown', { code: 'KeyB' });
      expect(service.lastKeyDown()).toEqual({ code: 'KeyB', seq: 3 });
    });

    it('does not count a key release as a press', () => {
      dom('keydown', { code: 'KeyA' });
      dom('keyup', { code: 'KeyA' });
      expect(service.lastKeyDown()).toEqual({ code: 'KeyA', seq: 1 });
    });

    it('keeps only the latest 300 events', () => {
      for (let i = 0; i < 305; i += 1) {
        dom('keydown', { code: `Key${i}` });
      }
      const events = service.events();
      expect(events.length).toBe(300);
      expect(events[0].code).toBe('Key304');
      expect(events[299].code).toBe('Key5');
    });

    it('keeps 300 events as they are', () => {
      for (let i = 0; i < 300; i += 1) {
        dom('keydown', { code: `Key${i}` });
      }
      expect(service.events().length).toBe(300);
      expect(service.events()[299].code).toBe('Key0');
    });

    it('clears the log, but not the keys that are held', () => {
      dom('keydown', { code: 'KeyA' });
      service.clear();
      expect(service.events()).toEqual([]);
      expect(service.pressedCodes().has('KeyA')).toBeTrue();
    });

    // Current behavior: a key release for a key that was never pressed (for
    // example after the window regained focus) is logged and changes nothing.
    it('logs a release of a key that was not held', () => {
      dom('keyup', { code: 'KeyZ' });
      expect(service.events().length).toBe(1);
      expect(service.pressedCodes().size).toBe(0);
    });
  });

  describe('with the Electron bridge', () => {
    let send: (event: GlobalKeyEvent) => void;
    let service: GlobalKeyService;
    let onKey: jasmine.Spy;

    beforeEach(() => {
      onKey = jasmine.createSpy('onKey').and.callFake((cb: (e: GlobalKeyEvent) => void) => {
        send = cb;
        return () => undefined;
      });
      window.sirius = { onKey } as unknown as SiriusApi;
      service = TestBed.inject(GlobalKeyService);
    });

    it('is connected and subscribes once', () => {
      expect(service.connected()).toBeTrue();
      expect(onKey).toHaveBeenCalledTimes(1);
    });

    it('logs what the main process sends, as it is', () => {
      const event = bridgeEvent({ key: 'Space', code: 'Space', keycode: 57 });
      send(event);
      expect(service.events()).toEqual([event]);
    });

    it('holds and releases codes', () => {
      send(bridgeEvent({ code: 'KeyA' }));
      send(bridgeEvent({ code: 'KeyB' }));
      send(bridgeEvent({ type: 'keyup', code: 'KeyA' }));
      expect([...service.pressedCodes()]).toEqual(['KeyB']);
    });

    it('numbers the key presses', () => {
      send(bridgeEvent({ code: 'KeyA' }));
      send(bridgeEvent({ code: 'KeyA' }));
      expect(service.lastKeyDown()).toEqual({ code: 'KeyA', seq: 2 });
    });

    it('logs a key with no DOM code, but does not hold it or count it', () => {
      send(bridgeEvent({ code: null, key: 'Unknown', keycode: 999 }));
      expect(service.events().length).toBe(1);
      expect(service.pressedCodes().size).toBe(0);
      expect(service.lastKeyDown()).toBeNull();
    });

    it('does not listen to the window as well', () => {
      dom('keydown', { code: 'KeyQ' });
      expect(service.events()).toEqual([]);
    });

    it('keeps only the latest 300 events', () => {
      for (let i = 0; i < 301; i += 1) {
        send(bridgeEvent({ code: `Key${i}` }));
      }
      expect(service.events().length).toBe(300);
      expect(service.events()[0].code).toBe('Key300');
    });
  });
});
