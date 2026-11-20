import { TestBed } from '@angular/core/testing';
import { ViewSettingsService } from './view-settings.service';

const KEY = 'sirius.view.showThumb3Switch';

describe('ViewSettingsService', () => {
  beforeEach(() => localStorage.clear());
  afterAll(() => localStorage.clear());

  function create(): ViewSettingsService {
    TestBed.resetTestingModule();
    const service = TestBed.inject(ViewSettingsService);
    TestBed.tick();
    return service;
  }

  it('shows the 3rd thumb switch at first, and saves that', () => {
    const service = create();
    expect(service.showThumb3Switch()).toBeTrue();
    expect(localStorage.getItem(KEY)).toBe('true');
  });

  it('toggles it and saves each change', () => {
    const service = create();
    service.toggleThumb3Switch();
    TestBed.tick();
    expect(service.showThumb3Switch()).toBeFalse();
    expect(localStorage.getItem(KEY)).toBe('false');
    service.toggleThumb3Switch();
    TestBed.tick();
    expect(service.showThumb3Switch()).toBeTrue();
    expect(localStorage.getItem(KEY)).toBe('true');
  });

  it('starts off when it was saved as off', () => {
    localStorage.setItem(KEY, 'false');
    expect(create().showThumb3Switch()).toBeFalse();
  });

  it('starts on when it was saved as on, or as something else', () => {
    localStorage.setItem(KEY, 'true');
    expect(create().showThumb3Switch()).toBeTrue();
    localStorage.setItem(KEY, 'garbage');
    expect(create().showThumb3Switch()).toBeTrue();
  });
});
