/**
 * Sample test data for local development.
 * Mirrors the real Firestore schema so devs can work without
 * a Firebase connection or a valid project configuration.
 *
 * Enable by setting VITE_USE_MOCK_DATA=true in .env.development
 */

export const MOCK_PARTICIPANTS = [
  {
    _docId: 'mock-p1',
    'ลำดับ': '1',
    'ชื่อผู้ค้า': 'สมชาย ใจดี',
    'ตลาด': 'ตลาดไท',
    'ชื่อร้าน': 'ร้านผลไม้สมชาย',
    'เลขที่โต๊ะ': 'A101-1',
    'เบอร์โทร': '081-234-5678',
    'สถานะการเข้างาน': '',
  },
  {
    _docId: 'mock-p2',
    'ลำดับ': '2',
    'ชื่อผู้ค้า': 'สมหญิง รักไทย',
    'ตลาด': 'ตลาดไท',
    'ชื่อร้าน': 'ร้านผักสดสมหญิง',
    'เลขที่โต๊ะ': 'A102-3',
    'เบอร์โทร': '089-876-5432',
    'สถานะการเข้างาน': '',
  },
  {
    _docId: 'mock-p3',
    'ลำดับ': '3',
    'ชื่อผู้ค้า': 'วิชัย มั่งมี',
    'ตลาด': 'ตลาดสี่มุมเมือง',
    'ชื่อร้าน': 'ร้านอาหารทะเลวิชัย',
    'เลขที่โต๊ะ': 'B205-2',
    'เบอร์โทร': '062-111-2222',
    'สถานะการเข้างาน': 'อนุมัติแล้ว',
    'เวลาอนุมัติ': '2026-05-08 10:30:00',
  },
  {
    _docId: 'mock-p4',
    'ลำดับ': '4',
    'ชื่อผู้ค้า': 'นิตยา สวัสดิ์',
    'ตลาด': 'ตลาดไทย',
    'ชื่อร้าน': 'ร้านขนมนิตยา',
    'เลขที่โต๊ะ': 'C310-5',
    'เบอร์โทร': '095-333-4444',
    'สถานะการเข้างาน': '',
  },
  {
    _docId: 'mock-p5',
    'ลำดับ': '5',
    'ชื่อผู้ค้า': 'ประยุทธ์ พาณิชย์',
    'ตลาด': 'ตลาดไท',
    'ชื่อร้าน': 'ร้านเครื่องเทศประยุทธ์',
    'เลขที่โต๊ะ': 'D412-1',
    'เบอร์โทร': '088-555-6666',
    'สถานะการเข้างาน': '',
  },
  {
    _docId: 'mock-p6',
    'ลำดับ': '6',
    'ชื่อผู้ค้า': 'มาลี ทองสุข',
    'ตลาด': 'ตลาดไท',
    'ชื่อร้าน': 'ร้านดอกไม้มาลี',
    'เลขที่โต๊ะ': 'F501-2',
    'เบอร์โทร': '091-777-8888',
    'สถานะการเข้างาน': '',
  },
  {
    _docId: 'mock-p7',
    'ลำดับ': '7',
    'ชื่อผู้ค้า': 'สุรชัย เจริญ',
    'ตลาด': 'ตลาดสี่มุมเมือง',
    'ชื่อร้าน': 'ร้านของสดสุรชัย',
    'เลขที่โต๊ะ': 'VIP-01',
    'เบอร์โทร': '082-999-0000',
    'สถานะการเข้างาน': '',
  },
  // --- Duplicate name for testing multi-result search ---
  {
    _docId: 'mock-p8',
    'ลำดับ': '8',
    'ชื่อผู้ค้า': 'สมชาย ใจดี',
    'ตลาด': 'ตลาดสี่มุมเมือง',
    'ชื่อร้าน': 'ร้านของชำสมชาย',
    'เลขที่โต๊ะ': 'B210-4',
    'เบอร์โทร': '063-222-3333',
    'สถานะการเข้างาน': '',
  },
  // --- Same person, multiple table rows ---
  {
    _docId: 'mock-p9',
    'ลำดับ': '9',
    'ชื่อผู้ค้า': 'มาลี ทองสุข',
    'ตลาด': 'ตลาดไท',
    'ชื่อร้าน': 'ร้านดอกไม้มาลี',
    'เลขที่โต๊ะ': 'F502-1',
    'เบอร์โทร': '091-777-8888',
    'สถานะการเข้างาน': '',
  },
  {
    _docId: 'mock-p10',
    'ลำดับ': '10',
    'ชื่อผู้ค้า': 'พิชัย รุ่งเรือง',
    'ตลาด': 'ตลาดไทย',
    'ชื่อร้าน': 'ร้านข้าวสารพิชัย',
    'เลขที่โต๊ะ': 'A115-2',
    'เบอร์โทร': '064-444-5555',
    'สถานะการเข้างาน': '',
  },
];

