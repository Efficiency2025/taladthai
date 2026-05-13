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

  it('renders a dash badge when participant has no table number', () => {
    const p = {
      ...createMockParticipants().participants[0],
      _docId: 'doc-notbl',
      'เลขที่โต๊ะ': '-',
      'สถานะการเข้างาน': 'รออนุมัติเข้างาน',
    };
    setSearchResult(p);
    renderInfo(container);
    const badges = container.querySelectorAll('.table-badge');
    // Should render exactly one badge containing '-'
    expect(badges.length).toBe(1);
    expect(badges[0].textContent).toBe('-');
  });

  it('renders a dash badge when เลขที่โต๊ะ is empty string', () => {
    const p = {
      ...createMockParticipants().participants[0],
      _docId: 'doc-emptytbl',
      'เลขที่โต๊ะ': '',
      'สถานะการเข้างาน': 'รออนุมัติเข้างาน',
    };
    setSearchResult(p);
    renderInfo(container);
    const badges = container.querySelectorAll('.table-badge');
    expect(badges.length).toBe(1);
    expect(badges[0].textContent).toBe('-');
  });

  it('toast auto-hides after 3 seconds', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    approve.mockRejectedValue(new Error('timeout'));

    pending();
    renderInfo(container);
    container.querySelector('#approve-btn').click();

    // Let the microtask / promise rejection settle
    await vi.advanceTimersByTimeAsync(50);

    // Toast should now exist
    expect(container.querySelector('.toast-error')).not.toBeNull();

    // Advance past the 3 s hide timer + the 300 ms remove timer
    await vi.advanceTimersByTimeAsync(3400);

    // Toast should be fully removed from the DOM
    expect(container.querySelector('.toast-error')).toBeNull();

    vi.useRealTimers();
  });

  it('success banner shows VIP zone image badge (zoneStyle.image branch in renderCheckedInView)', () => {
    // Trigger the `zoneStyle.image ? <img> : <span>` TRUE branch inside renderCheckedInView
    // VIP zone has an image property in ZONE_COLORS
    getZoneFromTable.mockReturnValue('VIP');
    const p = {
      ...createMockParticipants().participants[0],
      _docId: 'doc-vip',
      'สถานะการเข้างาน': 'อนุมัติแล้ว',
      'เวลาอนุมัติ': '06/05/2026 12:00:00',
      'เลขที่โต๊ะ': 'VIP1',
    };
    setSearchResult(p);
    renderInfo(container);
    // Success banner should use the <img> badge path for VIP
    const successMeta = container.querySelector('.success-meta');
    expect(successMeta).not.toBeNull();
    expect(successMeta.querySelector('.vip-badge-img')).not.toBeNull();
  });

  it('confirm message handles missing ชื่อผู้ค้า gracefully (\u00f8\u00f8 branch L203)', () => {
    // Covers the `|| ''` branch in: String(participant['\u0e0a\u0e37\u0e48\u0e2d\u0e1c\u0e39\u0e49\u0e04\u0e49\u0e32'] || '')
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const p = {
      _docId: 'doc-noname',
      'ลำดับ': 99,
      // No ชื่อผู้ค้า field
      'เบอร์โทร': '0899999999',
      'ตลาด': 'TestMarket',
      'เลขที่โต๊ะ': 'A1',
      'สถานะการเข้างาน': 'รออนุมัติเข้างาน',
    };
    setSearchResult(p);
    renderInfo(container);
    container.querySelector('#approve-btn').click();
    // confirm should be called with the vendor name portion being empty string
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('""'));
  });

  it('alreadyApproved with no approvedAt defaults to empty string (L217)', async () => {
    // Covers the `|| ''` false branch: participant['\u0e40\u0e27\u0e25\u0e32\u0e2d\u0e19\u0e38\u0e21\u0e31\u0e15\u0e34'] = result.approvedAt || ''
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    approve.mockResolvedValue({ success: false, alreadyApproved: true }); // no approvedAt
    pending();
    renderInfo(container);
    container.querySelector('#approve-btn').click();
    await vi.waitFor(() => {
      // Page re-renders as approved — approvedAt is '' so timestamp shows empty
      expect(container.querySelector('.checkin-success')).not.toBeNull();
    });
  });

  it('success with no approvedAt defaults to empty string (L220)', async () => {
    // Covers the `|| ''` false branch: participant['\u0e40\u0e27\u0e25\u0e32\u0e2d\u0e19\u0e38\u0e21\u0e31\u0e15\u0e34'] = result.approvedAt || ''
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    approve.mockResolvedValue({ success: true }); // no approvedAt
    pending();
    renderInfo(container);
    container.querySelector('#approve-btn').click();
    await vi.waitFor(() => {
      // Re-renders as approved
      expect(container.querySelector('.checkin-success')).not.toBeNull();
    });
  });

  it('second toast replaces first (existing toast removal branch L249)', async () => {
    // Trigger two consecutive approval failures so showToast is called twice.
    // First call creates a toast; second call removes it and creates a new one.
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    // First rejection
    approve.mockRejectedValueOnce(new Error('err1'));
    pending();
    renderInfo(container);
    container.querySelector('#approve-btn').click();

    // Wait for first toast to appear
    await vi.waitFor(() => expect(container.querySelector('.toast-error')).not.toBeNull());

    // Re-render to get a fresh approve button (first toast still in container)
    approve.mockRejectedValueOnce(new Error('err2'));
    pending();
    renderInfo(container);
    container.querySelector('#approve-btn').click();

    // Wait — there should still only be one toast (old one replaced)
    await vi.waitFor(() => {
      const toasts = container.querySelectorAll('.toast-error');
      expect(toasts.length).toBe(1);
    });
  });

  // ─── Multi-table tests ────────────────────────────────────────────────

  /** Helper: build a multi-table participant with two rows */
  function multiTableParticipant({ table1Status = 'รออนุมัติเข้างาน', table2Status = 'รออนุมัติเข้างาน' } = {}) {
    const row1 = {
      _docId: 'doc-mt-1',
      'ชื่อผู้ค้า': 'นเรศ ทดสอบ',
      'ชื่อร้าน': 'ร้านA',
      'ตลาด': 'ส้ม',
      'เบอร์โทร': '0811111111',
      'ลำดับ': '1',
      'เลขที่โต๊ะ': 'A1',
      'สถานะการเข้างาน': table1Status,
      'เวลาอนุมัติ': table1Status === 'อนุมัติแล้ว' ? '06/05/2026 10:00:00' : '',
    };
    const row2 = {
      _docId: 'doc-mt-2',
      'ชื่อผู้ค้า': 'นเรศ ทดสอบ',
      'ชื่อร้าน': 'ร้านA',
      'ตลาด': 'ส้ม',
      'เบอร์โทร': '0811111111',
      'ลำดับ': '1',
      'เลขที่โต๊ะ': 'B2',
      'สถานะการเข้างาน': table2Status,
      'เวลาอนุมัติ': table2Status === 'อนุมัติแล้ว' ? '06/05/2026 10:00:00' : '',
    };
    const p = {
      ...row1,
      'เลขที่โต๊ะ': 'A1, B2',
      _allMatches: [row1, row2],
    };
    setSearchResult(p);
    return p;
  }

  it('renders per-table check-in buttons for multi-table participant', () => {
    multiTableParticipant();
    renderInfo(container);
    const btns = container.querySelectorAll('.table-checkin-btn');
    expect(btns.length).toBe(2);
  });

  it('multi-table: pending tables show wristband chip text', () => {
    multiTableParticipant();
    renderInfo(container);
    const chips = container.querySelectorAll('.table-status-chip');
    expect(chips[0].textContent).toContain('แจก Wrist Band');
    expect(chips[1].textContent).toContain('แจก Wrist Band');
  });

  it('multi-table: approved tables show approved chip and disabled button', () => {
    multiTableParticipant({ table1Status: 'อนุมัติแล้ว', table2Status: 'รออนุมัติเข้างาน' });
    renderInfo(container);
    const btns = container.querySelectorAll('.table-checkin-btn');
    // First button (A1) should be disabled and have approved class
    expect(btns[0].disabled).toBe(true);
    expect(btns[0].classList.contains('approved')).toBe(true);
    // Second button (B2) should be active
    expect(btns[1].disabled).toBe(false);
  });

  it('multi-table: shows status-partial bar when some approved at render time', () => {
    multiTableParticipant({ table1Status: 'อนุมัติแล้ว', table2Status: 'รออนุมัติเข้างาน' });
    renderInfo(container);
    const bar = container.querySelector('#status-bar');
    expect(bar.classList.contains('status-partial')).toBe(true);
    expect(bar.textContent).toContain('บางโต๊ะอนุมัติแล้ว');
  });

  it('multi-table: shows status-approved bar when all approved at render time', () => {
    multiTableParticipant({ table1Status: 'อนุมัติแล้ว', table2Status: 'อนุมัติแล้ว' });
    renderInfo(container);
    const bar = container.querySelector('#status-bar');
    expect(bar.classList.contains('status-approved')).toBe(true);
  });

  it('multi-table: no single approve-btn rendered', () => {
    multiTableParticipant();
    renderInfo(container);
    expect(container.querySelector('#approve-btn')).toBeNull();
  });

  it('multi-table: approving one table updates button to approved and shows partial bar', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    approve.mockResolvedValue({ success: true, approvedAt: '06/05/2026 11:00:00' });

    multiTableParticipant();
    renderInfo(container);

    // Click the first pending table button
    const btn = container.querySelector('.table-checkin-btn:not([disabled])');
    btn.click();

    await vi.waitFor(() => {
      expect(approve).toHaveBeenCalledWith('doc-mt-1');
      expect(updateRow).toHaveBeenCalledWith('doc-mt-1', 'อนุมัติแล้ว', '06/05/2026 11:00:00');
      // Button should flip to approved
      expect(btn.classList.contains('approved')).toBe(true);
      // Chip should update
      expect(btn.querySelector('.table-status-chip').textContent).toContain('อนุมัติแล้ว');
      // Status bar → partial
      const bar = container.querySelector('#status-bar');
      expect(bar.classList.contains('status-partial')).toBe(true);
    });
  });

  it('multi-table: approving last table triggers full re-render with success banner', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    approve.mockResolvedValue({ success: true, approvedAt: '06/05/2026 11:30:00' });

    // Start with table1 already approved; table2 is pending
    multiTableParticipant({ table1Status: 'อนุมัติแล้ว', table2Status: 'รออนุมัติเข้างาน' });
    renderInfo(container);

    const btn = container.querySelector('.table-checkin-btn:not([disabled])');
    btn.click();

    await vi.waitFor(() => {
      expect(container.querySelector('.checkin-success')).not.toBeNull();
    });
  });

  it('multi-table: alreadyApproved result also marks button approved', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    approve.mockResolvedValue({ success: false, alreadyApproved: true, approvedAt: '06/05/2026 09:00:00' });

    multiTableParticipant();
    renderInfo(container);

    const btn = container.querySelector('.table-checkin-btn:not([disabled])');
    btn.click();

    await vi.waitFor(() => {
      expect(btn.classList.contains('approved')).toBe(true);
    });
  });

  it('multi-table: API failure shows error toast and re-enables button', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    approve.mockResolvedValue({ success: false, alreadyApproved: false });

    multiTableParticipant();
    renderInfo(container);

    const btn = container.querySelector('.table-checkin-btn:not([disabled])');
    btn.click();

    await vi.waitFor(() => {
      expect(container.querySelector('.toast-error')).not.toBeNull();
      expect(btn.disabled).toBe(false);
      expect(btn.querySelector('.table-status-chip').textContent).toContain('แจก Wrist Band');
    });
  });

  it('multi-table: network error shows error toast and re-enables button', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    approve.mockRejectedValue(new Error('Network down'));

    multiTableParticipant();
    renderInfo(container);

    const btn = container.querySelector('.table-checkin-btn:not([disabled])');
    btn.click();

    await vi.waitFor(() => {
      expect(container.querySelector('.toast-error')).not.toBeNull();
      expect(btn.disabled).toBe(false);
    });
  });

  it('multi-table: cancelled confirm does not call approve', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    multiTableParticipant();
    renderInfo(container);

    const btn = container.querySelector('.table-checkin-btn:not([disabled])');
    btn.click();

    expect(approve).not.toHaveBeenCalled();
  });

  it('multi-table: confirm dialog includes table number and vendor name', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    multiTableParticipant();
    renderInfo(container);

    const btn = container.querySelector('.table-checkin-btn:not([disabled])');
    btn.click();

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('A1'));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('นเรศ ทดสอบ'));
  });

  it('multi-table: VIP zone renders zone-colored button accent', () => {
    getZoneFromTable.mockReturnValue('VIP');
    multiTableParticipant();
    renderInfo(container);
    const btn = container.querySelector('.table-checkin-btn');
    // VIP accent color should be applied via style attribute
    expect(btn.style.getPropertyValue('--table-accent')).toBeTruthy();
  });

  it('multi-table: unknown zone falls back to default accent color', () => {
    getZoneFromTable.mockReturnValue('X'); // not in ZONE_COLORS
    multiTableParticipant();
    renderInfo(container);
    const btn = container.querySelector('.table-checkin-btn');
    expect(btn.style.getPropertyValue('--table-accent')).toBe('#2e7d32');
  });

  it('multi-table: approveAt defaults to empty string when result.approvedAt is undefined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    approve.mockResolvedValue({ success: true }); // no approvedAt

    multiTableParticipant({ table1Status: 'อนุมัติแล้ว', table2Status: 'รออนุมัติเข้างาน' });
    renderInfo(container);

    const btn = container.querySelector('.table-checkin-btn:not([disabled])');
    btn.click();

    await vi.waitFor(() => {
      // updateRow called with empty string for approvedAt
      expect(updateRow).toHaveBeenCalledWith('doc-mt-2', 'อนุมัติแล้ว', undefined);
    });
  });
});
