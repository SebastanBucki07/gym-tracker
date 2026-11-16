import { Injectable, signal, effect, OnDestroy } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NetworkStatusService implements OnDestroy {
  isOnline = signal<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  showReconnectedNotice = signal<boolean>(false);
  private noticeTimeout: ReturnType<typeof setTimeout> | null = null;

  private onlineHandler = () => this.handleOnline();
  private offlineHandler = () => this.handleOffline();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.onlineHandler);
      window.addEventListener('offline', this.offlineHandler);
    }
  }

  private handleOnline(): void {
    this.isOnline.set(true);
    this.showReconnectedNotice.set(true);

    if (this.noticeTimeout) {
      clearTimeout(this.noticeTimeout);
    }
    this.noticeTimeout = setTimeout(() => {
      this.showReconnectedNotice.set(false);
    }, 4000);
  }

  private handleOffline(): void {
    this.isOnline.set(false);
    this.showReconnectedNotice.set(false);
  }

  dismissReconnectedNotice(): void {
    this.showReconnectedNotice.set(false);
    if (this.noticeTimeout) {
      clearTimeout(this.noticeTimeout);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onlineHandler);
      window.removeEventListener('offline', this.offlineHandler);
    }
    if (this.noticeTimeout) {
      clearTimeout(this.noticeTimeout);
    }
  }
}
