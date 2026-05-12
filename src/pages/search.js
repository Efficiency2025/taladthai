/**
 * Search page — staff enters name, phone number, or เลขที่โต๊ะ to find a participant.
 */
import { search } from '../services/cache.js';
import { checkStatus } from '../services/api.js';
import { navigate } from '../router.js';

let currentParticipant = null;

/**
 * Get the last search result (used by info page).
 * @returns {Object|null}
 */
export function getSearchResult() {
  return currentParticipant;
}

/**
 * Set the search result (used for direct navigation or testing).
 * @param {Object|null} participant
 */
export function setSearchResult(participant) {
  currentParticipant = participant;
}

/**
 * Render the search page HTML into the given container.
 * @param {HTMLElement} container - the DOM element to render into
 */
export function renderSearch(container) {
  container.innerHTML = `
    <div class="search-page" id="search-page">
      <div class="awning"></div>
      <div class="search-container">
        <div class="logo-area">
          <img src="/assets/logo-placeholder.svg" alt="Talad Thai Logo" class="logo" id="logo-img" />
          <h1 class="title">ตลาดไทครบรอบ 30 ปี</h1>
          <p class="subtitle">ระบบตรวจสอบผู้ค้า</p>
        </div>
        <div class="search-box">
          <input
            type="text"
            id="search-input"
            class="search-input"
            placeholder="กรอกชื่อ-สกุล, เบอร์โทร หรือ เลขที่โต๊ะ"
            autocomplete="off"
          />
          <button id="search-btn" class="search-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            ตรวจสอบสิทธิ์
          </button>
        </div>
        <div id="search-error" class="search-error" role="alert"></div>
        <div id="search-loading" class="search-loading hidden">
          <div class="spinner"></div>
          <span>กำลังตรวจสอบ...</span>
        </div>
        <div id="search-results" class="search-results hidden"></div>
      </div>
      <div class="fruit-decoration"></div>
    </div>
  `;

  bindSearchEvents(container);
}

/**
 * Bind click and keypress events for the search form.
 * @param {HTMLElement} container
 */
function bindSearchEvents(container) {
  const input = container.querySelector('#search-input');
  const btn = container.querySelector('#search-btn');
  const errorEl = container.querySelector('#search-error');

  btn.addEventListener('click', () => handleSearch(container));

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleSearch(container);
    }
  });

  input.addEventListener('input', () => {
    errorEl.textContent = '';
    errorEl.classList.remove('shake');
    // Hide results when user types
    const resultsEl = container.querySelector('#search-results');
    if (resultsEl) {
      resultsEl.classList.add('hidden');
      resultsEl.innerHTML = '';
    }
  });
}

/**
 * Handle the search action — validate, search cache, check real-time status, navigate.
 * @param {HTMLElement} container
 */
async function handleSearch(container) {
  const input = container.querySelector('#search-input');
  const errorEl = container.querySelector('#search-error');
  const loadingEl = container.querySelector('#search-loading');
  const btn = container.querySelector('#search-btn');
  const resultsEl = container.querySelector('#search-results');

  const query = input.value.trim();

  // Validation
  if (!query) {
    showError(errorEl, 'กรุณากรอกชื่อ-สกุล, เบอร์โทร หรือ เลขที่โต๊ะ');
    return;
  }

  // Hide previous results
  resultsEl.classList.add('hidden');
  resultsEl.innerHTML = '';

  // Search in cache
  const result = search(query);

  if (!result) {
    showError(errorEl, 'ไม่พบข้อมูลผู้ค้า');
    return;
  }

  // Multiple name matches — show list for user to pick
  if (result.type === 'multiple') {
    renderSearchResults(container, result.participants);
    return;
  }

  // Single match — check real-time status and navigate
  await navigateToParticipant(container, result.participant);
}

/**
 * Render a list of search results for the user to select from.
 * @param {HTMLElement} container
 * @param {Array} matches - array of participant objects
 */
function renderSearchResults(container, matches) {
  const resultsEl = container.querySelector('#search-results');

  const count = matches.length;
  let html = `<div class="results-header">พบ ${count} รายการ — กรุณาเลือก</div>`;

  matches.forEach((p, index) => {
    const name = escapeHtml(String(p['ชื่อผู้ค้า'] || ''));
    const market = escapeHtml(String(p['ตลาด'] || ''));
    const shop = escapeHtml(String(p['ชื่อร้าน'] || ''));
    const table = escapeHtml(String(p['เลขที่โต๊ะ'] || '-'));
    const seq = escapeHtml(String(p['ลำดับ'] || ''));

    html += `
      <button class="search-result-item" data-result-index="${index}">
        <div class="result-name">${name}</div>
        <div class="result-details">
          <span class="result-market">${market}</span>
          ${shop ? `<span class="result-shop">ร้าน ${shop}</span>` : ''}
          <span class="result-table">โต๊ะ ${table}</span>
        </div>
      </button>
    `;
  });

  resultsEl.innerHTML = html;
  resultsEl.classList.remove('hidden');

  // Bind click events on result items
  resultsEl.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', async () => {
      const idx = parseInt(item.dataset.resultIndex);
      const selected = matches[idx];
      await navigateToParticipant(container, selected);
    });
  });
}

/**
 * Check real-time status for a participant and navigate to info page.
 * @param {HTMLElement} container
 * @param {Object} participant
 */
async function navigateToParticipant(container, participant) {
  const loadingEl = container.querySelector('#search-loading');
  const btn = container.querySelector('#search-btn');
  const resultsEl = container.querySelector('#search-results');

  loadingEl.classList.remove('hidden');
  btn.disabled = true;

  try {
    const statusData = await checkStatus(participant._docId);
    participant['สถานะการเข้างาน'] = statusData.status;
    if (statusData.approvedAt) {
      participant['เวลาอนุมัติ'] = statusData.approvedAt;
    }
    currentParticipant = participant;
    navigate('#/info');
  } catch (error) {
    // Use cached status if real-time check fails
    currentParticipant = participant;
    navigate('#/info');
  } finally {
    loadingEl.classList.add('hidden');
    btn.disabled = false;
  }
}

/**
 * Show an error message with shake animation.
 * @param {HTMLElement} errorEl
 * @param {string} message
 */
function showError(errorEl, message) {
  errorEl.textContent = message;
  errorEl.classList.remove('shake');
  // Force reflow for re-triggering animation
  void errorEl.offsetWidth;
  errorEl.classList.add('shake');
}

/**
 * Escape HTML to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
