import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockParticipants } from '../setup.js';

vi.mock('../../src/services/api.js', () => ({ approve: vi.fn(), checkStatus: vi.fn() }));
vi.mock('../../src/services/cache.js', () => ({
  updateRow: vi.fn(),
  getBoothInfo: vi.fn(),
  getZoneFromTable: vi.fn(),
}));
vi.mock('../../src/router.js', () => ({ navigate: vi.fn() }));

import { renderInfo } from '../../src/pages/info.js';
import { setSearchResult } from '../../src/pages/search.js';
import { approve } from '../../src/services/api.js';
import { updateRow, getBoothInfo, getZoneFromTable } from '../../src/services/cache.js';
import { navigate } from '../../src/router.js';

describe('Info Page', () => {
  let container;
  beforeEach(() => {
    container = document.getElementById('app');
    vi.clearAllMocks();
    // Default booth/zone mocks
    getBoothInfo.mockReturnValue({ 'บูธลงทะเบียน': '1,2', 'จำนวนที่นั่ง': 344 });
    getZoneFromTable.mockReturnValue('A');
  });

  const mockParticipants = () => createMockParticipants();

  const pending = () => {
    const p = {
      ...mockParticipants().participants[0],
      _docId: 'doc-pending-1',
      'สถานะการเข้างาน': 'รออนุมัติเข้างาน',
    };
    setSearchResult(p);
    return p;
  };

  const approved = () => {
    const p = {
      ...mockParticipants().participants[1],
      _docId: 'doc-approved-1',
      'สถานะการเข้างาน': 'อนุมัติแล้ว',
      'เวลาอนุมัติ': '06/05/2026 10:30:00',
    };
    setSearchResult(p);
    return p;
  };

  it('renders participant info card', () => {
    pending();
    renderInfo(container);
    expect(container.querySelector('.info-card')).not.toBeNull();
    expect(container.querySelector('.info-name').textContent).toContain('นเรศ');
  });

  it('shows booth registration number', () => {
    pending();
    renderInfo(container);
    const boothVal = container.querySelector('.booth-value');
    expect(boothVal).not.toBeNull();
    expect(boothVal.textContent).toContain('1,2');
  });

  it('shows zone badge', () => {
    pending();
    renderInfo(container);
    const zoneBadge = container.querySelector('.zone-badge');
    expect(zoneBadge).not.toBeNull();
    expect(zoneBadge.textContent).toContain('โซน A');
  });

  it('shows table number badges', () => {
    pending();
    renderInfo(container);
    const badges = container.querySelectorAll('.table-badge');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('shows approve button when pending', () => {
    pending();
    renderInfo(container);
    const btn = container.querySelector('#approve-btn');
    expect(btn).not.toBeNull();
    expect(btn.textContent).toContain('แจก Wrist Band');
  });

  it('hides approve button when already approved', () => {
    approved();
    renderInfo(container);
    expect(container.querySelector('#approve-btn')).toBeNull();
  });

  it('shows success banner when approved', () => {
    approved();
    renderInfo(container);
    expect(container.querySelector('.checkin-success')).not.toBeNull();
    expect(container.querySelector('.success-title').textContent).toContain('เข้าร่วมงานเรียบร้อย');
  });

  it('shows approved timestamp', () => {
    approved();
    renderInfo(container);
    const ts = container.querySelector('.approved-timestamp');
    expect(ts).not.toBeNull();
    expect(ts.textContent).toContain('06/05/2026 10:30:00');
  });

  it('approve click calls api.approve with _docId and re-renders', async () => {
    // Mock window.confirm
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    approve.mockResolvedValue({ success: true, approvedAt: '06/05/2026 11:00:00' });

    pending();
    renderInfo(container);
    container.querySelector('#approve-btn').click();

    await vi.waitFor(() => {
      expect(approve).toHaveBeenCalledWith('doc-pending-1');
      expect(updateRow).toHaveBeenCalled();
      // Should re-render with success view
      expect(container.querySelector('.checkin-success')).not.toBeNull();
    });
  });

  it('race condition re-renders as approved', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    approve.mockResolvedValue({ success: false, alreadyApproved: true, approvedAt: '06/05/2026 10:55:00' });

    pending();
    renderInfo(container);
    container.querySelector('#approve-btn').click();

    await vi.waitFor(() => {
      // After race condition, page re-renders as approved (checkin success banner visible)
      expect(container.querySelector('.checkin-success')).not.toBeNull();
      expect(container.querySelector('.success-title').textContent).toContain('เข้าร่วมงานเรียบร้อย');
    });
  });

  it('network error shows error toast', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    approve.mockRejectedValue(new Error('Network error'));

    pending();
    renderInfo(container);
    container.querySelector('#approve-btn').click();

    await vi.waitFor(() => {
      const toast = container.querySelector('.toast-error');
      expect(toast).not.toBeNull();
      expect(toast.textContent).toContain('เกิดข้อผิดพลาด');
    });
  });

  it('confirm cancel does not call approve', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    pending();
    renderInfo(container);
    container.querySelector('#approve-btn').click();

    expect(approve).not.toHaveBeenCalled();
  });

  it('back button navigates to #/search', () => {
    pending();
    renderInfo(container);
    container.querySelector('#back-btn').click();
    expect(navigate).toHaveBeenCalledWith('#/search');
  });

  it('redirects to search if no participant set', () => {
    setSearchResult(null);
    renderInfo(container);
    expect(navigate).toHaveBeenCalledWith('#/search');
  });

  it('handles missing booth info gracefully', () => {
    getBoothInfo.mockReturnValue(null);
    pending();
    renderInfo(container);
    const boothVal = container.querySelector('.booth-value');
    expect(boothVal.textContent).toBe('-');
  });

  it('handles no zone gracefully', () => {
    getZoneFromTable.mockReturnValue('');
    pending();
    renderInfo(container);
    // Zone badge should not appear
    const zoneBadge = container.querySelector('.zone-badge');
    expect(zoneBadge).toBeNull();
  });

  it('approve failure re-enables button', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    approve.mockResolvedValue({ success: false, alreadyApproved: false });

    pending();
    renderInfo(container);
    container.querySelector('#approve-btn').click();

    await vi.waitFor(() => {
      const btn = container.querySelector('#approve-btn');
      expect(btn).not.toBeNull();
      expect(btn.disabled).toBe(false);
    });
  });
});
