import { describe, it, expect } from 'vitest';
import manifestData from '../../../../public/manifest.json';
import ngswData from '../../../../ngsw-config.json';

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}

describe('PWA Configuration and Manifest Validation', () => {
  it('should have a valid web app manifest with required properties', () => {
    expect(manifestData).toBeTruthy();
    expect(manifestData.name).toBe('Gym Tracker');
    expect(manifestData.short_name).toBe('GymTracker');
    expect(manifestData.start_url).toBe('/');
    expect(manifestData.display).toBe('standalone');
    expect(manifestData.theme_color).toBe('#007bff');
    expect(manifestData.background_color).toBe('#f4f6f9');
    expect(Array.isArray(manifestData.icons)).toBe(true);
    expect(manifestData.icons.length).toBeGreaterThanOrEqual(8);

    const icons = manifestData.icons as ManifestIcon[];
    const icon192 = icons.find(i => i.sizes === '192x192' && i.purpose === 'any');
    expect(icon192).toBeTruthy();
    expect(icon192?.src).toBe('icons/icon-192x192.png');

    const maskable512 = icons.find(i => i.sizes === '512x512' && i.purpose === 'maskable');
    expect(maskable512).toBeTruthy();
  });

  it('should have a valid ngsw-config.json for service worker caching', () => {
    expect(ngswData).toBeTruthy();
    expect(ngswData.index).toBe('/index.html');
    expect(Array.isArray(ngswData.assetGroups)).toBe(true);
    expect(ngswData.assetGroups.length).toBeGreaterThanOrEqual(2);

    const appGroup = ngswData.assetGroups.find(g => g.name === 'app');
    expect(appGroup).toBeTruthy();
    expect(appGroup?.installMode).toBe('prefetch');

    // Security check: ensure no private user data or sensitive endpoints are cached in CacheStorage
    expect((ngswData as any).dataGroups).toBeUndefined();
  });
});
