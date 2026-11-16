import { Injectable, signal, inject, OnDestroy } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PwaInstallService implements OnDestroy {
  private swUpdate = inject(SwUpdate, { optional: true });

  canInstall = signal<boolean>(false);
  isInstalled = signal<boolean>(false);
  updateAvailable = signal<boolean>(false);

  private deferredPrompt: any = null;

  private beforeInstallHandler = (e: Event) => {
    e.preventDefault();
    this.deferredPrompt = e;
    this.canInstall.set(true);
  };

  private appInstalledHandler = () => {
    this.isInstalled.set(true);
    this.canInstall.set(false);
    this.deferredPrompt = null;
  };

  constructor() {
    if (typeof window !== 'undefined') {
      const isStandalone = (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) || Boolean((window.navigator as any)?.standalone);
      this.isInstalled.set(Boolean(isStandalone));

      window.addEventListener('beforeinstallprompt', this.beforeInstallHandler);
      window.addEventListener('appinstalled', this.appInstalledHandler);
    }

    if (this.swUpdate?.isEnabled) {
      this.swUpdate.versionUpdates
        .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
        .subscribe(() => {
          this.updateAvailable.set(true);
        });
    }
  }

  async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) {
      return false;
    }

    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    this.canInstall.set(false);

    return outcome === 'accepted';
  }

  async reloadApp(): Promise<void> {
    if (this.swUpdate?.isEnabled) {
      await this.swUpdate.activateUpdate();
    }
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeinstallprompt', this.beforeInstallHandler);
      window.removeEventListener('appinstalled', this.appInstalledHandler);
    }
  }
}
