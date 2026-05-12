/**
 * Router tests — 6 tests covering hash-based SPA navigation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { navigate, getCurrentRoute, togglePages, onNavigate, initRouter } from '../src/router.js';

describe('Router', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="search-page" class="page-visible"></div>
      <div id="info-page" class="page-hidden"></div>
    `;
    window.location.hash = '';
  });

  it('defaults to #/search on empty hash', () => {
    const route = getCurrentRoute();
    expect(route).toBe('/search');
  });

  it('navigate("#/info") switches to info page', () => {
    navigate('#/info');
    expect(window.location.hash).toBe('#/info');
  });

  it('navigate("#/search") switches to search page', () => {
    window.location.hash = '#/info';
    navigate('#/search');
    expect(window.location.hash).toBe('#/search');
  });

  it('responds to hashchange event', () => {
    const callback = vi.fn();
    onNavigate(callback);
    initRouter();

    // Simulate hashchange
    window.location.hash = '#/info';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(callback).toHaveBeenCalledWith('/info');
  });

  it('toggles DOM visibility correctly', () => {
    const searchPage = document.getElementById('search-page');
    const infoPage = document.getElementById('info-page');

    togglePages('/info');

    expect(searchPage.classList.contains('page-hidden')).toBe(true);
    expect(searchPage.classList.contains('page-visible')).toBe(false);
    expect(infoPage.classList.contains('page-hidden')).toBe(false);
    expect(infoPage.classList.contains('page-visible')).toBe(true);

    togglePages('/search');

    expect(searchPage.classList.contains('page-hidden')).toBe(false);
    expect(searchPage.classList.contains('page-visible')).toBe(true);
    expect(infoPage.classList.contains('page-hidden')).toBe(true);
    expect(infoPage.classList.contains('page-visible')).toBe(false);
  });

  it('calls page render callback on navigate', () => {
    const callback = vi.fn();
    onNavigate(callback);

    window.location.hash = '#/search';
    initRouter();

    // The callback should be called with the initial route
    expect(callback).toHaveBeenCalled();
  });

  // --- Additional tests for 100% branch coverage ---

  it('togglePages handles missing searchPage element', () => {
    document.body.innerHTML = '<div id="info-page" class="page-hidden"></div>';
    // Should not throw when #search-page is missing
    togglePages('/info');
    const infoPage = document.getElementById('info-page');
    expect(infoPage.classList.contains('page-visible')).toBe(true);
  });

  it('togglePages handles missing infoPage element', () => {
    document.body.innerHTML = '<div id="search-page" class="page-visible"></div>';
    // Should not throw when #info-page is missing
    togglePages('/search');
    const searchPage = document.getElementById('search-page');
    expect(searchPage.classList.contains('page-visible')).toBe(true);
  });

  it('togglePages handles both elements missing', () => {
    document.body.innerHTML = '<div></div>';
    // Should not throw when both elements are missing
    togglePages('/search');
  });

  it('getCurrentRoute returns /search for "#/" hash', () => {
    window.location.hash = '#/';
    expect(getCurrentRoute()).toBe('/search');
  });

  it('getCurrentRoute returns /search for "#" hash', () => {
    window.location.hash = '#';
    expect(getCurrentRoute()).toBe('/search');
  });

  it('initRouter calls handleHashChange for existing non-default hash', () => {
    const callback = vi.fn();
    onNavigate(callback);
    window.location.hash = '#/info';
    initRouter();
    expect(callback).toHaveBeenCalledWith('/info');
  });

  it('hashchange fires without callback registered', () => {
    // Reset callback by setting to null through onNavigate
    onNavigate(null);
    initRouter();
    // Should not throw when dispatching hashchange without callback
    window.location.hash = '#/info';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
});
