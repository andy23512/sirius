import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DeviceLayoutService } from '../layout-viewer/device-layout.service';
import { KeyboardLayoutService } from '../layout-viewer/keyboard-layout.service';
import { ViewSettingsService } from '../layout-viewer/view-settings.service';
import { SettingsDialogComponent } from './settings-dialog.component';

const flush = () => new Promise((r) => setTimeout(r, 20));

describe('SettingsDialogComponent', () => {
  let fixture: ComponentFixture<SettingsDialogComponent>;
  let component: SettingsDialogComponent;
  let closed: jasmine.Spy;

  beforeEach(async () => {
    localStorage.clear();
    fixture = TestBed.createComponent(SettingsDialogComponent);
    component = fixture.componentInstance;
    closed = jasmine.createSpy('closed');
    component.closed.subscribe(closed);
    fixture.detectChanges();
    // ngModel writes its first value asynchronously.
    await fixture.whenStable();
    fixture.detectChanges();
  });
  afterAll(() => localStorage.clear());

  const root = () => fixture.nativeElement as HTMLElement;
  const selects = () => Array.from(root().querySelectorAll('select'));
  const deviceSelect = () => selects()[0];
  const keyboardSelect = () => selects()[1];
  const optionTexts = (s: HTMLSelectElement) =>
    Array.from(s.options).map((o) => o.textContent!.trim());
  const search = () => root().querySelector('input[type=search]') as HTMLInputElement;
  const resetButton = () =>
    root().querySelector('button[title="Reset to US"]') as HTMLButtonElement;
  const toggle = () => root().querySelector('button.toggle') as HTMLButtonElement;
  const fileInput = () => root().querySelector('input[type=file]') as HTMLInputElement;
  const error = () => root().querySelector('.field__error');

  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function type(value: string) {
    search().value = value;
    search().dispatchEvent(new Event('input'));
    await settle();
  }

  async function choose(select: HTMLSelectElement, index: number) {
    select.selectedIndex = index;
    select.dispatchEvent(new Event('change'));
    await flush();
    await settle();
  }

  async function upload(name: string, text: string) {
    const data = new DataTransfer();
    data.items.add(new File([text], name, { type: 'application/json' }));
    fileInput().files = data.files;
    fileInput().dispatchEvent(new Event('change'));
    await flush();
    await settle();
  }

  const layerOf = (n: number, len = 90) => Array.from({ length: n }, () => new Array(len).fill(0));

  describe('closing', () => {
    it('closes from the close button', () => {
      (root().querySelector('button[aria-label=Close]') as HTMLButtonElement).click();
      expect(closed).toHaveBeenCalledTimes(1);
    });

    it('closes when the backdrop is clicked', () => {
      (root().querySelector('.backdrop') as HTMLElement).click();
      expect(closed).toHaveBeenCalledTimes(1);
    });

    it('closes on Escape, anywhere on the page', () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(closed).toHaveBeenCalledTimes(1);
    });

    it('does not close on other keys, or on a click inside the dialog', () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      (root().querySelector('.dialog') as HTMLElement).click();
      expect(closed).not.toHaveBeenCalled();
    });

    it('is a dialog with a label', () => {
      const dialog = root().querySelector('[role=dialog]')!;
      expect(dialog.getAttribute('aria-label')).toBe('Settings');
    });
  });

  describe('device layout', () => {
    it('lists the built-in layouts, with the selected one chosen', () => {
      expect(optionTexts(deviceSelect())).toEqual(
        TestBed.inject(DeviceLayoutService)
          .entities()
          .map((d) => d.name),
      );
      expect(deviceSelect().options.length).toBe(5);
      expect(deviceSelect().selectedIndex).toBe(0);
    });

    it('changes the selected layout', async () => {
      await choose(deviceSelect(), 4);
      expect(TestBed.inject(DeviceLayoutService).selectedId()).toBe('cclite-default');
      expect(deviceSelect().selectedIndex).toBe(4);
    });

    it('shows a change made somewhere else', async () => {
      TestBed.inject(DeviceLayoutService).setSelectedId('m4g-default');
      await settle();
      expect(deviceSelect().selectedIndex).toBe(1);
    });
  });

  describe('uploading a device layout', () => {
    it('adds the layout, selects it, and lists it', async () => {
      await upload('mine.json', JSON.stringify({ layout: layerOf(3) }));
      const service = TestBed.inject(DeviceLayoutService);
      expect(service.entities().length).toBe(6);
      expect(service.selectedEntity()?.name).toBe('mine');
      expect(optionTexts(deviceSelect())).toContain('mine');
      expect(error()).toBeNull();
    });

    it('shows the reason when the file is not a layout, and adds nothing', async () => {
      await upload('bad.json', '{"layout": []}');
      expect(error()!.textContent!.trim()).toBe('Expected 3 or 4 layers, found 0.');
      expect(TestBed.inject(DeviceLayoutService).entities().length).toBe(5);
    });

    it('shows when the file is not JSON', async () => {
      await upload('bad.json', 'hello');
      expect(error()!.textContent!.trim()).toBe('File is not valid JSON.');
    });

    it('clears the message when the next file is fine', async () => {
      await upload('bad.json', 'hello');
      await upload('good.json', JSON.stringify({ layout: layerOf(4, 67) }));
      expect(error()).toBeNull();
    });

    it('clears the file box, so the same file can be chosen again', async () => {
      const data = new DataTransfer();
      data.items.add(new File(['x'], 'x.json'));
      fileInput().files = data.files;
      fileInput().dispatchEvent(new Event('change'));
      await flush();
      expect(fileInput().value).toBe('');
    });

    it('does nothing, and clears an old message, when no file was chosen', async () => {
      await upload('bad.json', 'hello');
      expect(error()).not.toBeNull();
      fileInput().dispatchEvent(new Event('change'));
      await flush();
      await settle();
      expect(error()).toBeNull();
      expect(TestBed.inject(DeviceLayoutService).entities().length).toBe(5);
    });

    it('takes only the first file', async () => {
      const data = new DataTransfer();
      data.items.add(new File([JSON.stringify({ layout: layerOf(3) })], 'first.json'));
      data.items.add(new File([JSON.stringify({ layout: layerOf(3) })], 'second.json'));
      fileInput().files = data.files;
      fileInput().dispatchEvent(new Event('change'));
      await flush();
      expect(
        TestBed.inject(DeviceLayoutService)
          .entities()
          .map((d) => d.name),
      ).toContain('first');
      expect(
        TestBed.inject(DeviceLayoutService)
          .entities()
          .map((d) => d.name),
      ).not.toContain('second');
    });

    it('only offers JSON files', () => {
      expect(fileInput().accept).toBe('application/json,.json');
    });
  });

  describe('OS keyboard layout', () => {
    it('lists all layouts, with US chosen', () => {
      const service = TestBed.inject(KeyboardLayoutService);
      expect(keyboardSelect().options.length).toBe(service.entities.length);
      expect(service.selectedId()).toBe('us');
    });

    it('changes the layout', async () => {
      await choose(keyboardSelect(), 3);
      const service = TestBed.inject(KeyboardLayoutService);
      expect(service.selectedId()).toBe(service.entities[3].id);
    });

    describe('search', () => {
      it('keeps the names that contain the text, in any case', async () => {
        const first = TestBed.inject(KeyboardLayoutService).entities.find((k) =>
          /[a-z]/i.test(k.name),
        )!;
        const word = first.name.slice(0, 3).toUpperCase();
        await type(word);
        const expected = TestBed.inject(KeyboardLayoutService)
          .entities.filter((k) => k.name.toLowerCase().includes(word.toLowerCase()))
          .map((k) => k.name);
        expect(optionTexts(keyboardSelect())).toEqual(expected);
        expect(expected.length).toBeGreaterThan(0);
      });

      it('ignores spaces around the text', async () => {
        await type('german');
        const plain = optionTexts(keyboardSelect());
        await type('  German  ');
        expect(optionTexts(keyboardSelect())).toEqual(plain);
        expect(plain.length).toBeGreaterThan(0);
      });

      it('shows everything again when cleared, or when only spaces', async () => {
        const all = TestBed.inject(KeyboardLayoutService).entities.length;
        await type('german');
        expect(keyboardSelect().options.length).toBeLessThan(all);
        await type('   ');
        expect(keyboardSelect().options.length).toBe(all);
        await type('german');
        await type('');
        expect(keyboardSelect().options.length).toBe(all);
      });

      it('shows an empty list when nothing matches', async () => {
        await type('zzzzzzzz-no-such-layout');
        expect(keyboardSelect().options.length).toBe(0);
      });

      it('matches by name and not by id', async () => {
        const service = TestBed.inject(KeyboardLayoutService);
        const odd = service.entities.find(
          (k) => !k.name.toLowerCase().includes(k.id.toLowerCase()),
        );
        if (!odd) {
          pending('every layout name contains its id');
          return;
        }
        await type(odd.id);
        expect(optionTexts(keyboardSelect())).not.toContain(odd.name);
      });
    });

    describe('reset', () => {
      it('is disabled while US is chosen', () => {
        expect(resetButton().disabled).toBeTrue();
      });

      it('is enabled for another layout, and goes back to US', async () => {
        const service = TestBed.inject(KeyboardLayoutService);
        service.setSelectedId(service.entities.find((k) => k.id !== 'us')!.id);
        await settle();
        expect(resetButton().disabled).toBeFalse();
        resetButton().click();
        await settle();
        expect(service.selectedId()).toBe('us');
        expect(resetButton().disabled).toBeTrue();
      });
    });

    describe('reference link', () => {
      const link = () =>
        root().querySelector('a[title="Open layout reference"]') as HTMLAnchorElement | null;

      it('opens the reference of the chosen layout in a new tab, safely', async () => {
        const service = TestBed.inject(KeyboardLayoutService);
        const withRef = service.entities.find((k) => k.reference)!;
        service.setSelectedId(withRef.id);
        await settle();
        expect(link()).not.toBeNull();
        expect(link()!.getAttribute('href')).toBe(withRef.reference);
        expect(link()!.target).toBe('_blank');
        expect(link()!.rel).toBe('noopener noreferrer');
      });

      it('is not shown when the layout has none', async () => {
        const service = TestBed.inject(KeyboardLayoutService);
        const without = service.entities.find((k) => !k.reference);
        if (!without) {
          pending('every layout has a reference');
          return;
        }
        service.setSelectedId(without.id);
        await settle();
        expect(link()).toBeNull();
      });

      it('is not shown when the saved layout is unknown', async () => {
        TestBed.inject(KeyboardLayoutService).setSelectedId('no-such-layout');
        await settle();
        expect(link()).toBeNull();
      });
    });
  });

  describe('3rd thumb switch', () => {
    it('says On at first', () => {
      expect(toggle().textContent!.trim()).toBe('On');
      expect(toggle().classList).toContain('toggle--active');
    });

    it('flips to Off and back', async () => {
      toggle().click();
      await settle();
      expect(toggle().textContent!.trim()).toBe('Off');
      expect(toggle().classList).not.toContain('toggle--active');
      expect(TestBed.inject(ViewSettingsService).showThumb3Switch()).toBeFalse();
      toggle().click();
      await settle();
      expect(toggle().textContent!.trim()).toBe('On');
    });
  });
});
