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
  console.log('[talad-thai] init() called');
  console.log('[talad-thai] MODE:', import.meta.env.MODE);
  console.log('[talad-thai] BASE_URL:', import.meta.env.BASE_URL);
  console.log('[talad-thai] VITE_USE_MOCK_DATA:', import.meta.env.VITE_USE_MOCK_DATA);
  console.log('[talad-thai] VITE_FIREBASE_PROJECT_ID:', import.meta.env.VITE_FIREBASE_PROJECT_ID);
  console.log('[talad-thai] VITE_FIREBASE_API_KEY set:', !!import.meta.env.VITE_FIREBASE_API_KEY);
  console.log('[talad-thai] CONFIG:', JSON.stringify(CONFIG));

  const app = appEl || document.getElementById('app');

  if (!app) {
    const errMsg = '[talad-thai] FATAL: #app element not found in DOM';
    console.error(errMsg);
    return;
  }
  console.log('[talad-thai] #app element found');

  // Show loading state
  app.innerHTML = `
    <div class="app-loading">
      <div class="spinner"></div>
      <p>กำลังโหลดข้อมูลผู้ค้า...</p>
    </div>
  `;

  try {
    // Load all participants into cache
    console.log('[talad-thai] loadAll() starting...');
    await loadAll();
    console.log('[talad-thai] loadAll() complete');
  } catch (err) {
    const errMsg = `[talad-thai] loadAll() FAILED: ${err.message}\n${err.stack}`;
    console.error(errMsg);
  }

  // Set up page rendering callback
  onNavigate((route) => {
    console.log('[talad-thai] navigate →', route);
    if (route === '/search') {
      renderSearch(app);
    } else if (route === '/info') {
      const participant = getSearchResult();
      renderInfo(app);
    }
  });

  // Initialize router (triggers first render)
  console.log('[talad-thai] initRouter()');
  initRouter();

  // Start real-time Firestore sync (replaces polling)
  console.log('[talad-thai] startRealtimeSync()');
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

  console.log('[talad-thai] init() complete ✓');
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
  console.log('[talad-thai] Script loaded, calling init()...');
  init();
}
