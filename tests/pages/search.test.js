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
});
