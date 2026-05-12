/**
 * In-memory cache for participant data and booth mapping.
 * Provides instant search and real-time Firestore sync via onSnapshot.
 */
import { fetchAll, subscribeToUpdates } from './api.js';

let participants = [];
let boothMapping = [];
let unsubscribeFn = null;

/**
 * Load all participants and booth mapping from the API into cache.
 * Used for initial load and manual refresh.
 * @returns {Promise<void>}
 */
export async function loadAll() {
  try {
    const data = await fetchAll();
    participants = data.participants || [];
    boothMapping = data.boothMapping || [];
  } catch (error) {
    console.error('Failed to load participants:', error);
    // Keep existing cache if re-fetch fails
  }
}

/**
 * Start real-time subscription to Firestore changes.
 * Replaces the old polling-based auto-refresh.
 * Falls back to periodic polling when in mock mode.
 *
 * @param {number} [fallbackIntervalMs] - polling interval for mock mode
 */
export function startRealtimeSync(fallbackIntervalMs) {
  stopRealtimeSync();

  unsubscribeFn = subscribeToUpdates((data) => {
    participants = data.participants || [];
    boothMapping = data.boothMapping || [];
  });
}

/**
 * Stop real-time subscription.
 */
export function stopRealtimeSync() {
  if (unsubscribeFn) {
    unsubscribeFn();
    unsubscribeFn = null;
  }
}

/**
 * Start auto-refresh (legacy polling for backward compatibility).
 * @param {number} intervalMs - refresh interval in milliseconds
 */
let refreshIntervalId = null;
export function startAutoRefresh(intervalMs) {
  stopAutoRefresh();
  refreshIntervalId = setInterval(() => {
    loadAll();
  }, intervalMs);
}

/**
 * Stop the auto-refresh interval.
 */
export function stopAutoRefresh() {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }
}

/**
 * Get the current cached participants.
 * @returns {Array} current participant array
 */
export function getParticipants() {
  return participants;
}

/**
 * Get the current booth mapping.
 * @returns {Array} booth mapping array
 */
export function getBoothMapping() {
  return boothMapping;
}

/**
 * Look up booth info for a given market name.
 * @param {string} marketName - the market/zone name (ตลาด)
 * @returns {{ บูธลงทะเบียน: string, จำนวนที่นั่ง: number } | null}
 */
export function getBoothInfo(marketName) {
  if (!marketName || !boothMapping.length) return null;

  const normalized = marketName.trim();
  for (const entry of boothMapping) {
    const entryMarket = String(entry['ตลาด'] || '').trim();
    if (entryMarket === normalized) {
      return {
        'บูธลงทะเบียน': String(entry['บูธลงทะเบียน'] || entry['โต๊ะลงทะเบียน'] || ''),
        'จำนวนที่นั่ง': Number(entry['จำนวนที่นั่งโต๊ะจีน'] || entry['จำนวนที่นั่ง'] || 0),
      };
    }
  }
  return null;
}

/**
 * Extract the zone letter from a table number.
 * e.g. "A122-6" → "A", "F445-3" → "F", "VIP" → "VIP"
 * @param {string} tableNumber
 * @returns {string} zone letter or empty string
 */
export function getZoneFromTable(tableNumber) {
  if (!tableNumber || typeof tableNumber !== 'string') return '';
  const trimmed = tableNumber.trim();
  if (!trimmed || trimmed === '-') return '';

  // VIP special case
  if (trimmed.toUpperCase().startsWith('VIP')) return 'VIP';

  // Extract first letter (A, B, C, D, F, etc.)
  const match = trimmed.match(/^([A-Za-z])/);
  return match ? match[1].toUpperCase() : '';
}

/**
 * Normalize a phone number by stripping dashes, spaces, and dots.
 * @param {string} phone - raw phone string
 * @returns {string} normalized phone
 */
export function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  return phone.replace(/[-\s.]/g, '').trim();
}

/**
 * Normalize a Thai name for matching: trim, collapse whitespace.
 * @param {string} name
 * @returns {string} normalized name (lowercase for matching)
 */
export function normalizeThaiName(name) {
  if (!name || typeof name !== 'string') return '';
  return name.replace(/\s+/g, ' ').trim();
}

/**
 * Search for participants by phone number, เลขที่โต๊ะ (table number), or name.
 * Handles multi-phone cells (comma-separated).
 *
 * Returns:
 *   - { type: 'single', participant: {...} } for exact phone/เลขที่โต๊ะ match
 *   - { type: 'multiple', participants: [...] } for name matches with > 1 result
 *   - null if no match
 *
 * @param {string} query - search input
 * @returns {{ type: string, participant?: Object, participants?: Array } | null}
 */
