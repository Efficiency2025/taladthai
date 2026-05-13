/**
 * Cache service tests — covers search, loading, refresh, booth mapping,
 * zone extraction, name search, real-time sync, and edge cases.
 *
 * Now uses _docId instead of _rowIndex for Firestore document references.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockParticipants } from '../setup.js';

// Mock api module BEFORE importing cache
vi.mock('../../src/services/api.js', () => ({
  fetchAll: vi.fn(),
  subscribeToUpdates: vi.fn(),
}));

import {
  loadAll, search, updateRow, startAutoRefresh, stopAutoRefresh,
  startRealtimeSync, stopRealtimeSync,
  normalizePhone, normalizeThaiName, getParticipants,
  getBoothMapping, getBoothInfo, getZoneFromTable,
  _resetCache,
} from '../../src/services/cache.js';
import { fetchAll, subscribeToUpdates } from '../../src/services/api.js';

describe('Cache Service', () => {
  beforeEach(() => {
    _resetCache();
    vi.clearAllMocks();
    subscribeToUpdates.mockReturnValue(vi.fn()); // default unsub stub
  });

  // ===================== Loading =====================

  it('loadAll() fetches and stores participants + booth mapping', async () => {
    const mockData = createMockParticipants();
    fetchAll.mockResolvedValue(mockData);

    await loadAll();

    const result = search('0814379081');
    expect(result).not.toBeNull();
    expect(result.type).toBe('single');
    expect(result.participant['ชื่อผู้ค้า']).toBe('นเรศ ชัยประสิทธิ์กุล');
    expect(getBoothMapping().length).toBe(4);
  });

  it('loadAll() handles fetch error gracefully', async () => {
    fetchAll.mockRejectedValue(new Error('Network error'));
    await loadAll();
    const result = search('0814379081');
    expect(result).toBeNull();
  });

  it('loadAll() preserves existing cache on re-fetch failure', async () => {
    fetchAll.mockResolvedValue(createMockParticipants());
    await loadAll();
    expect(getParticipants().length).toBe(4);

    fetchAll.mockRejectedValue(new Error('Network error'));
    await loadAll();
    expect(getParticipants().length).toBe(4);
  });

  // ===================== Phone Search =====================

  it('search() finds by exact phone number', async () => {
    fetchAll.mockResolvedValue(createMockParticipants());
    await loadAll();

    const result = search('0891234567');
    expect(result).not.toBeNull();
    expect(result.type).toBe('single');
    expect(result.participant['ชื่อผู้ค้า']).toBe('สมชาย รุ่งเรือง');
  });

  it('search() finds phone in multi-phone cell', async () => {
    fetchAll.mockResolvedValue(createMockParticipants());
    await loadAll();

    const result = search('0818812911');
    expect(result).not.toBeNull();
    expect(result.participant['ชื่อผู้ค้า']).toBe('นเรศ ชัยประสิทธิ์กุล');
  });

  it('search() normalizes phone (strips dashes/spaces)', async () => {
    fetchAll.mockResolvedValue(createMockParticipants());
    await loadAll();

    const result = search('081-437-9081');
    expect(result).not.toBeNull();
    expect(result.participant['ชื่อผู้ค้า']).toBe('นเรศ ชัยประสิทธิ์กุล');
  });

  // ===================== เลขที่โต๊ะ Search =====================

  it('search() finds by เลขที่โต๊ะ (table number)', async () => {
    fetchAll.mockResolvedValue(createMockParticipants());
    await loadAll();

    const result = search('C10-1');
    expect(result).not.toBeNull();
    expect(result.participant['ชื่อผู้ค้า']).toBe('วิไล แซ่ลิ้ม');
  });

  it('search() finds by table number case-insensitively', async () => {
    fetchAll.mockResolvedValue(createMockParticipants());
    await loadAll();

    const result = search('c10-1');
    expect(result).not.toBeNull();
    expect(result.participant['ชื่อผู้ค้า']).toBe('วิไล แซ่ลิ้ม');
  });

  it('search() finds by comma-separated table number', async () => {
    fetchAll.mockResolvedValue(createMockParticipants());
    await loadAll();

    // นเรศ has tables: 'A141-1 , A141-2 , A141-3'
    const result = search('A141-2');
    expect(result).not.toBeNull();
    expect(result.participant['ชื่อผู้ค้า']).toBe('นเรศ ชัยประสิทธิ์กุล');
  });

  // ===================== Name Search =====================

  it('search() finds by exact name', async () => {
    fetchAll.mockResolvedValue(createMockParticipants());
    await loadAll();

    const result = search('สมชาย รุ่งเรือง');
    expect(result).not.toBeNull();
    expect(result.type).toBe('single');
    expect(result.participant['ชื่อผู้ค้า']).toBe('สมชาย รุ่งเรือง');
  });

  it('search() finds by partial name', async () => {
    fetchAll.mockResolvedValue(createMockParticipants());
    await loadAll();

    const result = search('วิไล');
    expect(result).not.toBeNull();
    expect(result.participant['ชื่อผู้ค้า']).toBe('วิไล แซ่ลิ้ม');
  });

  it('search() returns multiple results for ambiguous name', async () => {
    const data = {
      participants: [
        { 'ลำดับ': 1, 'ชื่อผู้ค้า': 'สมชาย ก', 'เบอร์โทร': '0811111111', 'ชื่อร้าน': 'A', 'ตลาด': 'X', 'เลขที่โต๊ะ': 'A1', 'สถานะการเข้างาน': '', _docId: 'doc-a' },
        { 'ลำดับ': 2, 'ชื่อผู้ค้า': 'สมชาย ข', 'เบอร์โทร': '0822222222', 'ชื่อร้าน': 'B', 'ตลาด': 'Y', 'เลขที่โต๊ะ': 'B2', 'สถานะการเข้างาน': '', _docId: 'doc-b' },
      ],
      boothMapping: [],
    };
    fetchAll.mockResolvedValue(data);
    await loadAll();

    const result = search('สมชาย');
    expect(result).not.toBeNull();
    expect(result.type).toBe('multiple');
    expect(result.participants.length).toBe(2);
  });

  it('search() merges tables in multiple-name-match when a person has >1 rows', async () => {
    // สมชาย ก has two rows (same name+phone = same person), สมชาย ข has one row
    // Both match partial name ‘สมชาย’ → type=multiple
    // The code at L245-248 runs for สมชาย ก because allRows.length > 1
    const data = {
      participants: [
        { 'ลำดับ': 1, 'ชื่อผู้ค้า': 'สมชาย ก', 'เบอร์โทร': '0811111111', 'ชื่อร้าน': 'A', 'ตลาด': 'X', 'เลขที่โต๊ะ': 'A1', 'สถานะการเข้างาน': '', _docId: 'doc-a1' },
        { 'ลำดับ': 2, 'ชื่อผู้ค้า': 'สมชาย ก', 'เบอร์โทร': '0811111111', 'ชื่อร้าน': 'A', 'ตลาด': 'X', 'เลขที่โต๊ะ': 'A2', 'สถานะการเข้างาน': '', _docId: 'doc-a2' },
        { 'ลำดับ': 3, 'ชื่อผู้ค้า': 'สมชาย ข', 'เบอร์โทร': '0822222222', 'ชื่อร้าน': 'B', 'ตลาด': 'Y', 'เลขที่โต๊ะ': 'B2', 'สถานะการเข้างาน': '', _docId: 'doc-b1' },
      ],
      boothMapping: [],
    };
    fetchAll.mockResolvedValue(data);
    await loadAll();

    const result = search('สมชาย');
    expect(result).not.toBeNull();
    expect(result.type).toBe('multiple');
    expect(result.participants.length).toBe(2);
    // สมชาย ก should have joined table numbers A1 , A2
    const somchaiK = result.participants.find(p => p['ชื่อผู้ค้า'] === 'สมชาย ก');
    expect(somchaiK['เลขที่โต๊ะ']).toBe('A1 , A2');
  });

  // ===================== Null/Empty =====================

  it('search() returns null for no match', async () => {
    fetchAll.mockResolvedValue(createMockParticipants());
    await loadAll();
    expect(search('9999999999')).toBeNull();
  });

  it('search() returns null when cache is empty', () => {
    expect(search('0814379081')).toBeNull();
  });

  it('search() returns null for null query', () => {
    expect(search(null)).toBeNull();
  });

  it('search() returns null for whitespace-only query', async () => {
    fetchAll.mockResolvedValue(createMockParticipants());
    await loadAll();
    expect(search('  ')).toBeNull();
  });

  it('search() returns null for empty string', async () => {
    fetchAll.mockResolvedValue(createMockParticipants());
    await loadAll();
    expect(search('')).toBeNull();
  });

  // ===================== Row Merging =====================

  it('search() merges table numbers when same phone matches multiple rows', async () => {
    const data = {
      participants: [
        { 'ลำดับ': 1, 'ชื่อผู้ค้า': 'Test Vendor', 'เบอร์โทร': '0811111111', 'ชื่อร้าน': 'Shop A', 'ตลาด': 'Market A', 'เลขที่โต๊ะ': 'A1', 'สถานะการเข้างาน': '', _docId: 'doc-1' },
        { 'ลำดับ': 2, 'ชื่อผู้ค้า': 'Test Vendor', 'เบอร์โทร': '0811111111', 'ชื่อร้าน': 'Shop A', 'ตลาด': 'Market A', 'เลขที่โต๊ะ': 'A2', 'สถานะการเข้างาน': '', _docId: 'doc-2' },
      ],
      boothMapping: [],
    };
    fetchAll.mockResolvedValue(data);
    await loadAll();

    const result = search('0811111111');
    expect(result).not.toBeNull();
    expect(result.participant['เลขที่โต๊ะ']).toBe('A1 , A2');
    expect(result.participant._allMatches.length).toBe(2);
  });

  it('search() merges table numbers filtering out empty entries', async () => {
    const data = {
      participants: [
        { 'ลำดับ': 10, 'ชื่อผู้ค้า': 'Multi', 'เบอร์โทร': '0877777777', 'ชื่อร้าน': 'X', 'ตลาด': 'X', 'เลขที่โต๊ะ': 'T1', 'สถานะการเข้างาน': '', _docId: 'doc-10' },
        { 'ลำดับ': 11, 'ชื่อผู้ค้า': 'Multi', 'เบอร์โทร': '0877777777', 'ชื่อร้าน': 'X', 'ตลาด': 'X', 'เลขที่โต๊ะ': '', 'สถานะการเข้างาน': '', _docId: 'doc-11' },
        { 'ลำดับ': 12, 'ชื่อผู้ค้า': 'Multi', 'เบอร์โทร': '0877777777', 'ชื่อร้าน': 'X', 'ตลาด': 'X', 'เลขที่โต๊ะ': 'T3', 'สถานะการเข้างาน': '', _docId: 'doc-12' },
      ],
      boothMapping: [],
    };
    fetchAll.mockResolvedValue(data);
    await loadAll();

    const result = search('0877777777');
    expect(result.participant['เลขที่โต๊ะ']).toBe('T1 , T3');
    expect(result.participant._allMatches.length).toBe(3);
  });

  // ===================== updateRow (by _docId) =====================

  it('updateRow() updates status by _docId in local cache', async () => {
    const data = createMockParticipants();
    data.participants = data.participants.map((p, i) => ({ ...p, _docId: `doc-${i}` }));
    fetchAll.mockResolvedValue(data);
    await loadAll();

    updateRow('doc-0', 'อนุมัติแล้ว', '06/05/2026 10:30:00');
    const result = search('A141-1');
    expect(result.participant['สถานะการเข้างาน']).toBe('อนุมัติแล้ว');
    expect(result.participant['เวลาอนุมัติ']).toBe('06/05/2026 10:30:00');
  });

  it('updateRow() updates status without approvedAt', async () => {
    const data = createMockParticipants();
    data.participants = data.participants.map((p, i) => ({ ...p, _docId: `doc-${i}` }));
    fetchAll.mockResolvedValue(data);
    await loadAll();

    updateRow('doc-0', 'อนุมัติแล้ว');
    const result = search('A141-1');
    expect(result.participant['สถานะการเข้างาน']).toBe('อนุมัติแล้ว');
  });

  it('updateRow() ignores non-existent docId', async () => {
    const data = createMockParticipants();
    data.participants = data.participants.map((p, i) => ({ ...p, _docId: `doc-${i}` }));
    fetchAll.mockResolvedValue(data);
    await loadAll();

    updateRow('non-existent-doc', 'อนุมัติแล้ว', '06/05/2026 10:30:00');
    const result = search('A141-1');
    expect(result.participant['สถานะการเข้างาน']).toBe('รออนุมัติเข้างาน');
  });

  // ===================== Realtime Sync =====================

  it('startRealtimeSync() calls subscribeToUpdates', () => {
    startRealtimeSync();
    expect(subscribeToUpdates).toHaveBeenCalled();
  });

  it('stopRealtimeSync() calls the unsubscribe function', () => {
    const unsubFn = vi.fn();
    subscribeToUpdates.mockReturnValue(unsubFn);

    startRealtimeSync();
    stopRealtimeSync();
    expect(unsubFn).toHaveBeenCalled();
  });

  it('stopRealtimeSync() is safe to call when no sync is running', () => {
    stopRealtimeSync();
    stopRealtimeSync();
  });

  it('startRealtimeSync() updates cache when callback is fired', () => {
    let syncCallback;
    subscribeToUpdates.mockImplementation((cb) => {
      syncCallback = cb;
      return vi.fn();
    });

    startRealtimeSync();

    // Simulate Firestore pushing new data
    syncCallback({
      participants: [
        { _docId: 'new-1', 'ลำดับ': 1, 'ชื่อผู้ค้า': 'New User', 'เบอร์โทร': '0999999999', 'ชื่อร้าน': 'X', 'ตลาด': 'X', 'เลขที่โต๊ะ': 'A1', 'สถานะการเข้างาน': '' },
      ],
      boothMapping: [],
    });

    expect(getParticipants().length).toBe(1);
    expect(getParticipants()[0]['ชื่อผู้ค้า']).toBe('New User');
  });

  // ===================== Auto Refresh (Legacy) =====================

  it('startAutoRefresh() calls loadAll periodically', async () => {
    vi.useFakeTimers();
    fetchAll.mockResolvedValue(createMockParticipants());

    startAutoRefresh(1000);
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchAll).toHaveBeenCalledTimes(3);

    stopAutoRefresh();
    vi.useRealTimers();
  });

  it('stopAutoRefresh() clears interval', async () => {
    vi.useFakeTimers();
    fetchAll.mockResolvedValue(createMockParticipants());

    startAutoRefresh(1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchAll).toHaveBeenCalledTimes(1);

    stopAutoRefresh();
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchAll).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('stopAutoRefresh() is safe to call when no refresh is running', () => {
    stopAutoRefresh();
    stopAutoRefresh();
  });

  // ===================== Booth Mapping =====================

  it('getBoothInfo() returns booth info for known market', async () => {
    fetchAll.mockResolvedValue(createMockParticipants());
    await loadAll();

    const info = getBoothInfo('ผักเมืองหนาว');
    expect(info).not.toBeNull();
    expect(info['บูธลงทะเบียน']).toBe('1,2');
    expect(info['จำนวนที่นั่ง']).toBe(344);
  });

  it('getBoothInfo() returns null for unknown market', async () => {
    fetchAll.mockResolvedValue(createMockParticipants());
    await loadAll();
    expect(getBoothInfo('ไม่มีตลาดนี้')).toBeNull();
  });

  it('getBoothInfo() returns null for empty market', () => {
    expect(getBoothInfo('')).toBeNull();
    expect(getBoothInfo(null)).toBeNull();
  });

  // ===================== Zone Extraction =====================

  it('getZoneFromTable() extracts zone letter from table number', () => {
    expect(getZoneFromTable('A141-1')).toBe('A');
    expect(getZoneFromTable('B22')).toBe('B');
    expect(getZoneFromTable('C10-1')).toBe('C');
    expect(getZoneFromTable('D5')).toBe('D');
    expect(getZoneFromTable('F445-3')).toBe('F');
  });

  it('getZoneFromTable() handles VIP', () => {
    expect(getZoneFromTable('VIP')).toBe('VIP');
    expect(getZoneFromTable('VIP-1')).toBe('VIP');
    expect(getZoneFromTable('vip')).toBe('VIP');
  });

  it('getZoneFromTable() returns empty for invalid input', () => {
    expect(getZoneFromTable('')).toBe('');
    expect(getZoneFromTable('-')).toBe('');
    expect(getZoneFromTable(null)).toBe('');
    expect(getZoneFromTable(undefined)).toBe('');
  });

  // ===================== Normalize Helpers =====================

  it('normalizePhone handles various input types', () => {
    expect(normalizePhone('081-437-9081')).toBe('0814379081');
    expect(normalizePhone('081 437 9081')).toBe('0814379081');
    expect(normalizePhone(null)).toBe('');
    expect(normalizePhone(undefined)).toBe('');
    expect(normalizePhone(123)).toBe('');
    expect(normalizePhone(true)).toBe('');
    expect(normalizePhone({})).toBe('');
  });

  it('normalizeThaiName trims and collapses whitespace', () => {
    expect(normalizeThaiName('  สมชาย   รุ่งเรือง  ')).toBe('สมชาย รุ่งเรือง');
    expect(normalizeThaiName(null)).toBe('');
    expect(normalizeThaiName(undefined)).toBe('');
    expect(normalizeThaiName('')).toBe('');
  });

  it('getParticipants() returns current cache array', async () => {
    expect(getParticipants()).toEqual([]);
    fetchAll.mockResolvedValue(createMockParticipants());
    await loadAll();
    expect(getParticipants().length).toBe(4);
  });

  // ===================== Edge Cases =====================

  it('search() skips empty phone values in comma-separated cell', async () => {
    const data = {
      participants: [
        { 'ลำดับ': 10, 'ชื่อผู้ค้า': 'Empty Phone', 'เบอร์โทร': ', ,  , ', 'ชื่อร้าน': 'X', 'ตลาด': 'X', 'เลขที่โต๊ะ': 'X1', 'สถานะการเข้างาน': '', _docId: 'doc-ep' },
      ],
      boothMapping: [],
    };
    fetchAll.mockResolvedValue(data);
    await loadAll();

    expect(search('0999999999')).toBeNull();
  });

  it('search() matches correctly when phone cell has mix of empty and valid', async () => {
    const data = {
      participants: [
        { 'ลำดับ': 10, 'ชื่อผู้ค้า': 'Mixed Phone', 'เบอร์โทร': ' , 0888888888, ', 'ชื่อร้าน': 'X', 'ตลาด': 'X', 'เลขที่โต๊ะ': 'X2', 'สถานะการเข้างาน': '', _docId: 'doc-mp' },
      ],
      boothMapping: [],
    };
    fetchAll.mockResolvedValue(data);
    await loadAll();

    const result = search('0888888888');
    expect(result).not.toBeNull();
    expect(result.participant['ชื่อผู้ค้า']).toBe('Mixed Phone');
  });

  it('search() handles participant with no ลำดับ field', async () => {
    const data = {
      participants: [
        { 'ชื่อผู้ค้า': 'No Seq', 'เบอร์โทร': '0899999999', 'ชื่อร้าน': 'X', 'ตลาด': 'X', 'เลขที่โต๊ะ': 'X1', 'สถานะการเข้างาน': '', _docId: 'doc-ns' },
      ],
      boothMapping: [],
    };
    fetchAll.mockResolvedValue(data);
    await loadAll();

    const result = search('0899999999');
    expect(result).not.toBeNull();
    expect(result.participant['ชื่อผู้ค้า']).toBe('No Seq');

    // ลำดับ search shouldn't match
    expect(search('1')).toBeNull();
  });

  // ===================== Name Search Edge Cases =====================

  it('search() skips participant with empty ชื่อผู้ค้า in name search loop', async () => {
    // Participant with blank name should be filtered out by `name && ...` guard (L221)
    const data = {
      participants: [
        { 'ลำดับ': 1, 'ชื่อผู้ค้า': '', 'เบอร์โทร': '0811111111', 'ชื่อร้าน': 'A', 'ตลาด': 'X', 'เลขที่โต๊ะ': 'A1', 'สถานะการเข้างาน': '', _docId: 'doc-blank' },
        { 'ลำดับ': 2, 'ชื่อผู้ค้า': 'สมชาย ก', 'เบอร์โทร': '0822222222', 'ชื่อร้าน': 'B', 'ตลาด': 'Y', 'เลขที่โต๊ะ': 'B2', 'สถานะการเข้างาน': '', _docId: 'doc-match' },
      ],
      boothMapping: [],
    };
    fetchAll.mockResolvedValue(data);
    await loadAll();

    // Searching for 'สมชาย' should return only the second participant (blank-name one is skipped)
    const result = search('สมชาย');
    expect(result).not.toBeNull();
    expect(result.type).toBe('single');
    expect(result.participant['ชื่อผู้ค้า']).toBe('สมชาย ก');
  });

  it('search() deduplicates participants with same name+phone in name search (seen set)', async () => {
    // Two rows with identical name+phone but different tables — should only appear once in nameMatches
    // (i.e. findAllRowsForPerson picks up both rows, but they only enter nameMatches once)
    const data = {
      participants: [
        { 'ลำดับ': 1, 'ชื่อผู้ค้า': 'สมชาย ก', 'เบอร์โทร': '0811111111', 'ชื่อร้าน': 'A', 'ตลาด': 'X', 'เลขที่โต๊ะ': 'X1', 'สถานะการเข้างาน': '', _docId: 'doc-x1' },
        { 'ลำดับ': 2, 'ชื่อผู้ค้า': 'สมชาย ก', 'เบอร์โทร': '0811111111', 'ชื่อร้าน': 'A', 'ตลาด': 'X', 'เลขที่โต๊ะ': 'X2', 'สถานะการเข้างาน': '', _docId: 'doc-x2' },
      ],
      boothMapping: [],
    };
    fetchAll.mockResolvedValue(data);
    await loadAll();

    // Both rows have same name+phone → deduplicated → single unique name match → type:single with merged tables
    const result = search('สมชาย');
    expect(result).not.toBeNull();
    expect(result.type).toBe('single');
    expect(result.participant['เลขที่โต๊ะ']).toBe('X1 , X2');
  });

  it('search() falls back to mock-${index} _docId when participant has no _docId', async () => {
    // Tests the `_docId || \`mock-${participants.indexOf(...)}\`` branch in buildSingleResult
    const data = {
      participants: [
        // No _docId property at all
        { 'ลำดับ': 1, 'ชื่อผู้ค้า': 'NoId', 'เบอร์โทร': '0833333333', 'ชื่อร้าน': 'X', 'ตลาด': 'X', 'เลขที่โต๊ะ': 'Z1', 'สถานะการเข้างาน': '' },
      ],
      boothMapping: [],
    };
    fetchAll.mockResolvedValue(data);
    await loadAll();

    const result = search('0833333333');
    expect(result).not.toBeNull();
    // _docId should be the mock fallback
    expect(result.participant._docId).toMatch(/^mock-/);
  });

  it('getBoothInfo() joins registrationBooths array with comma', async () => {
    // Tests the Array.isArray(booths) branch in getBoothInfo (L107-108)
    const data = {
      participants: [],
      boothMapping: [
        { _docId: 'zone-1', 'name': 'ตลาดทดสอบ', 'registrationBooths': ['1', '2', '3'], 'banquetSeats': 100 },
      ],
    };
    fetchAll.mockResolvedValue(data);
    await loadAll();

    const info = getBoothInfo('ตลาดทดสอบ');
    expect(info).not.toBeNull();
    expect(info['บูธลงทะเบียน']).toBe('1, 2, 3');
    expect(info['จำนวนที่นั่ง']).toBe(100);
  });

  // ===================== getZoneFromTable: no-letter branch (L135) =====================

  it('getZoneFromTable() returns empty string when table starts with a digit', () => {
    // Triggers the `: ''` false branch of `match ? match[1].toUpperCase() : ''`
    expect(getZoneFromTable('123-4')).toBe('');
    expect(getZoneFromTable('9ABC')).toBe('');
  });

  // ===================== search() empty nameQuery guard (L215) =====================

  it('search() returns null when query normalizes to empty string for name search', async () => {
    // A query of only whitespace normalizes to '' → nameQuery is empty → return null (L215)
    const data = {
      participants: [
        { 'ลำดับ': 1, 'ชื่อผู้ค้า': 'Test', 'เบอร์โทร': '', 'ชื่อร้าน': '', 'ตลาด': 'X', 'เลขที่โต๊ะ': 'X1', 'สถานะการเข้างาน': '', _docId: 'doc-1' },
      ],
      boothMapping: [],
    };
    fetchAll.mockResolvedValue(data);
    await loadAll();

    // Pass a string that normalizeThaiName collapses to ''
    // normalizeThaiName only trims/collapses whitespace, so a pure-whitespace input yields ''
    expect(search('   ')).toBeNull();
  });

  // ===================== search() multiple name matches — findAllRowsForPerson (L241-252) =====================

  it('search() returns multiple result list when two different people share partial name', async () => {
    // Two participants with different names that both match the query
    // → type:'multiple' → each runs through findAllRowsForPerson to merge tables (L241-252)
    const data = {
      participants: [
        { 'ลำดับ': 1, 'ชื่อผู้ค้า': 'สมชาย ก', 'เบอร์โทร': '0811111111', 'ชื่อร้าน': 'A', 'ตลาด': 'X', 'เลขที่โต๊ะ': 'X1', 'สถานะการเข้างาน': '', _docId: 'doc-a1' },
        // Same person appears in two rows (different tables) → merged by findAllRowsForPerson
        { 'ลำดับ': 2, 'ชื่อผู้ค้า': 'สมชาย ก', 'เบอร์โทร': '0811111111', 'ชื่อร้าน': 'A', 'ตลาด': 'X', 'เลขที่โต๊ะ': 'X2', 'สถานะการเข้างาน': '', _docId: 'doc-a2' },
        { 'ลำดับ': 3, 'ชื่อผู้ค้า': 'สมชาย ข', 'เบอร์โทร': '0822222222', 'ชื่อร้าน': 'B', 'ตลาด': 'Y', 'เลขที่โต๊ะ': 'Y3', 'สถานะการเข้างาน': '', _docId: 'doc-b' },
      ],
      boothMapping: [],
    };
    fetchAll.mockResolvedValue(data);
    await loadAll();

    const result = search('สมชาย');
    expect(result).not.toBeNull();
    expect(result.type).toBe('multiple');
    expect(result.participants.length).toBe(2);

    // สมชาย ก has two rows — merged เลขที่โต๊ะ should include both X1 and X2
    const somchaiA = result.participants.find(p => p['ชื่อผู้ค้า'] === 'สมชาย ก');
    expect(somchaiA).toBeDefined();
    expect(somchaiA['เลขที่โต๊ะ']).toContain('X1');
    expect(somchaiA['เลขที่โต๊ะ']).toContain('X2');
  });

  // ===================== getBoothInfo() non-Array registrationBooths (L107-109 false branch) =====================

  it('getBoothInfo() uses string registrationBooths directly when not an array', async () => {
    const data = {
      participants: [],
      boothMapping: [
        { _docId: 'zone-str', 'name': 'ตลาดสตริง', 'registrationBooths': 'บูธ 5', 'banquetSeats': 50 },
      ],
    };
    fetchAll.mockResolvedValue(data);
    await loadAll();
    const info = getBoothInfo('ตลาดสตริง');
    expect(info).not.toBeNull();
    expect(info['บูธลงทะเบียน']).toBe('บูธ 5');
    expect(info['จำนวนที่นั่ง']).toBe(50);
  });

  it('getBoothInfo() falls back to บูธลงทะเบียน field when registrationBooths is absent', async () => {
    const data = {
      participants: [],
      boothMapping: [
        { _docId: 'zone-legacy', 'name': 'ตลาดเก่า', 'บูธลงทะเบียน': 'บูธ 9', 'จำนวนที่นั่งโต๊ะจีน': 200 },
      ],
    };
    fetchAll.mockResolvedValue(data);
    await loadAll();
    const info = getBoothInfo('ตลาดเก่า');
    expect(info).not.toBeNull();
    expect(info['บูธลงทะเบียน']).toBe('บูธ 9');
    expect(info['จำนวนที่นั่ง']).toBe(200);
  });
});

