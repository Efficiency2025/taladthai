/**
 * API service — data layer for participant check-in.
 *
 * Backend: Firebase Cloud Firestore
 *   - 'participants' collection — all vendor/trader rows
 *   - 'market_zones' collection — market name → registration booth lookup
 *
 * DEV MODE: Set VITE_USE_MOCK_DATA=true in .env.development to use
 * local sample data without needing a Firebase connection.
 */
import { CONFIG } from '../config.js';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true';

// Lazy-loaded modules (only imported when needed)
let _mock = null;
let _firestore = null;

async function getMock() {
  if (!_mock) {
    _mock = await import('./mock-data.js');
  }
  return _mock;
}

async function getFirestoreModules() {
  if (!_firestore) {
    const [fb, fs] = await Promise.all([
      import('./firebase.js'),
      import('firebase/firestore'),
    ]);
    _firestore = { db: fb.db, ...fs };
  }
  return _firestore;
}

/**
 * Fetch all participants and booth mapping from Firestore.
 * @returns {Promise<{ participants: Array, boothMapping: Array }>}
 */
export async function fetchAll() {
  if (USE_MOCK) {
    const mock = await getMock();
    return mock.mockFetchAll();
  }

  const { db, collection, getDocs } = await getFirestoreModules();

  const [participantSnap, boothSnap] = await Promise.all([
    getDocs(collection(db, 'participants')),
    getDocs(collection(db, 'market_zones')),
  ]);

  const participants = participantSnap.docs.map(doc => ({
    _docId: doc.id,
    ...doc.data(),
  }));

  const boothMapping = boothSnap.docs.map(doc => ({
    _docId: doc.id,
    ...doc.data(),
  }));

  return { participants, boothMapping };
}

/**
 * Check the real-time status of a single participant.
 * @param {string} docId - Firestore document ID
 * @returns {Promise<{ status: string, approvedAt?: string }>}
 */
export async function checkStatus(docId) {
  if (USE_MOCK) {
    const mock = await getMock();
    return mock.mockCheckStatus(docId);
  }

  const { db, doc, getDoc } = await getFirestoreModules();

  const snap = await getDoc(doc(db, 'participants', docId));

  if (!snap.exists()) {
    return { status: '' };
  }

  const data = snap.data();
  return {
    status: data['สถานะการเข้างาน'] || '',
    approvedAt: data['เวลาอนุมัติ'] || undefined,
  };
}

/**
 * Approve a participant (mark as checked in).
 * Uses a Firestore transaction to prevent race conditions
 * when multiple staff approve simultaneously.
 *
 * @param {string} docId - Firestore document ID
 * @returns {Promise<{ success: boolean, alreadyApproved: boolean, message: string, approvedAt?: string }>}
 */
export async function approve(docId) {
  if (USE_MOCK) {
    const mock = await getMock();
    return mock.mockApprove(docId);
  }

  const { db, doc, runTransaction } = await getFirestoreModules();

  let lastError = null;

  for (let attempt = 0; attempt < CONFIG.RETRY_ATTEMPTS; attempt++) {
    try {
      const participantRef = doc(db, 'participants', docId);

      const result = await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(participantRef);

        if (!snap.exists()) {
          return { success: false, alreadyApproved: false, message: 'ไม่พบข้อมูล' };
        }

        const data = snap.data();

        // Guard against double-approval
        if (data['สถานะการเข้างาน'] === 'อนุมัติแล้ว') {
          return {
            success: true,
            alreadyApproved: true,
            message: 'รายชื่อนี้ได้รับการอนุมัติแล้ว',
            approvedAt: data['เวลาอนุมัติ'] || '',
          };
        }

        const now = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

        transaction.update(participantRef, {
          'สถานะการเข้างาน': 'อนุมัติแล้ว',
          'เวลาอนุมัติ': now,
        });

        return {
          success: true,
          alreadyApproved: false,
          message: 'อนุมัติสำเร็จ',
          approvedAt: now,
        };
      });

      return result;
    } catch (error) {
      lastError = error;
      if (attempt < CONFIG.RETRY_ATTEMPTS - 1) {
        await delay(CONFIG.RETRY_BASE_DELAY * Math.pow(2, attempt));
      }
    }
  }

  throw lastError;
}

/**
 * Subscribe to real-time participant updates.
 * Calls the callback whenever participant data changes in Firestore.
 *
 * @param {Function} onUpdate - callback receiving { participants, boothMapping } (boothMapping = market_zones docs)
 * @returns {Function} unsubscribe function
 */
export function subscribeToUpdates(onUpdate) {
  if (USE_MOCK) {
    // Mock mode: no real-time updates, just do initial fetch
    getMock().then(mock => mock.mockFetchAll().then(onUpdate));
    return () => {};
  }

  // Lazy import handled inline for the subscription
  let unsubParticipants = null;
  let unsubBooth = null;
  let latestParticipants = [];
  let latestBooth = [];

  (async () => {
    const { db, collection, onSnapshot } = await getFirestoreModules();

    unsubParticipants = onSnapshot(collection(db, 'participants'), (snapshot) => {
      latestParticipants = snapshot.docs.map(doc => ({
        _docId: doc.id,
        ...doc.data(),
      }));
      onUpdate({ participants: latestParticipants, boothMapping: latestBooth });
    });

    unsubBooth = onSnapshot(collection(db, 'market_zones'), (snapshot) => {
      latestBooth = snapshot.docs.map(doc => ({
        _docId: doc.id,
        ...doc.data(),
      }));
      onUpdate({ participants: latestParticipants, boothMapping: latestBooth });
    });
  })();

  return () => {
    if (unsubParticipants) unsubParticipants();
    if (unsubBooth) unsubBooth();
  };
}

/**
 * Delay helper for retry backoff.
 * @param {number} ms - milliseconds to wait
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
