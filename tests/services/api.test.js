/**
 * API service tests — covers both Mock mode and Firestore mode.
 *
 * Since USE_MOCK is captured at module load time, we use vi.resetModules()
 * and dynamic imports to test each code path.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Save original env state
const originalMockData = import.meta.env.VITE_USE_MOCK_DATA;

// ═══════════════════════════════════════════════════════════════
//  Mock-mode tests  (VITE_USE_MOCK_DATA = 'true')
//  These exercise the mock-data.js delegate path.
// ═══════════════════════════════════════════════════════════════

describe('API Service — Mock Mode', () => {
  let api;

  beforeEach(async () => {
    vi.resetModules();
    import.meta.env.VITE_USE_MOCK_DATA = 'true';

    // Mock config
    vi.doMock('../../src/config.js', () => ({
      CONFIG: {
        RETRY_ATTEMPTS: 3,
        RETRY_BASE_DELAY: 10,
      },
    }));

    api = await import('../../src/services/api.js');
  });

  afterEach(() => {
    import.meta.env.VITE_USE_MOCK_DATA = originalMockData;
    vi.restoreAllMocks();
  });

  it('fetchAll() returns participants + boothMapping from mock data', async () => {
    const result = await api.fetchAll();
    expect(result.participants).toBeDefined();
    expect(result.boothMapping).toBeDefined();
    expect(result.participants.length).toBeGreaterThan(0);
    expect(result.participants[0]._docId).toBeDefined();
  });

  it('checkStatus() returns status from mock data', async () => {
    const result = await api.checkStatus('mock-p1');
    expect(result).toHaveProperty('status');
  });

  it('approve() succeeds for pending participant in mock', async () => {
    const result = await api.approve('mock-p1');
    expect(result.success).toBe(true);
    expect(result.alreadyApproved).toBe(false);
    expect(result.message).toBe('อนุมัติสำเร็จ');
  });

  it('approve() detects already-approved in mock', async () => {
    const result = await api.approve('mock-p3'); // p3 starts as approved
    expect(result.success).toBe(true);
    expect(result.alreadyApproved).toBe(true);
  });

  it('subscribeToUpdates() returns noop unsubscribe in mock mode', () => {
    const unsub = api.subscribeToUpdates(vi.fn());
    expect(typeof unsub).toBe('function');
    unsub(); // should not throw
  });
});

// ═══════════════════════════════════════════════════════════════
//  Firestore-mode tests  (VITE_USE_MOCK_DATA = 'false')
//  These exercise the real Firestore SDK code paths.
// ═══════════════════════════════════════════════════════════════

describe('API Service — Firestore Mode', () => {
  const mockGetDocs = vi.fn();
  const mockGetDoc = vi.fn();
  const mockRunTransaction = vi.fn();
  const mockCollection = vi.fn().mockReturnValue('mock-collection-ref');
  const mockDoc = vi.fn().mockReturnValue('mock-doc-ref');
  const mockOnSnapshot = vi.fn();

  let api;

  beforeEach(async () => {
    vi.resetModules();
    import.meta.env.VITE_USE_MOCK_DATA = 'false';

    mockGetDocs.mockReset();
    mockGetDoc.mockReset();
    mockRunTransaction.mockReset();
    mockOnSnapshot.mockReset();

    // Mock config
    vi.doMock('../../src/config.js', () => ({
      CONFIG: {
        RETRY_ATTEMPTS: 3,
        RETRY_BASE_DELAY: 10,
      },
    }));

    // Mock firebase initialization
    vi.doMock('../../src/services/firebase.js', () => ({
      db: { _isMockDb: true },
    }));

    // Mock firestore SDK
    vi.doMock('firebase/firestore', () => ({
      collection: (...args) => mockCollection(...args),
      getDocs: (...args) => mockGetDocs(...args),
      getDoc: (...args) => mockGetDoc(...args),
      doc: (...args) => mockDoc(...args),
      runTransaction: (...args) => mockRunTransaction(...args),
      onSnapshot: (...args) => mockOnSnapshot(...args),
    }));

    api = await import('../../src/services/api.js');
  });

  afterEach(() => {
    import.meta.env.VITE_USE_MOCK_DATA = originalMockData;
    vi.restoreAllMocks();
  });

  // --- fetchAll ---

  it('fetchAll() returns participants + boothMapping from Firestore', async () => {
    mockGetDocs
      .mockResolvedValueOnce({
        docs: [
          { id: 'p1', data: () => ({ 'ลำดับ': '1', 'ชื่อผู้ค้า': 'Test' }) },
          { id: 'p2', data: () => ({ 'ลำดับ': '2', 'ชื่อผู้ค้า': 'Test2' }) },
        ],
      })
      .mockResolvedValueOnce({
        docs: [
          { id: 'b1', data: () => ({ 'ตลาด': 'X', 'บูธลงทะเบียน': '1' }) },
        ],
      });

    const result = await api.fetchAll();
    expect(result.participants).toHaveLength(2);
    expect(result.participants[0]._docId).toBe('p1');
    expect(result.participants[0]['ชื่อผู้ค้า']).toBe('Test');
    expect(result.boothMapping).toHaveLength(1);
    expect(result.boothMapping[0]._docId).toBe('b1');
  });

  it('fetchAll() returns empty arrays when collections are empty', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });

    const result = await api.fetchAll();
    expect(result.participants).toEqual([]);
    expect(result.boothMapping).toEqual([]);
  });

  it('fetchAll() throws on Firestore error', async () => {
    mockGetDocs.mockRejectedValue(new Error('Firestore unavailable'));
    await expect(api.fetchAll()).rejects.toThrow('Firestore unavailable');
  });

  // --- checkStatus ---

  it('checkStatus() returns status for existing document', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ 'สถานะการเข้างาน': 'รออนุมัติเข้างาน', 'เวลาอนุมัติ': '' }),
    });

    const result = await api.checkStatus('doc-123');
    expect(result.status).toBe('รออนุมัติเข้างาน');
  });

  it('checkStatus() returns empty status for non-existent document', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });

    const result = await api.checkStatus('non-existent');
    expect(result.status).toBe('');
  });

  it('checkStatus() includes approvedAt when present', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ 'สถานะการเข้างาน': 'อนุมัติแล้ว', 'เวลาอนุมัติ': '2026-05-08 10:30:00' }),
    });

    const result = await api.checkStatus('doc-456');
    expect(result.status).toBe('อนุมัติแล้ว');
    expect(result.approvedAt).toBe('2026-05-08 10:30:00');
  });

  // --- approve ---

  it('approve() succeeds via Firestore transaction', async () => {
    mockRunTransaction.mockImplementation(async (_db, fn) => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({ 'สถานะการเข้างาน': '' }),
        }),
        update: vi.fn(),
      };
      return fn(mockTransaction);
    });

    const result = await api.approve('doc-123');
    expect(result.success).toBe(true);
    expect(result.alreadyApproved).toBe(false);
    expect(result.message).toBe('อนุมัติสำเร็จ');
  });

  it('approve() detects already-approved document', async () => {
    mockRunTransaction.mockImplementation(async (_db, fn) => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({
            'สถานะการเข้างาน': 'อนุมัติแล้ว',
            'เวลาอนุมัติ': '2026-05-08 10:00:00',
          }),
        }),
        update: vi.fn(),
      };
      return fn(mockTransaction);
    });

    const result = await api.approve('doc-123');
    expect(result.success).toBe(true);
    expect(result.alreadyApproved).toBe(true);
  });

  it('approve() handles non-existent document', async () => {
    mockRunTransaction.mockImplementation(async (_db, fn) => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => false,
        }),
        update: vi.fn(),
      };
      return fn(mockTransaction);
    });

    const result = await api.approve('ghost-doc');
    expect(result.success).toBe(false);
    expect(result.message).toBe('ไม่พบข้อมูล');
  });

  it('approve() retries on transient failure', async () => {
    let callCount = 0;
    mockRunTransaction.mockImplementation(async (_db, fn) => {
      callCount++;
      if (callCount < 3) throw new Error('Transient');
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({ 'สถานะการเข้างาน': '' }),
        }),
        update: vi.fn(),
      };
      return fn(mockTransaction);
    });

    const result = await api.approve('doc-retry');
    expect(result.success).toBe(true);
    expect(callCount).toBe(3);
  });

  it('approve() throws after all retries exhausted', async () => {
    mockRunTransaction.mockRejectedValue(new Error('Persistent failure'));
    await expect(api.approve('doc-fail')).rejects.toThrow('Persistent failure');
  });

  // --- subscribeToUpdates ---

  it('subscribeToUpdates() sets up onSnapshot listeners', () => {
    const onUpdate = vi.fn();
    mockOnSnapshot.mockReturnValue(vi.fn());

    const unsub = api.subscribeToUpdates(onUpdate);
    expect(typeof unsub).toBe('function');
  });

  it('subscribeToUpdates() fires onUpdate callback when onSnapshot triggers', async () => {
    const onUpdate = vi.fn();
    const unsubParticipantsFn = vi.fn();
    const unsubBoothFn = vi.fn();

    // Capture snapshot callbacks when onSnapshot is called
    let participantCallback, boothCallback;
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      if (!participantCallback) {
        participantCallback = cb;
        return unsubParticipantsFn;
      } else {
        boothCallback = cb;
        return unsubBoothFn;
      }
    });

    api.subscribeToUpdates(onUpdate);

    // Wait for the async IIFE to resolve
    await vi.waitFor(() => expect(mockOnSnapshot).toHaveBeenCalledTimes(2));

    // Simulate participant snapshot
    participantCallback({
      docs: [
        { id: 'p1', data: () => ({ 'ชื่อผู้ค้า': 'Test' }) },
      ],
    });
    expect(onUpdate).toHaveBeenCalledWith({
      participants: [{ _docId: 'p1', 'ชื่อผู้ค้า': 'Test' }],
      boothMapping: [],
    });

    // Simulate booth snapshot
    boothCallback({
      docs: [
        { id: 'b1', data: () => ({ 'ตลาด': 'X' }) },
      ],
    });
    expect(onUpdate).toHaveBeenCalledWith({
      participants: [{ _docId: 'p1', 'ชื่อผู้ค้า': 'Test' }],
      boothMapping: [{ _docId: 'b1', 'ตลาด': 'X' }],
    });
  });

  it('subscribeToUpdates() unsubscribe cleans up both listeners', async () => {
    const onUpdate = vi.fn();
    const unsubParticipantsFn = vi.fn();
    const unsubBoothFn = vi.fn();

    let callNum = 0;
    mockOnSnapshot.mockImplementation((_ref, _cb) => {
      callNum++;
      return callNum === 1 ? unsubParticipantsFn : unsubBoothFn;
    });

    const unsub = api.subscribeToUpdates(onUpdate);

    // Wait for async setup to complete
    await vi.waitFor(() => expect(mockOnSnapshot).toHaveBeenCalledTimes(2));

    // Call unsubscribe
    unsub();
    expect(unsubParticipantsFn).toHaveBeenCalled();
    expect(unsubBoothFn).toHaveBeenCalled();
  });

  it('subscribeToUpdates() unsubscribe is safe before async init completes', () => {
    // unsubParticipants and unsubBooth are null until the async IIFE resolves
    const onUpdate = vi.fn();
    mockOnSnapshot.mockReturnValue(vi.fn());

    const unsub = api.subscribeToUpdates(onUpdate);
    // Call immediately — before the async IIFE has resolved
    unsub(); // Should not throw
  });
});

// ═══════════════════════════════════════════════════════════════
//  delay helper (shared, no env dependency)
// ═══════════════════════════════════════════════════════════════

describe('delay()', () => {
  it('resolves after specified time', async () => {
    // Import fresh to get delay
    vi.resetModules();
    vi.doMock('../../src/config.js', () => ({
      CONFIG: { RETRY_ATTEMPTS: 3, RETRY_BASE_DELAY: 10 },
    }));
    const { delay } = await import('../../src/services/api.js');

    const start = Date.now();
    await delay(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });
});
