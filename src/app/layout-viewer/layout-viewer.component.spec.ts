import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ACTIONS, ActionType, DeviceLayout, Layer } from 'tangent-cc-lib';
import { GlobalKeyService } from '../global-key.service';
import { DeviceLayoutService } from './device-layout.service';
import { KeyboardLayoutService } from './keyboard-layout.service';
import { LayoutComponent } from './layout/layout.component';
import { LayoutViewerComponent } from './layout-viewer.component';
import { ViewSettingsService } from './view-settings.service';

function wsk(keyCode: string): number {
  return ACTIONS.find(
    (a) => a.type === ActionType.WSK && a.keyCode === keyCode && a.withShift === false,
  )!.codeId;
}

/** Layout with KeyA on the primary layer and Digit1 on the secondary layer. */
function fixtureLayout(): DeviceLayout {
  const primary = new Array(90).fill(0);
  const secondary = new Array(90).fill(0);
  const tertiary = new Array(90).fill(0);
  primary[5] = wsk('KeyA');
  secondary[10] = wsk('Digit1');
  return {
    id: 'fixture',
    name: 'fixture',
    layout: [primary, secondary, tertiary] as unknown as DeviceLayout['layout'],
  };
}

/** Layout with only a primary and secondary layer (no tertiary/quaternary). */
function fixtureLayoutTwoLayers(): DeviceLayout {
  const primary = new Array(90).fill(0);
  const secondary = new Array(90).fill(0);
  primary[5] = wsk('KeyA');
  return {
    id: 'fixture-two-layers',
    name: 'fixture-two-layers',
    layout: [primary, secondary] as unknown as DeviceLayout['layout'],
  };
}

describe('LayoutViewerComponent — modifier & layer switching', () => {
  let fixture: ComponentFixture<LayoutViewerComponent>;
  let component: LayoutViewerComponent;
  let keys: GlobalKeyService;
  let deviceLayouts: DeviceLayoutService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LayoutViewerComponent],
    }).compileComponents();
    keys = TestBed.inject(GlobalKeyService);
    deviceLayouts = TestBed.inject(DeviceLayoutService);
    fixture = TestBed.createComponent(LayoutViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('switches to the Shift variant while Shift is held, and back on release', () => {
    expect(component.shiftKey()).toBeFalse();

    keys.pressedCodes.set(new Set(['ShiftLeft']));
    fixture.detectChanges();
    expect(component.shiftKey()).toBeTrue();

    keys.pressedCodes.set(new Set());
    fixture.detectChanges();
    expect(component.shiftKey()).toBeFalse();
  });

  it('also detects the right Shift key', () => {
    keys.pressedCodes.set(new Set(['ShiftRight']));
    fixture.detectChanges();
    expect(component.shiftKey()).toBeTrue();
  });

  it('switches to the AltGr variant while AltRight is held', () => {
    keys.pressedCodes.set(new Set(['AltRight']));
    fixture.detectChanges();
    expect(component.altGraphKey()).toBeTrue();
  });

  it('keeps the manual Shift toggle when nothing is pressed', () => {
    component.toggleShift();
    fixture.detectChanges();
    expect(component.shiftKey()).toBeTrue();
  });

  it('auto-switches the layer to one that produces the pressed key', () => {
    deviceLayouts.addLayouts([fixtureLayout()]); // adds and selects it
    fixture.detectChanges();
    expect(component.currentLayer()).toBe(Layer.Primary);

    // Digit1 lives only on the secondary layer -> switch to it.
    keys.lastKeyDown.set({ code: 'Digit1', seq: 1 });
    fixture.detectChanges();
    expect(component.currentLayer()).toBe(Layer.Secondary);

    // KeyA is on the primary layer -> switch back.
    keys.lastKeyDown.set({ code: 'KeyA', seq: 2 });
    fixture.detectChanges();
    expect(component.currentLayer()).toBe(Layer.Primary);
  });

  it('clamps the current layer when switching to a device layout with fewer layers', () => {
    deviceLayouts.addLayouts([fixtureLayout()]); // 3 layers
    fixture.detectChanges();
    component.setLayer(Layer.Tertiary);
    fixture.detectChanges();
    expect(component.currentLayer()).toBe(Layer.Tertiary);

    deviceLayouts.addLayouts([fixtureLayoutTwoLayers()]); // 2 layers, selected
    fixture.detectChanges();
    expect(component.layers()).toEqual([Layer.Primary, Layer.Secondary]);
    expect(component.currentLayer()).toBe(Layer.Primary);
  });
});

