/**
 * Main application entry point.
 * Initializes cache, router, and renders pages.
 */
import './styles/main.css';
import './styles/search.css';
import './styles/info.css';
import { initRouter, onNavigate } from './router.js';
import { loadAll, startRealtimeSync, stopRealtimeSync } from './services/cache.js';
import { renderSearch, getSearchResult } from './pages/search.js';
import { renderInfo } from './pages/info.js';
import { CONFIG } from './config.js';

/**
 * Initialize the application.
 * @param {HTMLElement} [appEl] - optional app container override (for testing)
 */
export async function init(appEl) {
  const app = appEl || document.getElementById('app');

  // Show loading state
  app.innerHTML = `
    <div class="app-loading">
      <div class="spinner"></div>
      <p>กำลังโหลดข้อมูลผู้ค้า...</p>
    </div>
  `;

  // Load all participants into cache
  await loadAll();

  // Set up page rendering callback
  onNavigate((route) => {
    if (route === '/search') {
      renderSearch(app);
    } else if (route === '/info') {
      const participant = getSearchResult();
      renderInfo(app);
    }
  });

  // Initialize router (triggers first render)
  initRouter();

  // Start real-time Firestore sync (replaces polling)
  startRealtimeSync();

  // Handle online/offline events
  window.addEventListener('offline', () => {
    showConnectionStatus('ออฟไลน์ — ใช้ข้อมูลที่แคชไว้');
  });

  window.addEventListener('online', () => {
    showConnectionStatus('ออนไลน์ — กำลังอัพเดทข้อมูล...');
    // Firestore auto-syncs when back online
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    stopRealtimeSync();
  });
}

/**
 * Show a connection status banner.
 * @param {string} message
 */
export function showConnectionStatus(message) {
  let banner = document.getElementById('connection-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'connection-banner';
    banner.className = 'connection-banner';
    document.body.prepend(banner);
  }
  banner.textContent = message;
  banner.classList.add('show');
  setTimeout(() => {
    banner.classList.remove('show');
  }, 3000);
}

// Auto-boot only when running in browser (not during tests)
/* v8 ignore next 3 */
if (!import.meta.env.VITEST) {
  init();
}