export function search(query) {
  if (!query || !participants.length) return null;

  const trimmedQuery = query.trim();
  if (!trimmedQuery) return null;

  // --- 1. Try เลขที่โต๊ะ (table number match, case-insensitive) ---
  const normalizedQuery = normalizePhone(trimmedQuery);
  const upperQuery = trimmedQuery.toUpperCase();
  const tableMatches = [];

  for (const participant of participants) {
    const tableCell = String(participant['เลขที่โต๊ะ'] || '').trim();
    // Support comma-separated table numbers (e.g. "A141-1 , A141-2")
    const tables = tableCell.split(',').map(t => t.trim().toUpperCase());
    if (tables.some(t => t && t === upperQuery)) {
      tableMatches.push(participant);
    }
  }

  if (tableMatches.length > 0) {
    return buildSingleResult(tableMatches);
  }

  // --- 2. Try phone match ---
  const phoneMatches = [];

  for (const participant of participants) {
    const phoneCell = String(participant['เบอร์โทร'] || '');
    const phones = phoneCell.split(',').map(p => normalizePhone(p));

    for (const phone of phones) {
      if (phone && phone === normalizedQuery) {
        phoneMatches.push(participant);
        break;
      }
    }
  }

  if (phoneMatches.length > 0) {
    return buildSingleResult(phoneMatches);
  }

  // --- 3. Try name match (partial, Thai-aware) ---
  const nameQuery = normalizeThaiName(trimmedQuery);
  if (!nameQuery) return null;

  const nameMatches = [];
  const seen = new Set(); // Deduplicate by name+phone

  for (const participant of participants) {
    const name = normalizeThaiName(String(participant['ชื่อผู้ค้า'] || ''));
    if (name && name.includes(nameQuery)) {
      const key = `${name}|${String(participant['เบอร์โทร'] || '')}`;
      if (!seen.has(key)) {
        seen.add(key);
        nameMatches.push(participant);
      }
    }
  }

  if (nameMatches.length === 0) return null;

  if (nameMatches.length === 1) {
    // Single unique name match — merge all rows for this person
    return buildSingleResult(findAllRowsForPerson(nameMatches[0]));
  }

  // Multiple unique name matches — return list for user to pick
  return {
    type: 'multiple',
    participants: nameMatches.map(p => {
      const allRows = findAllRowsForPerson(p);
      const first = { ...allRows[0] };
      if (allRows.length > 1) {
        const allTables = allRows
          .map(m => String(m['เลขที่โต๊ะ'] || '').trim())
          .filter(Boolean);
        first['เลขที่โต๊ะ'] = allTables.join(' , ');
      }
      // Use _docId from Firestore, fall back to array index for mock
      first._docId = allRows[0]._docId || `mock-${participants.indexOf(allRows[0])}`;
      return first;
    }),
  };
}

/**
 * Find all rows in participants for the same person (by name + phone).
 * @param {Object} person - a participant object
 * @returns {Array} all matching rows
 */
function findAllRowsForPerson(person) {
  const name = normalizeThaiName(String(person['ชื่อผู้ค้า'] || ''));
  const phone = normalizePhone(String(person['เบอร์โทร'] || ''));

  return participants.filter(p => {
    const pName = normalizeThaiName(String(p['ชื่อผู้ค้า'] || ''));
    const pPhone = normalizePhone(String(p['เบอร์โทร'] || ''));
    return pName === name && pPhone === phone;
  });
}

/**
 * Build a single-result response, merging table numbers from multiple rows.
 * @param {Array} matches - array of matching participant rows
 * @returns {{ type: 'single', participant: Object }}
 */
function buildSingleResult(matches) {
  const first = { ...matches[0] };
  if (matches.length > 1) {
    const allTables = matches
      .map(m => String(m['เลขที่โต๊ะ'] || '').trim())
      .filter(Boolean);
    first['เลขที่โต๊ะ'] = allTables.join(' , ');
  }
  // Use _docId from Firestore, fall back to array index for mock
  first._docId = matches[0]._docId || `mock-${participants.indexOf(matches[0])}`;
  first._allMatches = matches;
  return { type: 'single', participant: first };
}

/**
 * Update a document's status in the local cache after approval.
 * @param {string} docId - the Firestore document ID
 * @param {string} status - new status value
 * @param {string} [approvedAt] - approval timestamp
 */
export function updateRow(docId, status, approvedAt) {
  const idx = participants.findIndex(p => p._docId === docId);
  if (idx >= 0) {
    participants[idx] = {
      ...participants[idx],
      'สถานะการเข้างาน': status,
    };
    if (approvedAt) {
      participants[idx]['เวลาอนุมัติ'] = approvedAt;
    }
  }
}

/**
 * Reset cache (for testing purposes).
 */
export function _resetCache() {
  participants = [];
  boothMapping = [];
  stopAutoRefresh();
  stopRealtimeSync();
}
