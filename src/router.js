/**
 * Hash-based SPA router.
 * Routes: #/search, #/info
 */

let onNavigateCallback = null;

/**
 * Register a callback that fires on every route change.
 * @param {function(string): void} callback - receives the new route
 */
export function onNavigate(callback) {
  onNavigateCallback = callback;
}

/**
 * Navigate to a hash route.
 * @param {string} hash - e.g. '#/search' or '#/info'
 */
export function navigate(hash) {
  window.location.hash = hash;
}

/**
 * Get current route from the hash.
 * @returns {string} route path, e.g. '/search'
 */
export function getCurrentRoute() {
  const hash = window.location.hash;
  if (!hash || hash === '#' || hash === '#/') {
    return '/search';
  }
  return hash.slice(1); // remove '#'
}

/**
 * Toggle page visibility based on the current route.
 * @param {string} route - '/search' or '/info'
 */
export function togglePages(route) {
  const searchPage = document.getElementById('search-page');
  const infoPage = document.getElementById('info-page');

  if (searchPage) {
    searchPage.classList.toggle('page-hidden', route !== '/search');
    searchPage.classList.toggle('page-visible', route === '/search');
  }
  if (infoPage) {
    infoPage.classList.toggle('page-hidden', route !== '/info');
    infoPage.classList.toggle('page-visible', route === '/info');
  }
}

/**
 * Handle hash change events.
 */
function handleHashChange() {
  const route = getCurrentRoute();
  togglePages(route);
  if (onNavigateCallback) {
    onNavigateCallback(route);
  }
}

/**
 * Initialize the router. Sets up the hashchange listener
 * and navigates to the default route if none is set.
 */
export function initRouter() {
  window.addEventListener('hashchange', handleHashChange);

  // Default to search page
  if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
    window.location.hash = '#/search';
  } else {
    handleHashChange();
  }
}