describe('LayoutViewerComponent — what is on screen', () => {
  let fixture: ComponentFixture<LayoutViewerComponent>;
  let component: LayoutViewerComponent;
  let keys: GlobalKeyService;
  let deviceLayouts: DeviceLayoutService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [LayoutViewerComponent] }).compileComponents();
    keys = TestBed.inject(GlobalKeyService);
    deviceLayouts = TestBed.inject(DeviceLayoutService);
    fixture = TestBed.createComponent(LayoutViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterAll(() => localStorage.clear());

  const root = () => fixture.nativeElement as HTMLElement;
  const buttons = (group: string) =>
    Array.from(root().querySelectorAll<HTMLButtonElement>(`[aria-label=${group}] button`));
  const text = (b: HTMLButtonElement) => b.textContent!.trim();
  const active = (b: HTMLElement) => b.classList.contains('toggle--active');
  const toolbar = () => root().querySelector<HTMLElement>('.toolbar')!;
  const layout = () => fixture.debugElement.query(By.directive(LayoutComponent));
  const empty = () => root().querySelector('.empty');
  const legend = () => root().querySelector('.legend');
  const click = (b: HTMLElement) => {
    b.click();
    fixture.detectChanges();
  };

  describe('layer buttons', () => {
    it('has one for each layer of the device layout, named after the layer', () => {
      expect(buttons('Layer').map(text)).toEqual(['A1', 'A2', 'A3']);
      expect(buttons('Layer').map((b) => b.title)).toEqual(['Layer 1', 'Layer 2', 'Layer 3']);
    });

    it('has four for a four-layer layout', () => {
      deviceLayouts.setSelectedId('cclite-default');
      fixture.detectChanges();
      expect(buttons('Layer').map(text)).toEqual(['A1', 'A2', 'A3', 'A4']);
    });

    it('uses the profile of the layout as the prefix', () => {
      deviceLayouts.addLayouts([{ ...fixtureLayout(), profile: 'C' } as DeviceLayout]);
      fixture.detectChanges();
      expect(buttons('Layer').map(text)).toEqual(['C1', 'C2', 'C3']);
    });

    it('marks the current layer, and changes it when clicked', () => {
      expect(buttons('Layer').map(active)).toEqual([true, false, false]);
      click(buttons('Layer')[2]);
      expect(component.currentLayer()).toBe(Layer.Tertiary);
      expect(buttons('Layer').map(active)).toEqual([false, false, true]);
    });

    it('is the layer that the labels are drawn for', () => {
      click(buttons('Layer')[1]);
      expect(layout().componentInstance.highlightKeyCombination().layer).toBe(Layer.Secondary);
    });
  });

  describe('Shift and AltGr buttons', () => {
    it('are named Shift and AltGr, and are off at first', () => {
      expect(buttons('Modifiers').map(text)).toEqual(['Shift', 'AltGr']);
      expect(buttons('Modifiers').map(active)).toEqual([false, false]);
    });

    it('turn on and off when clicked', () => {
      click(buttons('Modifiers')[0]);
      expect(buttons('Modifiers').map(active)).toEqual([true, false]);
      click(buttons('Modifiers')[1]);
      expect(buttons('Modifiers').map(active)).toEqual([true, true]);
      click(buttons('Modifiers')[0]);
      expect(buttons('Modifiers').map(active)).toEqual([false, true]);
    });

    it('light up while the key is held on the device', () => {
      keys.pressedCodes.set(new Set(['ShiftLeft', 'AltRight']));
      fixture.detectChanges();
      expect(buttons('Modifiers').map(active)).toEqual([true, true]);
    });

    it('stay on after release when they were turned on by hand', () => {
      click(buttons('Modifiers')[0]);
      keys.pressedCodes.set(new Set(['ShiftLeft']));
      fixture.detectChanges();
      keys.pressedCodes.set(new Set());
      fixture.detectChanges();
      expect(component.shiftKey()).toBeTrue();
    });
  });

  describe('highlights', () => {
    const combination = () => component.highlightKeyCombination();

    it('is the primary layer without modifiers at first, with no keys to hold', () => {
      expect(combination()).toEqual({
        positionCodes: [],
        score: 0,
        characterKeyPositionCode: 0,
        layer: Layer.Primary,
        shiftKey: false,
        altGraphKey: false,
      });
    });

    it('lights the layer-switch keys of the layer, as a hint for how to get there', () => {
      click(buttons('Layer')[1]);
      expect(combination().positionCodes).toEqual([33, 78]);
      click(buttons('Layer')[2]);
      expect(combination().positionCodes).toEqual([30, 75]);
    });

    it('lights the Shift keys when Shift is on', () => {
      click(buttons('Modifiers')[0]);
      expect(combination().positionCodes).toEqual([31, 76]);
      click(buttons('Modifiers')[1]);
      expect(combination().positionCodes).toEqual([31, 76, 77]);
    });

    it('follows the pressed keys to the layout as held positions', () => {
      deviceLayouts.addLayouts([fixtureLayout()]);
      keys.pressedCodes.set(new Set(['KeyA']));
      fixture.detectChanges();
      expect(layout().componentInstance.secondaryHighlightPositions()).toEqual([5]);
      keys.pressedCodes.set(new Set());
      fixture.detectChanges();
      expect(layout().componentInstance.secondaryHighlightPositions()).toEqual([]);
    });
  });

  describe('following typing', () => {
    beforeEach(() => {
      deviceLayouts.addLayouts([fixtureLayout()]);
      fixture.detectChanges();
    });

    it('stays on the layer the key is on', () => {
      click(buttons('Layer')[1]);
      keys.lastKeyDown.set({ code: 'Digit1', seq: 1 });
      fixture.detectChanges();
      expect(component.currentLayer()).toBe(Layer.Secondary);
    });

    it('stays when the key is not on the layout at all', () => {
      click(buttons('Layer')[1]);
      keys.lastKeyDown.set({ code: 'KeyQ', seq: 1 });
      fixture.detectChanges();
      expect(component.currentLayer()).toBe(Layer.Secondary);
    });

    it('does nothing before any key was pressed', () => {
      click(buttons('Layer')[2]);
      expect(component.currentLayer()).toBe(Layer.Tertiary);
    });

    it('lets the layer be chosen by hand until the next key', () => {
      keys.lastKeyDown.set({ code: 'KeyA', seq: 1 });
      fixture.detectChanges();
      click(buttons('Layer')[1]);
      expect(component.currentLayer()).toBe(Layer.Secondary);
    });
  });

  describe('the picture', () => {
    it('is drawn with the selected layouts, with the thumb switch setting', () => {
      expect(layout()).not.toBeNull();
      expect(layout().componentInstance.showThumb3Switch()).toBeTrue();
      TestBed.inject(ViewSettingsService).toggleThumb3Switch();
      fixture.detectChanges();
      expect(layout().componentInstance.showThumb3Switch()).toBeFalse();
    });

    it('has labels for the device layout and the OS layout', () => {
      const map = layout().componentInstance.keyLabelMap() as Record<number, unknown[]>;
      expect(Object.keys(map).length).toBe(90);
      expect(Object.values(map).some((l) => l.length > 0)).toBeTrue();
    });

    it('shows a message instead when the OS layout is not known', () => {
      TestBed.inject(KeyboardLayoutService).setSelectedId('no-such-layout');
      fixture.detectChanges();
      expect(layout()).toBeNull();
      expect(empty()!.textContent).toContain(
        'Select a device layout and an OS layout in settings.',
      );
    });

    it('shows a message instead when the device layout is not known', () => {
      deviceLayouts.setSelectedId('no-such-layout');
      fixture.detectChanges();
      expect(layout()).toBeNull();
      expect(empty()).not.toBeNull();
      expect(buttons('Layer').length).toBe(0);
    });

    it('does not show the message as an overlay', () => {
      deviceLayouts.setSelectedId('no-such-layout');
      fixture.componentRef.setInput('overlay', true);
      fixture.detectChanges();
      expect(empty()).toBeNull();
    });
  });

  describe('dead key legend', () => {
    const withDeadKey = () =>
      TestBed.inject(KeyboardLayoutService).entities.find((k) =>
        Object.values(k.layout).some((key) =>
          Object.values(key ?? {}).some((o) => o?.type === 'dead-key'),
        ),
      )!;

    it('is not shown for a layout with no dead keys', () => {
      expect(legend()).toBeNull();
    });

    it('is shown for a layout that has them', () => {
      TestBed.inject(KeyboardLayoutService).setSelectedId(withDeadKey().id);
      fixture.detectChanges();
      expect(legend()!.textContent).toContain('Dead key');
    });

    it('is left out in overlay mode', () => {
      TestBed.inject(KeyboardLayoutService).setSelectedId(withDeadKey().id);
      fixture.componentRef.setInput('overlay', true);
      fixture.detectChanges();
      expect(legend()).toBeNull();
    });
  });

  describe('overlay mode', () => {
    it('shows the toolbar normally', () => {
      expect(toolbar().style.visibility).toBe('visible');
    });

    it('hides the toolbar but keeps its place, so the picture does not move', () => {
      fixture.componentRef.setInput('overlay', true);
      fixture.detectChanges();
      expect(toolbar().style.visibility).toBe('hidden');
      expect(root().contains(toolbar())).toBeTrue();
      expect(layout()).not.toBeNull();
    });
  });
});
