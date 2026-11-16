import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NetworkStatusService } from './network-status.service';

describe('NetworkStatusService', () => {
  let service: NetworkStatusService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new NetworkStatusService();
  });

  afterEach(() => {
    service.ngOnDestroy();
    vi.useRealTimers();
  });

  it('should initialize with online status', () => {
    expect(service.isOnline()).toBe(true);
    expect(service.showReconnectedNotice()).toBe(false);
  });

  it('should update to offline when offline event triggers', () => {
    window.dispatchEvent(new Event('offline'));
    expect(service.isOnline()).toBe(false);
    expect(service.showReconnectedNotice()).toBe(false);
  });

  it('should update to online and show notice when online event triggers', () => {
    window.dispatchEvent(new Event('offline'));
    expect(service.isOnline()).toBe(false);

    window.dispatchEvent(new Event('online'));
    expect(service.isOnline()).toBe(true);
    expect(service.showReconnectedNotice()).toBe(true);

    // After 4000ms notice auto-dismisses
    vi.advanceTimersByTime(4000);
    expect(service.showReconnectedNotice()).toBe(false);
  });

  it('should allow manually dismissing reconnected notice', () => {
    window.dispatchEvent(new Event('online'));
    expect(service.showReconnectedNotice()).toBe(true);

    service.dismissReconnectedNotice();
    expect(service.showReconnectedNotice()).toBe(false);
  });
});
