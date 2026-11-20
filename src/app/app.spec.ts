import { ComponentFixture, TestBed } from '@angular/core/testing';
import { App } from './app';
import {
  AccessibilityApi,
  AccessibilityStatus,
  GlobalKeyEvent,
  SiriusApi,
  WindowControls,
  WindowState,
} from './global-key';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the app title', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Sirius');
  });
});

// --- behavior -----------------------------------------------------------------

const flush = () => new Promise((r) => setTimeout(r, 10));

describe('App in a plain browser', () => {
  let fixture: ComponentFixture<App>;

  beforeEach(async () => {
    delete window.sirius;
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
    fixture = TestBed.createComponent(App);
    fixture.detectChanges();
  });
  afterAll(() => localStorage.clear());

  const root = () => fixture.nativeElement as HTMLElement;
  const q = (selector: string) => root().querySelector<HTMLElement>(selector);
  const button = (label: string) => q(`button[aria-label="${label}"]`) as HTMLButtonElement | null;
  const press = (type: 'keydown' | 'keyup', init: KeyboardEventInit = {}) => {
    window.dispatchEvent(new KeyboardEvent(type, { code: 'KeyA', key: 'a', ...init }));
    fixture.detectChanges();
  };

  describe('header', () => {
    it('has a title and a subtitle', () => {
      expect(q('h1')!.textContent).toBe('Sirius');
      expect(q('.app__subtitle')!.textContent).toContain('layout viewer');
    });

    it('has only the settings button, since a browser cannot control its window', () => {
      expect(button('Settings')).not.toBeNull();
      for (const label of [
        'Pin to front',
        'Passthrough overlay',
        'Toggle window frame',
        'Minimize',
        'Close',
      ]) {
        expect(button(label)).withContext(label).toBeNull();
      }
    });
  });

  describe('trial banner', () => {
    it('tells that keys are only seen in this tab, and links to the download', () => {
      const banner = q('.trial')!;
      expect(banner.textContent).toContain('Browser trial');
      const link = banner.querySelector('a')!;
      expect(link.getAttribute('href')).toBe('https://github.com/andy23512/sirius/releases/latest');
      expect(link.target).toBe('_blank');
      expect(link.rel).toBe('noopener');
    });

    it('has no accessibility banner', () => {
      expect(q('.a11y')).toBeNull();
    });
  });

  describe('key tester', () => {
    it('is empty at first, with a count of 0 and Clear off', () => {
      expect(q('.keylog__count')!.textContent).toBe('(0)');
      expect(q('.keylog__count--off')!.textContent).toContain('local keys only');
      expect(q('.keylog .empty')!.textContent).toContain('Press any key');
      expect((q('.keylog__toolbar button') as HTMLButtonElement).disabled).toBeTrue();
      expect(q('.log')).toBeNull();
    });

    it('has a row for each key event, the newest first', () => {
      press('keydown', { code: 'KeyA', key: 'a' });
      press('keydown', { code: 'KeyB', key: 'b' });
      const rows = Array.from(root().querySelectorAll('.log__row'));
      expect(rows.length).toBe(2);
      expect(rows[0].querySelector('.code')!.textContent).toBe('KeyB');
      expect(rows[1].querySelector('.code')!.textContent).toBe('KeyA');
      expect(q('.keylog__count')!.textContent).toBe('(2)');
    });

    it('shows the type, the key, and the code of a row', () => {
      press('keydown', { code: 'KeyA', key: 'a' });
      const row = q('.log__row')!;
      expect(row.querySelector('.tag')!.textContent).toBe('keydown');
      expect(row.querySelector('.key')!.textContent).toBe('KeyA');
      expect(row.querySelector('.code')!.textContent).toBe('KeyA');
    });

    it('marks a key release in a different style', () => {
      press('keydown');
      press('keyup');
      const [up, down] = Array.from(root().querySelectorAll('.log__row'));
      expect(up.classList).toContain('log__row--up');
      expect(up.querySelector('.tag')!.classList).toContain('tag--up');
      expect(down.classList).not.toContain('log__row--up');
      expect(down.querySelector('.tag')!.classList).not.toContain('tag--up');
    });

    it('lists the modifiers held, in the order Ctrl, Alt, Shift, Meta', () => {
      press('keydown', { ctrlKey: true, altKey: true, shiftKey: true, metaKey: true });
      expect(q('.mods')!.textContent).toBe('Ctrl + Alt + Shift + Meta');
    });

    it('lists only those held, and has no list for none', () => {
      press('keydown', { shiftKey: true, ctrlKey: true });
      expect(q('.mods')!.textContent).toBe('Ctrl + Shift');
      press('keydown', { code: 'KeyB' });
      expect(root().querySelectorAll('.mods').length).toBe(1);
    });

    it('clears the list when Clear is pressed, then turns Clear off again', () => {
      press('keydown');
      const clear = q('.keylog__toolbar button') as HTMLButtonElement;
      expect(clear.disabled).toBeFalse();
      clear.click();
      fixture.detectChanges();
      expect(q('.log')).toBeNull();
      expect(q('.keylog .empty')).not.toBeNull();
      expect(q('.keylog__count')!.textContent).toBe('(0)');
      expect(clear.disabled).toBeTrue();
    });
  });

  describe('settings', () => {
    const open = () => {
      button('Settings')!.click();
      fixture.detectChanges();
    };

    it('is closed at first, opens from the button, and closes when asked', async () => {
      expect(q('app-settings-dialog')).toBeNull();
      open();
      expect(q('app-settings-dialog')).not.toBeNull();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();
      expect(q('app-settings-dialog')).toBeNull();
    });

    it('closes from the backdrop', () => {
      open();
      q('.backdrop')!.click();
      fixture.detectChanges();
      expect(q('app-settings-dialog')).toBeNull();
    });
  });

  describe('the viewer', () => {
    it('is there, and not as an overlay', () => {
      expect(q('app-layout-viewer')).not.toBeNull();
      expect(q('.app')!.classList).not.toContain('app--passthrough');
      expect(q('.toolbar')!.style.visibility).toBe('visible');
      expect(q('.overlay-controls')).toBeNull();
    });

    it('turns into the overlay with Ctrl+Shift+O, and back', () => {
      press('keydown', { ctrlKey: true, shiftKey: true, code: 'KeyO' });
      expect(q('.app')!.classList).toContain('app--passthrough');
      expect(q('.toolbar')!.style.visibility).toBe('hidden');
      expect(q('.overlay-controls')).not.toBeNull();
      press('keydown', { ctrlKey: true, shiftKey: true, code: 'KeyO' });
      expect(q('.app')!.classList).not.toContain('app--passthrough');
      expect(q('.overlay-controls')).toBeNull();
    });

    it('closes settings when the overlay is left from its exit button', () => {
      press('keydown', { ctrlKey: true, shiftKey: true, code: 'KeyO' });
      button('Settings')!.click();
      fixture.detectChanges();
      expect(q('app-settings-dialog')).not.toBeNull();
      button('Exit passthrough')!.click();
      fixture.detectChanges();
      expect(q('app-settings-dialog')).toBeNull();
      expect(q('.overlay-controls')).toBeNull();
    });
  });
});

