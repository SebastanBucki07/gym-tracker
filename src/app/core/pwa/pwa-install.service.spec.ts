import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PwaInstallService } from './pwa-install.service';

describe('PwaInstallService', () => {
  let service: PwaInstallService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [PwaInstallService]
    });
    service = TestBed.inject(PwaInstallService);
  });

  afterEach(() => {
    if (service) {
      service.ngOnDestroy();
    }
  });

  it('should capture beforeinstallprompt event and enable canInstall', () => {
    expect(service.canInstall()).toBe(false);

    const event = new Event('beforeinstallprompt');
    (event as any).prompt = vi.fn();
    (event as any).userChoice = Promise.resolve({ outcome: 'accepted' });

    window.dispatchEvent(event);
    expect(service.canInstall()).toBe(true);
  });

  it('should prompt installation and reset canInstall flag', async () => {
    const promptMock = vi.fn();
    const event = new Event('beforeinstallprompt');
    (event as any).prompt = promptMock;
    (event as any).userChoice = Promise.resolve({ outcome: 'accepted' });

    window.dispatchEvent(event);
    expect(service.canInstall()).toBe(true);

    const accepted = await service.promptInstall();
    expect(promptMock).toHaveBeenCalled();
    expect(accepted).toBe(true);
    expect(service.canInstall()).toBe(false);
  });

  it('should handle appinstalled event', () => {
    window.dispatchEvent(new Event('appinstalled'));
    expect(service.isInstalled()).toBe(true);
    expect(service.canInstall()).toBe(false);
  });
});
