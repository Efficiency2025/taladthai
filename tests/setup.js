/**
 * Vitest test setup — jsdom helpers and mock data factory.
 */
import { beforeEach, afterEach, vi } from 'vitest';

// Reset DOM before each test
beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  window.location.hash = '';
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Create mock participant data matching Firestore document structure.
 * Returns { participants, boothMapping } matching the API response shape.
 * Each participant has a _docId (Firestore document ID) instead of _rowIndex.
 * @returns {{ participants: Array<Object>, boothMapping: Array<Object> }}
 */
export function createMockParticipants() {
  return {
    participants: [
      {
        _docId: 'participant-001',
        'ลำดับ': 1,
        'ชื่อผู้ค้า': 'นเรศ ชัยประสิทธิ์กุล',
        'เบอร์โทร': '0814379081 , 0818812911',
        'ชื่อร้าน': 'ส่งเสริมเศรษฐกิจชาวสวน',
        'ตลาด': 'ผักเมืองหนาว',
        'เลขที่โต๊ะ': 'A141-1 , A141-2 , A141-3',
        'สถานะการเข้างาน': 'รออนุมัติเข้างาน',
      },
      {
        _docId: 'participant-002',
        'ลำดับ': 2,
        'ชื่อผู้ค้า': 'สมชาย รุ่งเรือง',
        'เบอร์โทร': '0891234567',
        'ชื่อร้าน': 'ผักสดจากสวน',
        'ตลาด': 'ผลไม้',
        'เลขที่โต๊ะ': 'B22',
        'สถานะการเข้างาน': 'อนุมัติแล้ว',
      },
      {
        _docId: 'participant-003',
        'ลำดับ': 3,
        'ชื่อผู้ค้า': 'วิไล แซ่ลิ้ม',
        'เบอร์โทร': '0923456789',
        'ชื่อร้าน': 'น้ำผึ้งป่า',
        'ตลาด': 'อาหารแปรรูป',
        'เลขที่โต๊ะ': 'C10-1',
        'สถานะการเข้างาน': 'รออนุมัติเข้างาน',
      },
      {
        _docId: 'participant-004',
        'ลำดับ': 4,
        'ชื่อผู้ค้า': 'อรุณ ปิ่นทอง',
        'เบอร์โทร': '',
        'ชื่อร้าน': 'ของฝากจากบ้าน',
        'ตลาด': 'ของฝาก',
        'เลขที่โต๊ะ': 'D5',
        'สถานะการเข้างาน': 'รออนุมัติเข้างาน',
      },
    ],
    boothMapping: [
      { _docId: 'booth-001', 'ลำดับ': 1, 'ตลาด': 'ผักเมืองหนาว', 'จำนวนที่นั่งโต๊ะจีน': 344, 'บูธลงทะเบียน': '1,2' },
      { _docId: 'booth-002', 'ลำดับ': 2, 'ตลาด': 'ผลไม้', 'จำนวนที่นั่งโต๊ะจีน': 200, 'บูธลงทะเบียน': '3' },
      { _docId: 'booth-003', 'ลำดับ': 3, 'ตลาด': 'อาหารแปรรูป', 'จำนวนที่นั่งโต๊ะจีน': 150, 'บูธลงทะเบียน': '4' },
      { _docId: 'booth-004', 'ลำดับ': 4, 'ตลาด': 'ของฝาก', 'จำนวนที่นั่งโต๊ะจีน': 100, 'บูธลงทะเบียน': '5' },
    ],
  };
}
