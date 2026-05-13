import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/router.js', () => ({
  initRouter: vi.fn(),
  onNavigate: vi.fn(),
}));
vi.mock('../src/services/cache.js', () => ({
  loadAll: vi.fn().mockResolvedValue(undefined),
  startRealtimeSync: vi.fn(),
  stopRealtimeSync: vi.fn(),
}));
vi.mock('../src/pages/search.js', () => ({
  renderSearch: vi.fn(),
  getSearchResult: vi.fn(),
}));
vi.mock('../src/pages/info.js', () => ({
  renderInfo: vi.fn(),
}));

import { init, showConnectionStatus } from '../src/main.js';
import { initRouter, onNavigate } from '../src/router.js';
import { loadAll, startRealtimeSync } from '../src/services/cache.js';
import { renderSearch, getSearchResult } from '../src/pages/search.js';
import { renderInfo } from '../src/pages/info.js';

describe('Main App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('init() shows loading then initializes', async () => {
    const app = document.getElementById('app');
    await init(app);
    expect(loadAll).toHaveBeenCalled();
    expect(initRouter).toHaveBeenCalled();
    expect(startRealtimeSync).toHaveBeenCalled();
    expect(onNavigate).toHaveBeenCalled();
  });

  it('onNavigate callback renders search page', async () => {
    const app = document.getElementById('app');
    let callback;
    onNavigate.mockImplementation(cb => { callback = cb; });
    await init(app);
    callback('/search');
    expect(renderSearch).toHaveBeenCalledWith(app);
  });

  it('onNavigate callback renders info page', async () => {
    const app = document.getElementById('app');
    let callback;
    onNavigate.mockImplementation(cb => { callback = cb; });
    getSearchResult.mockReturnValue({ name: 'test' });
    await init(app);
    callback('/info');
    expect(renderInfo).toHaveBeenCalledWith(app);
  });

  it('showConnectionStatus creates and shows banner', () => {
    vi.useFakeTimers();
    showConnectionStatus('ออฟไลน์');
    const banner = document.getElementById('connection-banner');
    expect(banner).not.toBeNull();
    expect(banner.textContent).toBe('ออฟไลน์');
    expect(banner.classList.contains('show')).toBe(true);
    vi.advanceTimersByTime(3000);
    expect(banner.classList.contains('show')).toBe(false);
    vi.useRealTimers();
  });

  it('showConnectionStatus reuses existing banner', () => {
    vi.useFakeTimers();
    showConnectionStatus('first');
    showConnectionStatus('second');
    const banners = document.querySelectorAll('#connection-banner');
    expect(banners.length).toBe(1);
    expect(banners[0].textContent).toBe('second');
    vi.useRealTimers();
  });

  it('handles offline event', async () => {
    const app = document.getElementById('app');
    await init(app);
    window.dispatchEvent(new Event('offline'));
    const banner = document.getElementById('connection-banner');
    expect(banner).not.toBeNull();
  });

  it('handles online event', async () => {
    const app = document.getElementById('app');
    await init(app);
    // Online event doesn't call loadAll anymore (Firestore auto-syncs)
    window.dispatchEvent(new Event('online'));
    const banner = document.getElementById('connection-banner');
    expect(banner).not.toBeNull();
  });

  it('beforeunload calls stopRealtimeSync', async () => {
    const { stopRealtimeSync } = await import('../src/services/cache.js');
    const app = document.getElementById('app');
    await init(app);
    window.dispatchEvent(new Event('beforeunload'));
    expect(stopRealtimeSync).toHaveBeenCalled();
  });

  it('init() without appEl uses document.getElementById fallback', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    await init();
    expect(loadAll).toHaveBeenCalled();
    expect(initRouter).toHaveBeenCalled();
  });

  it('onNavigate callback ignores unknown routes', async () => {
    const app = document.getElementById('app');
    let callback;
    onNavigate.mockImplementation(cb => { callback = cb; });
    await init(app);
    callback('/unknown');
    expect(renderSearch).not.toHaveBeenCalled();
    expect(renderInfo).not.toHaveBeenCalled();
  });

  it('init() returns early when #app element is not found', async () => {
    document.body.innerHTML = '';
    const result = await init();
    expect(result).toBeUndefined();
    expect(loadAll).not.toHaveBeenCalled();
    expect(initRouter).not.toHaveBeenCalled();
  });

  it('init() continues even when loadAll() throws', async () => {
    loadAll.mockRejectedValue(new Error('Firestore unavailable'));
    const app = document.getElementById('app');
    // Should not throw — error is caught and logged
    await expect(init(app)).resolves.toBeUndefined();
    // Router still initialises after loadAll failure
    expect(initRouter).toHaveBeenCalled();
  });
});
