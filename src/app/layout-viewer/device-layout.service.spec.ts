import { TestBed } from '@angular/core/testing';
import { DEFAULT_DEVICE_LAYOUT, DeviceLayout } from 'tangent-cc-lib';
import { DeviceLayoutService } from './device-layout.service';

const UPLOADED_KEY = 'sirius.deviceLayouts.uploaded';
const SELECTED_KEY = 'sirius.deviceLayouts.selectedId';
const BUILT_IN_IDS = [
  'default',
  'm4g-default',
  'cc1-cc2-right-hand-only',
  'cc1-cc2-left-hand-only',
  'cclite-default',
];

function layout(id: string, layers = 3): DeviceLayout {
  return {
    id,
    name: id,
    layout: Array.from({ length: layers }, () => new Array(90).fill(0)) as DeviceLayout['layout'],
  };
}

describe('DeviceLayoutService', () => {
  beforeEach(() => localStorage.clear());
  afterAll(() => localStorage.clear());

  function create(): DeviceLayoutService {
    TestBed.resetTestingModule();
    const service = TestBed.inject(DeviceLayoutService);
    TestBed.tick();
    return service;
  }

  describe('at first', () => {
    it('lists the five built-in layouts, in order', () => {
      expect(
        create()
          .entities()
          .map((d) => d.id),
      ).toEqual(BUILT_IN_IDS);
    });

    it('selects the default one, and saves that', () => {
      const service = create();
      expect(service.selectedId()).toBe(DEFAULT_DEVICE_LAYOUT.id);
      expect(service.selectedEntity()).toBe(DEFAULT_DEVICE_LAYOUT);
      expect(localStorage.getItem(SELECTED_KEY)).toBe('default');
    });

    it('counts the layers of the selected layout', () => {
      const service = create();
      expect(service.selectedEntityLayerNumber()).toBe(3);
      service.setSelectedId('cclite-default');
      expect(service.selectedEntityLayerNumber()).toBe(4);
    });

    it('saves an empty list of uploaded layouts', () => {
      create();
      expect(localStorage.getItem(UPLOADED_KEY)).toBe('[]');
    });
  });

  describe('selecting', () => {
    it('selects a built-in layout and saves the choice', () => {
      const service = create();
      service.setSelectedId('m4g-default');
      TestBed.tick();
      expect(service.selectedEntity()?.id).toBe('m4g-default');
      expect(localStorage.getItem(SELECTED_KEY)).toBe('m4g-default');
    });

    it('starts with the layout that was saved', () => {
      localStorage.setItem(SELECTED_KEY, 'cclite-default');
      expect(create().selectedEntity()?.id).toBe('cclite-default');
    });

    it('falls back to the default layout when the saved id is unknown, and saves that', () => {
      localStorage.setItem(SELECTED_KEY, 'gone');
      const service = create();
      expect(service.selectedId()).toBe('default');
      expect(service.selectedEntity()?.id).toBe('default');
      expect(service.selectedEntityLayerNumber()).toBe(3);
      expect(localStorage.getItem(SELECTED_KEY)).toBe('default');
    });

    it('keeps a saved id that is an uploaded layout', () => {
      localStorage.setItem(UPLOADED_KEY, JSON.stringify([layout('mine')]));
      localStorage.setItem(SELECTED_KEY, 'mine');
      expect(create().selectedId()).toBe('mine');
    });

    it('falls back when the saved id was an uploaded layout that is gone', () => {
      localStorage.setItem(SELECTED_KEY, 'mine');
      expect(create().selectedId()).toBe('default');
    });

    // Only the saved value is checked; picking an id by hand is not.
    it('still takes an unknown id when it is set by hand, with nothing selected', () => {
      const service = create();
      service.setSelectedId('gone');
      expect(service.selectedEntity()).toBeNull();
      expect(service.selectedEntityLayerNumber()).toBe(0);
    });
  });

  describe('uploaded layouts', () => {
    it('are added after the built-in ones, and the first one added is selected', () => {
      const service = create();
      service.addLayouts([layout('mine-1'), layout('mine-2', 4)]);
      TestBed.tick();
      expect(service.entities().map((d) => d.id)).toEqual([...BUILT_IN_IDS, 'mine-1', 'mine-2']);
      expect(service.selectedId()).toBe('mine-1');
      expect(service.selectedEntityLayerNumber()).toBe(3);
    });

    it('add up over several uploads', () => {
      const service = create();
      service.addLayouts([layout('a')]);
      service.addLayouts([layout('b')]);
      expect(service.entities().map((d) => d.id)).toEqual([...BUILT_IN_IDS, 'a', 'b']);
      expect(service.selectedId()).toBe('b');
    });

    it('do nothing when the list is empty', () => {
      const service = create();
      service.setSelectedId('m4g-default');
      service.addLayouts([]);
      expect(service.entities().length).toBe(5);
      expect(service.selectedId()).toBe('m4g-default');
    });

    it('are saved, and come back after a restart', () => {
      const service = create();
      service.addLayouts([layout('mine')]);
      TestBed.tick();
      expect(JSON.parse(localStorage.getItem(UPLOADED_KEY)!)).toEqual([layout('mine')]);
      const again = create();
      expect(again.entities().map((d) => d.id)).toEqual([...BUILT_IN_IDS, 'mine']);
      expect(again.selectedId()).toBe('mine');
      expect(again.selectedEntity()?.id).toBe('mine');
    });

    it('can be told apart from the built-in ones', () => {
      const service = create();
      service.addLayouts([layout('mine')]);
      expect(service.isUploaded('mine')).toBeTrue();
      expect(service.isUploaded('default')).toBeFalse();
      expect(service.isUploaded('nope')).toBeFalse();
    });

    describe('removing', () => {
      it('takes one away and keeps the others', () => {
        const service = create();
        service.addLayouts([layout('a'), layout('b')]);
        service.setSelectedId('default');
        service.removeUploaded('a');
        TestBed.tick();
        expect(service.entities().map((d) => d.id)).toEqual([...BUILT_IN_IDS, 'b']);
        expect(service.selectedId()).toBe('default');
        expect(
          JSON.parse(localStorage.getItem(UPLOADED_KEY)!).map((d: DeviceLayout) => d.id),
        ).toEqual(['b']);
      });

      it('goes back to the default layout when the selected one is removed', () => {
        const service = create();
        service.addLayouts([layout('a')]);
        expect(service.selectedId()).toBe('a');
        service.removeUploaded('a');
        expect(service.selectedId()).toBe('default');
      });

      it('leaves the selection alone when another layout is removed', () => {
        const service = create();
        service.addLayouts([layout('a'), layout('b')]);
        service.setSelectedId('b');
        service.removeUploaded('a');
        expect(service.selectedId()).toBe('b');
      });

      it('does nothing for a built-in id or an unknown one', () => {
        const service = create();
        service.removeUploaded('default');
        service.removeUploaded('nope');
        expect(service.entities().length).toBe(5);
      });
    });

    describe('when the saved list cannot be read', () => {
      it('starts with none if it is not JSON', () => {
        localStorage.setItem(UPLOADED_KEY, '{oops');
        expect(create().entities().length).toBe(5);
      });

      it('starts with none if it is not a list', () => {
        localStorage.setItem(UPLOADED_KEY, '{"layout":[]}');
        expect(create().entities().length).toBe(5);
      });

      it('starts with none if it is empty text', () => {
        localStorage.setItem(UPLOADED_KEY, '');
        expect(create().entities().length).toBe(5);
      });

      // Current behavior: the items of a saved list are not checked.
      it('trusts the items of a list', () => {
        localStorage.setItem(UPLOADED_KEY, JSON.stringify([layout('saved')]));
        expect(
          create()
            .entities()
            .map((d) => d.id),
        ).toContain('saved');
      });
    });
  });
});