describe('App in the desktop app', () => {
  let fixture: ComponentFixture<App>;
  let controls: jasmine.SpyObj<WindowControls>;
  let accessibility: jasmine.SpyObj<AccessibilityApi>;
  let pushState: (s: WindowState) => void;
  let pushKey: (e: GlobalKeyEvent) => void;
  let pushStatus: (s: AccessibilityStatus) => void;
  let openSettings: () => void;
  let moveSpy: jasmine.Spy;

  const state = (over: Partial<WindowState> = {}): WindowState => ({
    framed: false,
    alwaysOnTop: false,
    passthrough: false,
    ...over,
  });

  beforeEach(async () => {
    localStorage.clear();
    controls = jasmine.createSpyObj<WindowControls>('controls', [
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
    controls.getState.and.resolveTo(state());
    controls.onState.and.callFake((cb) => {
      pushState = cb;
      return () => undefined;
    });
    controls.onOpenSettings.and.callFake((cb) => {
      openSettings = cb;
      return () => undefined;
    });
    accessibility = jasmine.createSpyObj<AccessibilityApi>('accessibility', [
      'getStatus',
      'openSettings',
      'onStatus',
    ]);
    accessibility.getStatus.and.resolveTo({ needed: false, granted: true });
    accessibility.onStatus.and.callFake((cb) => {
      pushStatus = cb;
      return () => undefined;
    });
    window.sirius = {
      onKey: (cb: (e: GlobalKeyEvent) => void) => {
        pushKey = cb;
        return () => undefined;
      },
      windowControls: controls,
      accessibility,
    } as SiriusApi;
    // A synthetic pointer has no real id, so capturing it would fail.
    moveSpy = spyOn(HTMLElement.prototype, 'setPointerCapture').and.stub();
    spyOn(HTMLElement.prototype, 'releasePointerCapture').and.stub();
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
    fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
  });
  afterEach(() => {
    delete window.sirius;
  });
  afterAll(() => localStorage.clear());

  const root = () => fixture.nativeElement as HTMLElement;
  const q = (selector: string) => root().querySelector<HTMLElement>(selector);
  const button = (label: string) => q(`button[aria-label="${label}"]`) as HTMLButtonElement | null;
  const push = (s: Partial<WindowState>) => {
    pushState(state(s));
    fixture.detectChanges();
  };
  const click = (label: string) => {
    button(label)!.click();
    fixture.detectChanges();
  };

  describe('header', () => {
    it('has the window buttons, and the minimize and close of a frameless window', () => {
      for (const label of [
        'Settings',
        'Pin to front',
        'Passthrough overlay',
        'Toggle window frame',
        'Minimize',
        'Close',
      ]) {
        expect(button(label)).withContext(label).not.toBeNull();
      }
    });

    it('leaves minimize and close to the system when the window has a frame', () => {
      push({ framed: true });
      expect(button('Minimize')).toBeNull();
      expect(button('Close')).toBeNull();
      expect(button('Pin to front')).not.toBeNull();
    });

    it('calls the window for minimize and close', () => {
      click('Minimize');
      click('Close');
      expect(controls.minimize).toHaveBeenCalledTimes(1);
      expect(controls.close).toHaveBeenCalledTimes(1);
    });

    it('toggles pin to front, and shows it as active', () => {
      expect(button('Pin to front')!.classList).not.toContain('tool-btn--active');
      click('Pin to front');
      expect(controls.setAlwaysOnTop).toHaveBeenCalledOnceWith(true);
      expect(button('Pin to front')!.classList).toContain('tool-btn--active');
    });

    it('toggles the window frame, with a title that says what it will do', () => {
      expect(button('Toggle window frame')!.title).toBe('Restore the normal window frame');
      click('Toggle window frame');
      expect(controls.setFramed).toHaveBeenCalledOnceWith(true);
      expect(button('Toggle window frame')!.title).toBe('Switch to frameless overlay window');
      expect(button('Toggle window frame')!.classList).toContain('tool-btn--active');
    });

    it('turns on passthrough, but not for a window with a frame', () => {
      expect(button('Passthrough overlay')!.disabled).toBeFalse();
      click('Passthrough overlay');
      expect(controls.setPassthrough).toHaveBeenCalledOnceWith(true);
      push({ framed: true });
      expect(button('Passthrough overlay')!.disabled).toBeTrue();
    });

    it('follows the window state of the main process', () => {
      push({ framed: true, alwaysOnTop: true, passthrough: false });
      expect(button('Pin to front')!.classList).toContain('tool-btn--active');
      expect(button('Toggle window frame')!.classList).toContain('tool-btn--active');
    });
  });

  describe('banners', () => {
    it('has no trial banner, since keys are captured everywhere', () => {
      expect(q('.trial')).toBeNull();
      expect(q('.keylog__count--off')).toBeNull();
    });

    it('has no accessibility banner when the permission is fine', () => {
      expect(q('.a11y')).toBeNull();
    });

    it('asks for the macOS permission, with a button that opens the settings', () => {
      pushStatus({ needed: true, granted: false });
      fixture.detectChanges();
      expect(q('.a11y')!.textContent).toContain('Accessibility');
      (q('.a11y button') as HTMLButtonElement).click();
      expect(accessibility.openSettings).toHaveBeenCalledTimes(1);
    });

    it('takes the banner away once it is granted', () => {
      pushStatus({ needed: true, granted: false });
      fixture.detectChanges();
      pushStatus({ needed: true, granted: true });
      fixture.detectChanges();
      expect(q('.a11y')).toBeNull();
    });
  });

  describe('key tester', () => {
    const event = (over: Partial<GlobalKeyEvent> = {}): GlobalKeyEvent => ({
      type: 'keydown',
      keycode: 30,
      key: 'A',
      code: 'KeyA',
      shiftKey: false,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      time: 1,
      ...over,
    });

    it('lists the keys from the main process', () => {
      pushKey(event({ key: 'Space', code: 'Space' }));
      fixture.detectChanges();
      expect(q('.log__row .key')!.textContent).toBe('Space');
      expect(q('.keylog__count')!.textContent).toBe('(1)');
    });

    it('shows the raw key code for a key with no DOM code', () => {
      pushKey(event({ code: null, keycode: 999 }));
      fixture.detectChanges();
      expect(q('.log__row .code')!.textContent).toBe('code 999');
    });
  });

  describe('settings from the tray', () => {
    it('opens the dialog when the tray menu asks', () => {
      expect(q('app-settings-dialog')).toBeNull();
      openSettings();
      fixture.detectChanges();
      expect(q('app-settings-dialog')).not.toBeNull();
    });

    it('can be closed and opened again by the next request', () => {
      openSettings();
      fixture.detectChanges();
      q('.backdrop')!.click();
      fixture.detectChanges();
      expect(q('app-settings-dialog')).toBeNull();
      openSettings();
      fixture.detectChanges();
      expect(q('app-settings-dialog')).not.toBeNull();
    });
  });

  describe('overlay', () => {
    beforeEach(() => {
      push({ passthrough: true });
    });

    const controlsRect = () => q('.overlay-controls')!.getBoundingClientRect();
    const move = (x: number, y: number) =>
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y }));

    it('shows the drag grip and the exit button', () => {
      expect(q('.app')!.classList).toContain('app--passthrough');
      expect(button('Drag to move')).not.toBeNull();
      expect(button('Exit passthrough')).not.toBeNull();
    });

    it('leaves passthrough from the exit button, and closes settings', () => {
      openSettings();
      fixture.detectChanges();
      expect(q('app-settings-dialog')).not.toBeNull();
      click('Exit passthrough');
      expect(q('app-settings-dialog')).toBeNull();
      expect(controls.setPassthrough).toHaveBeenCalledOnceWith(false);
    });

    describe('letting clicks through', () => {
      it('makes the window usable while the pointer is over the controls', () => {
        const r = controlsRect();
        controls.setInteractive.calls.reset();
        move(r.left + r.width / 2, r.top + r.height / 2);
        expect(controls.setInteractive).toHaveBeenCalledOnceWith(true);
      });

      it('only tells the window when that changes', () => {
        const r = controlsRect();
        controls.setInteractive.calls.reset();
        move(r.left + 1, r.top + 1);
        move(r.left + 2, r.top + 2);
        move(r.left + 3, r.top + 3);
        expect(controls.setInteractive).toHaveBeenCalledTimes(1);
      });

      it('gives it back when the pointer goes away', () => {
        const r = controlsRect();
        controls.setInteractive.calls.reset();
        move(r.left + 1, r.top + 1);
        move(r.left - 100, r.top - 100);
        expect(controls.setInteractive.calls.allArgs()).toEqual([[true], [false]]);
      });

      it('does nothing while the pointer was never over the controls', () => {
        const r = controlsRect();
        controls.setInteractive.calls.reset();
        move(r.left - 100, r.top - 100);
        expect(controls.setInteractive).not.toHaveBeenCalled();
      });

      it('counts 8 pixels around the controls as over them, and not more', () => {
        const r = controlsRect();
        controls.setInteractive.calls.reset();
        move(r.left - 8, r.top - 8);
        expect(controls.setInteractive).toHaveBeenCalledOnceWith(true);
        move(r.left - 9, r.top - 8);
        expect(controls.setInteractive).toHaveBeenCalledWith(false);
        controls.setInteractive.calls.reset();
        move(r.right + 8, r.bottom + 8);
        expect(controls.setInteractive).toHaveBeenCalledOnceWith(true);
        move(r.right + 8, r.bottom + 9);
        expect(controls.setInteractive).toHaveBeenCalledWith(false);
      });

      it('stops listening and gives the window back when passthrough ends', () => {
        controls.setInteractive.calls.reset();
        push({ passthrough: false });
        fixture.detectChanges();
        expect(controls.setInteractive).toHaveBeenCalledWith(false);
        controls.setInteractive.calls.reset();
        move(1, 1);
        expect(controls.setInteractive).not.toHaveBeenCalled();
      });
    });

    describe('dragging', () => {
      const pointer = (
        type: string,
        init: PointerEventInit & { movementX?: number; movementY?: number } = {},
      ) => new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, ...init });
      const grip = () => button('Drag to move')!;

      it('moves the window by how far the pointer moved', () => {
        grip().dispatchEvent(pointer('pointerdown'));
        grip().dispatchEvent(
          pointer('pointermove', { movementX: 5, movementY: -3 } as PointerEventInit),
        );
        expect(controls.moveBy).toHaveBeenCalledOnceWith(5, -3);
      });

      it('moves again for each move', () => {
        grip().dispatchEvent(pointer('pointerdown'));
        grip().dispatchEvent(
          pointer('pointermove', { movementX: 1, movementY: 0 } as PointerEventInit),
        );
        grip().dispatchEvent(
          pointer('pointermove', { movementX: 0, movementY: 2 } as PointerEventInit),
        );
        expect(controls.moveBy.calls.allArgs()).toEqual([
          [1, 0],
          [0, 2],
        ]);
      });

      it('does not move for a move of nothing', () => {
        grip().dispatchEvent(pointer('pointerdown'));
        grip().dispatchEvent(
          pointer('pointermove', { movementX: 0, movementY: 0 } as PointerEventInit),
        );
        expect(controls.moveBy).not.toHaveBeenCalled();
      });

      it('does not move when no drag was started', () => {
        grip().dispatchEvent(
          pointer('pointermove', { movementX: 5, movementY: 5 } as PointerEventInit),
        );
        expect(controls.moveBy).not.toHaveBeenCalled();
      });

      it('stops on pointer up, and on cancel', () => {
        for (const end of ['pointerup', 'pointercancel']) {
          controls.moveBy.calls.reset();
          grip().dispatchEvent(pointer('pointerdown'));
          grip().dispatchEvent(pointer(end));
          grip().dispatchEvent(
            pointer('pointermove', { movementX: 5, movementY: 5 } as PointerEventInit),
          );
          expect(controls.moveBy).withContext(end).not.toHaveBeenCalled();
        }
      });

      it('holds the pointer during the drag, and lets it go after', () => {
        grip().dispatchEvent(pointer('pointerdown', { pointerId: 7 }));
        expect(moveSpy).toHaveBeenCalledWith(7);
        grip().dispatchEvent(pointer('pointerup', { pointerId: 7 }));
        expect(HTMLElement.prototype.releasePointerCapture).toHaveBeenCalledWith(7);
      });

      it('stops the browser from selecting text while dragging', () => {
        const down = pointer('pointerdown');
        grip().dispatchEvent(down);
        expect(down.defaultPrevented).toBeTrue();
      });

      it('keeps the window usable during a drag, even when the pointer is off the controls', () => {
        grip().dispatchEvent(pointer('pointerdown'));
        controls.setInteractive.calls.reset();
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: -500, clientY: -500 }));
        expect(controls.setInteractive).not.toHaveBeenCalled();
      });
    });
  });
});
