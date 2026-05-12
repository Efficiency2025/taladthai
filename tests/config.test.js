import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('config.js', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('uses default values when env vars are not set', async () => {
    // Ensure env vars are NOT set
    delete import.meta.env.VITE_AUTO_REFRESH_INTERVAL;
    delete import.meta.env.VITE_RETRY_ATTEMPTS;
    delete import.meta.env.VITE_RETRY_BASE_DELAY;

    const { CONFIG } = await import('../src/config.js');

    expect(CONFIG.AUTO_REFRESH_INTERVAL).toBe(120000);
    expect(CONFIG.RETRY_ATTEMPTS).toBe(3);
    expect(CONFIG.RETRY_BASE_DELAY).toBe(1000);
  });

  it('reads values from import.meta.env when set', async () => {
    import.meta.env.VITE_AUTO_REFRESH_INTERVAL = '60000';
    import.meta.env.VITE_RETRY_ATTEMPTS = '5';
    import.meta.env.VITE_RETRY_BASE_DELAY = '2000';

    const { CONFIG } = await import('../src/config.js');

    expect(CONFIG.AUTO_REFRESH_INTERVAL).toBe(60000);
    expect(CONFIG.RETRY_ATTEMPTS).toBe(5);
    expect(CONFIG.RETRY_BASE_DELAY).toBe(2000);

    // Cleanup
    delete import.meta.env.VITE_AUTO_REFRESH_INTERVAL;
    delete import.meta.env.VITE_RETRY_ATTEMPTS;
    delete import.meta.env.VITE_RETRY_BASE_DELAY;
  });
});
