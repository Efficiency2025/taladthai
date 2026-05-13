import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockParticipants } from '../setup.js';

vi.mock('../../src/services/cache.js', () => ({ search: vi.fn() }));
vi.mock('../../src/services/api.js', () => ({ checkStatus: vi.fn() }));
vi.mock('../../src/router.js', () => ({ navigate: vi.fn() }));

import { renderSearch, setSearchResult, getSearchResult } from '../../src/pages/search.js';
import { search } from '../../src/services/cache.js';
import { checkStatus } from '../../src/services/api.js';
import { navigate } from '../../src/router.js';

describe('Search Page', () => {
  let container;
  beforeEach(() => {
    container = document.getElementById('app');
    vi.clearAllMocks();
    setSearchResult(null);
  });

  it('renders search page HTML', () => {
    renderSearch(container);
    expect(container.querySelector('.search-page')).not.toBeNull();
    expect(container.querySelector('#search-input')).not.toBeNull();
    expect(container.querySelector('#search-btn')).not.toBeNull();
  });

  it('input has correct placeholder', () => {
    renderSearch(container);
    expect(container.querySelector('#search-input').placeholder).toBe('กรอกชื่อ-สกุล, เบอร์โทร หรือ เลขที่โต๊ะ');
  });

  it('valid phone navigates to #/info', async () => {
    renderSearch(container);
    const mockParticipants = createMockParticipants();
    const p = { ...mockParticipants.participants[0], _docId: 'doc-1' };
    search.mockReturnValue({ type: 'single', participant: p });
    checkStatus.mockResolvedValue({ status: 'รออนุมัติเข้างาน', approvedAt: '' });
    container.querySelector('#search-input').value = '0814379081';
    container.querySelector('#search-btn').click();
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('#/info'));
  });

  it('no match shows error', () => {
    renderSearch(container);
    search.mockReturnValue(null);
    container.querySelector('#search-input').value = '9999999999';
    container.querySelector('#search-btn').click();
    expect(container.querySelector('#search-error').textContent).toBe('ไม่พบข้อมูลผู้ค้า');
  });

  it('empty input shows validation error', () => {
    renderSearch(container);
    container.querySelector('#search-btn').click();
    expect(container.querySelector('#search-error').textContent).toBe('กรุณากรอกชื่อ-สกุล, เบอร์โทร หรือ เลขที่โต๊ะ');
  });

  it('Enter key triggers search', () => {
    renderSearch(container);
    search.mockReturnValue(null);
    const input = container.querySelector('#search-input');
    input.value = '9999999999';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(container.querySelector('#search-error').textContent).toBe('ไม่พบข้อมูลผู้ค้า');
  });

  it('error clears on new input', () => {
    renderSearch(container);
    search.mockReturnValue(null);
    const input = container.querySelector('#search-input');
    input.value = '9999999999';
    container.querySelector('#search-btn').click();
    expect(container.querySelector('#search-error').textContent).toBe('ไม่พบข้อมูลผู้ค้า');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(container.querySelector('#search-error').textContent).toBe('');
  });

  it('shows loading during status check', async () => {
    renderSearch(container);
    const mockParticipants = createMockParticipants();
    const p = { ...mockParticipants.participants[0], _docId: 'doc-1' };
    search.mockReturnValue({ type: 'single', participant: p });
    let resolve;
    checkStatus.mockReturnValue(new Promise(r => { resolve = r; }));
    container.querySelector('#search-input').value = '0814379081';
    container.querySelector('#search-btn').click();
    expect(container.querySelector('#search-loading').classList.contains('hidden')).toBe(false);
    resolve({ status: 'รออนุมัติเข้างาน', approvedAt: '' });
    await vi.waitFor(() => expect(container.querySelector('#search-loading').classList.contains('hidden')).toBe(true));
  });

  it('getSearchResult() returns current result', () => {
    expect(getSearchResult()).toBeNull();
    const p = { name: 'test' };
    setSearchResult(p);
    expect(getSearchResult()).toEqual(p);
  });

  it('falls back to cached status when checkStatus fails', async () => {
    renderSearch(container);
    const mockParticipants = createMockParticipants();
    const p = { ...mockParticipants.participants[0], _docId: 'doc-1', 'สถานะการเข้างาน': 'รออนุมัติเข้างาน' };
    search.mockReturnValue({ type: 'single', participant: p });
    checkStatus.mockRejectedValue(new Error('Network error'));

    container.querySelector('#search-input').value = '0814379081';
    container.querySelector('#search-btn').click();

    await vi.waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('#/info');
    });
    expect(getSearchResult()).not.toBeNull();
  });

  it('updates participant status from real-time check', async () => {
    renderSearch(container);
    const mockParticipants = createMockParticipants();
    const p = { ...mockParticipants.participants[0], _docId: 'doc-1', 'สถานะการเข้างาน': 'รออนุมัติเข้างาน' };
    search.mockReturnValue({ type: 'single', participant: p });
    checkStatus.mockResolvedValue({ status: 'อนุมัติแล้ว', approvedAt: '06/05/2026 10:30:00' });

    container.querySelector('#search-input').value = '0814379081';
    container.querySelector('#search-btn').click();

    await vi.waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('#/info');
    });
    const result = getSearchResult();
    expect(result['สถานะการเข้างาน']).toBe('อนุมัติแล้ว');
    expect(result['เวลาอนุมัติ']).toBe('06/05/2026 10:30:00');
  });

  it('non-Enter key does not trigger search', () => {
    renderSearch(container);
    const input = container.querySelector('#search-input');
    input.value = '9999999999';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(container.querySelector('#search-error').textContent).toBe('');
  });

  it('multiple name matches renders result list', () => {
    renderSearch(container);
    const matches = [
      { 'ลำดับ': 1, 'ชื่อผู้ค้า': 'สมชาย ก', 'ตลาด': 'X', 'ชื่อร้าน': 'A', 'เลขที่โต๊ะ': 'A1', _docId: 'doc-a' },
      { 'ลำดับ': 2, 'ชื่อผู้ค้า': 'สมชาย ข', 'ตลาด': 'Y', 'ชื่อร้าน': 'B', 'เลขที่โต๊ะ': 'B2', _docId: 'doc-b' },
    ];
    search.mockReturnValue({ type: 'multiple', participants: matches });

    container.querySelector('#search-input').value = 'สมชาย';
    container.querySelector('#search-btn').click();

    const results = container.querySelector('#search-results');
    expect(results.classList.contains('hidden')).toBe(false);
    expect(results.querySelectorAll('.search-result-item').length).toBe(2);
    expect(results.querySelector('.results-header').textContent).toContain('2');
  });

  it('clicking a result item navigates to info', async () => {
    renderSearch(container);
    const matches = [
      { 'ลำดับ': 1, 'ชื่อผู้ค้า': 'สมชาย ก', 'ตลาด': 'X', 'ชื่อร้าน': '', 'เลขที่โต๊ะ': 'A1', _docId: 'doc-a' },
    ];
    search.mockReturnValue({ type: 'multiple', participants: matches });
    checkStatus.mockResolvedValue({ status: 'รออนุมัติเข้างาน', approvedAt: '' });

    container.querySelector('#search-input').value = 'สมชาย';
    container.querySelector('#search-btn').click();

    const firstItem = container.querySelector('.search-result-item');
    firstItem.click();

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('#/info'));
  });

  it('typing into input hides existing results panel', () => {
    renderSearch(container);
    // First show results
    const matches = [
      { 'ลำดับ': 1, 'ชื่อผู้ค้า': 'สมชาย ก', 'ตลาด': 'X', 'ชื่อร้าน': 'Shop', 'เลขที่โต๊ะ': 'A1', _docId: 'doc-a' },
      { 'ลำดับ': 2, 'ชื่อผู้ค้า': 'สมชาย ข', 'ตลาด': 'Y', 'ชื่อร้าน': 'Shop2', 'เลขที่โต๊ะ': 'B2', _docId: 'doc-b' },
    ];
    search.mockReturnValue({ type: 'multiple', participants: matches });
    container.querySelector('#search-input').value = 'สมชาย';
    container.querySelector('#search-btn').click();

    const resultsEl = container.querySelector('#search-results');
    expect(resultsEl.classList.contains('hidden')).toBe(false);

    // Now simulate the user typing again
    const input = container.querySelector('#search-input');
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // Results should be hidden and cleared
    expect(resultsEl.classList.contains('hidden')).toBe(true);
    expect(resultsEl.innerHTML).toBe('');
  });

  it('renderSearchResults handles participants with missing optional fields', () => {
    renderSearch(container);
    const matches = [
      // No ชื่อผู้ค้า, no ชื่อร้าน, no เลขที่โต๊ะ
      { 'ลำดับ': 1, 'ตลาด': 'X', _docId: 'doc-empty' },
    ];
    search.mockReturnValue({ type: 'multiple', participants: matches });

    container.querySelector('#search-input').value = 'X';
    container.querySelector('#search-btn').click();

    const items = container.querySelectorAll('.search-result-item');
    expect(items.length).toBe(1);
    // Name defaults to empty, table defaults to '-', shop span is omitted
    const item = items[0];
    expect(item.querySelector('.result-name').textContent).toBe('');
    // No shop span should be rendered when ชื่อร้าน is absent
    expect(item.querySelector('.result-shop')).toBeNull();
    // Table badge defaults to '-'
    expect(item.querySelector('.result-table').textContent).toContain('-');
  });

  it('input event clears error and hides results panel (resultsEl truthy branch)', () => {
    // The #search-results div is always in the template (just hidden).
    // This test covers the if (resultsEl) true branch: it adds 'hidden' and clears innerHTML.
    renderSearch(container);
    const resultsEl = container.querySelector('#search-results');
    // Simulate results being shown first
    resultsEl.classList.remove('hidden');
    resultsEl.innerHTML = '<div class="search-result-item">dummy</div>';
    expect(resultsEl.classList.contains('hidden')).toBe(false);

    const input = container.querySelector('#search-input');
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // After input event: error cleared, results hidden and emptied
    expect(container.querySelector('#search-error').textContent).toBe('');
    expect(resultsEl.classList.contains('hidden')).toBe(true);
    expect(resultsEl.innerHTML).toBe('');
  });

  it('renderSearchResults renders correctly when ตลาด is missing', () => {
    // Tests the || '' fallback branch for ตลาด (L150)
    renderSearch(container);
    const matches = [
      // No ตลาด field at all
      { 'ลำดับ': 1, 'ชื่อผู้ค้า': 'ผู้ค้าทดสอบ', 'ชื่อร้าน': 'ShopX', 'เลขที่โต๊ะ': 'A1', _docId: 'doc-z' },
    ];
    search.mockReturnValue({ type: 'multiple', participants: matches });

    container.querySelector('#search-input').value = 'ผู้ค้า';
    container.querySelector('#search-btn').click();

    const items = container.querySelectorAll('.search-result-item');
    expect(items.length).toBe(1);
    // ตลาด defaults to '' so result-market is empty text
    expect(items[0].querySelector('.result-market').textContent).toBe('');
  });

  it('renderSearchResults renders correctly when ลำดับ is missing (L153 || branch)', () => {
    // Tests the `|| ''` fallback branch for ลำดับ (search.js L153)
    renderSearch(container);
    const matches = [
      // No ลำดับ field at all
      { 'ชื่อผู้ค้า': 'ผู้ค้าไร้ลำดับ', 'ตลาด': 'ตลาด X', 'ชื่อร้าน': '', 'เลขที่โต๊ะ': 'B2', _docId: 'doc-noseq' },
    ];
    search.mockReturnValue({ type: 'multiple', participants: matches });

    container.querySelector('#search-input').value = 'ผู้ค้า';
    container.querySelector('#search-btn').click();

    const items = container.querySelectorAll('.search-result-item');
    expect(items.length).toBe(1);
    // Should render without errors even with no ลำดับ
    expect(items[0].querySelector('.result-name').textContent).toBe('ผู้ค้าไร้ลำดับ');
  });
});
