import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ACTIONS, ActionType, DeviceLayout, Layer } from 'tangent-cc-lib';
import { GlobalKeyService } from '../global-key.service';
import { DeviceLayoutService } from './device-layout.service';
import { LayoutViewerComponent } from './layout-viewer.component';

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
});
