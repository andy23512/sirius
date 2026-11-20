import { TestBed } from '@angular/core/testing';
import {
  CHINESE_KEYBOARD_LAYOUTS,
  KEYBOARD_LAYOUTS_FROM_KBDLAYOUT,
  KEYBOARD_LAYOUTS_FROM_XKEYBOARD,
} from 'tangent-cc-lib';
import { KeyboardLayoutService } from './keyboard-layout.service';

const KEY = 'sirius.keyboardLayout.selectedId';

describe('KeyboardLayoutService', () => {
  beforeEach(() => localStorage.clear());
  afterAll(() => localStorage.clear());

  function create(): KeyboardLayoutService {
    TestBed.resetTestingModule();
    const service = TestBed.inject(KeyboardLayoutService);
    TestBed.tick();
    return service;
  }

  it('lists the Windows, Linux and Chinese layouts, in that order', () => {
    const service = create();
    expect(service.entities).toEqual([
      ...KEYBOARD_LAYOUTS_FROM_KBDLAYOUT,
      ...KEYBOARD_LAYOUTS_FROM_XKEYBOARD,
      ...CHINESE_KEYBOARD_LAYOUTS,
    ]);
  });

  it('starts with the US layout, and says so', () => {
    const service = create();
    expect(service.defaultId).toBe('us');
    expect(service.selectedId()).toBe('us');
    expect(service.selectedEntity()?.id).toBe('us');
    expect(localStorage.getItem(KEY)).toBe('us');
  });

  it('starts with the layout that was saved', () => {
    const id = create().entities[5].id;
    localStorage.setItem(KEY, id);
    const service = create();
    expect(service.selectedId()).toBe(id);
    expect(service.selectedEntity()?.id).toBe(id);
  });

  it('saves the layout it is changed to', () => {
    const service = create();
    const other = service.entities.find((k) => k.id !== 'us')!;
    service.setSelectedId(other.id);
    TestBed.tick();
    expect(service.selectedEntity()).toBe(other);
    expect(localStorage.getItem(KEY)).toBe(other.id);
  });

  it('goes back to US when reset', () => {
    const service = create();
    service.setSelectedId(service.entities.find((k) => k.id !== 'us')!.id);
    service.reset();
    TestBed.tick();
    expect(service.selectedId()).toBe('us');
    expect(localStorage.getItem(KEY)).toBe('us');
  });

  // Current behavior: a saved id that is no longer in the list is kept, and
  // the selected layout is null until another one is picked.
  it('has no selected layout for an unknown id, and keeps the id', () => {
    localStorage.setItem(KEY, 'no-such-layout');
    const service = create();
    expect(service.selectedId()).toBe('no-such-layout');
    expect(service.selectedEntity()).toBeNull();
    expect(service.hasDeadKey()).toBeFalse();
  });

  describe('hasDeadKey', () => {
    it('is false for US, which has none', () => {
      expect(create().hasDeadKey()).toBeFalse();
    });

    it('is true for a layout that has a dead key, and follows the selection', () => {
      const service = create();
      const withDead = service.entities.find((k) =>
        Object.values(k.layout).some((key) =>
          Object.values(key ?? {}).some((o) => o?.type === 'dead-key'),
        ),
      )!;
      expect(withDead).toBeDefined();
      service.setSelectedId(withDead.id);
      expect(service.hasDeadKey()).toBeTrue();
      service.reset();
      expect(service.hasDeadKey()).toBeFalse();
    });
  });
});
