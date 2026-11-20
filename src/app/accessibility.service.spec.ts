import { TestBed } from '@angular/core/testing';
import { AccessibilityApi, AccessibilityStatus, SiriusApi } from './global-key';
import { AccessibilityService } from './accessibility.service';

const flush = () => new Promise((r) => setTimeout(r));

function install(status: AccessibilityStatus) {
  let push!: (s: AccessibilityStatus) => void;
  const api = jasmine.createSpyObj<AccessibilityApi>('accessibility', [
    'getStatus',
    'openSettings',
    'onStatus',
  ]);
  api.getStatus.and.resolveTo(status);
  api.onStatus.and.callFake((cb) => {
    push = cb;
    return () => undefined;
  });
  window.sirius = { onKey: () => () => undefined, accessibility: api } as SiriusApi;
  return { api, push: (s: AccessibilityStatus) => push(s) };
}

describe('AccessibilityService', () => {
  afterEach(() => {
    delete window.sirius;
  });

  describe('without the Electron bridge', () => {
    it('never blocks, and opening settings does nothing', () => {
      delete window.sirius;
      const service = TestBed.inject(AccessibilityService);
      expect(service.blocking()).toBeFalse();
      expect(() => service.openSettings()).not.toThrow();
    });

    it('does not block when the bridge has no accessibility part', () => {
      window.sirius = { onKey: () => () => undefined } as SiriusApi;
      expect(TestBed.inject(AccessibilityService).blocking()).toBeFalse();
    });
  });

  describe('with the Electron bridge', () => {
    it('does not block before the first answer', () => {
      install({ needed: true, granted: false });
      expect(TestBed.inject(AccessibilityService).blocking()).toBeFalse();
    });

    it('blocks when the permission is needed and not granted', async () => {
      install({ needed: true, granted: false });
      const service = TestBed.inject(AccessibilityService);
      await flush();
      expect(service.blocking()).toBeTrue();
    });

    it('does not block when it is granted', async () => {
      install({ needed: true, granted: true });
      const service = TestBed.inject(AccessibilityService);
      await flush();
      expect(service.blocking()).toBeFalse();
    });

    it('does not block when this system needs no permission', async () => {
      install({ needed: false, granted: false });
      const service = TestBed.inject(AccessibilityService);
      await flush();
      expect(service.blocking()).toBeFalse();
    });

    it('follows later reports, so the banner goes away once it is granted', async () => {
      const fake = install({ needed: true, granted: false });
      const service = TestBed.inject(AccessibilityService);
      await flush();
      expect(service.blocking()).toBeTrue();
      fake.push({ needed: true, granted: true });
      expect(service.blocking()).toBeFalse();
      fake.push({ needed: true, granted: false });
      expect(service.blocking()).toBeTrue();
    });

    it('opens the system settings', () => {
      const fake = install({ needed: true, granted: false });
      TestBed.inject(AccessibilityService).openSettings();
      expect(fake.api.openSettings).toHaveBeenCalledTimes(1);
    });
  });
});