export const MOCK_BOOTH_MAPPING = [
  { _docId: 'mock-b1', 'ตลาด': 'ตลาดไท', 'บูธลงทะเบียน': 'บูธ A (หน้าทางเข้า)', 'จำนวนที่นั่งโต๊ะจีน': 500 },
  { _docId: 'mock-b2', 'ตลาด': 'ตลาดสี่มุมเมือง', 'บูธลงทะเบียน': 'บูธ B (โซนจอดรถ)', 'จำนวนที่นั่งโต๊ะจีน': 300 },
  { _docId: 'mock-b3', 'ตลาด': 'ตลาดไทย', 'บูธลงทะเบียน': 'บูธ C (ศูนย์อาหาร)', 'จำนวนที่นั่งโต๊ะจีน': 200 },
];

/**
 * In-memory approval tracker for mock mode.
 * Maps docId → { status, approvedAt }
 */
const _approvedDocs = {};

/**
 * Mock implementation of fetchAll().
 * @returns {Promise<{ participants: Array, boothMapping: Array }>}
 */
export async function mockFetchAll() {
  // Simulate network latency (200-500ms)
  await _delay(200 + Math.random() * 300);

  // Merge any mock approvals back into the data
  const liveParticipants = MOCK_PARTICIPANTS.map(p => {
    if (_approvedDocs[p._docId]) {
      return { ...p, ..._approvedDocs[p._docId] };
    }
    return { ...p };
  });

  return {
    participants: liveParticipants,
    boothMapping: [...MOCK_BOOTH_MAPPING],
  };
}

/**
 * Mock implementation of checkStatus().
 * @param {string} docId - document ID
 * @returns {Promise<{ status: string, approvedAt?: string }>}
 */
export async function mockCheckStatus(docId) {
  await _delay(100 + Math.random() * 200);

  if (_approvedDocs[docId]) {
    return {
      status: _approvedDocs[docId]['สถานะการเข้างาน'],
      approvedAt: _approvedDocs[docId]['เวลาอนุมัติ'],
    };
  }

  const participant = MOCK_PARTICIPANTS.find(p => p._docId === docId);
  if (participant) {
    return {
      status: participant['สถานะการเข้างาน'] || '',
      approvedAt: participant['เวลาอนุมัติ'] || undefined,
    };
  }

  return { status: '' };
}

/**
 * Mock implementation of approve().
 * @param {string} docId - document ID
 * @returns {Promise<{ success: boolean, alreadyApproved: boolean, message: string }>}
 */
export async function mockApprove(docId) {
  await _delay(300 + Math.random() * 400);

  // Check if already approved (in tracker)
  if (_approvedDocs[docId]?.['สถานะการเข้างาน'] === 'อนุมัติแล้ว') {
    return {
      success: true,
      alreadyApproved: true,
      message: 'รายชื่อนี้ได้รับการอนุมัติแล้ว',
    };
  }

  // Check if already approved (in base data)
  const participant = MOCK_PARTICIPANTS.find(p => p._docId === docId);
  if (participant && participant['สถานะการเข้างาน'] === 'อนุมัติแล้ว') {
    return {
      success: true,
      alreadyApproved: true,
      message: 'รายชื่อนี้ได้รับการอนุมัติแล้ว',
    };
  }

  // Mark as approved
  const now = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
  _approvedDocs[docId] = {
    'สถานะการเข้างาน': 'อนุมัติแล้ว',
    'เวลาอนุมัติ': now,
  };

  return {
    success: true,
    alreadyApproved: false,
    message: 'อนุมัติสำเร็จ',
  };
}

/**
 * Reset mock state (for testing).
 */
export function _resetMockState() {
  Object.keys(_approvedDocs).forEach(k => delete _approvedDocs[k]);
}

function _delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
