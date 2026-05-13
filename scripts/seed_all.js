#!/usr/bin/env node
/**
 * seed_all.js — Full Firestore seed from google_sheets_data.json
 *
 * Collections seeded:
 *   market_zones   (18 docs)  — sheet 1486942240
 *   seats          (4432 docs) — sheet 1092783721
 *   participants   (4448 docs) — sheet 1981204303
 *   boothMapping   (layout)   — sheet 242605686
 *
 * All writes use set({ merge: true }) → safe to re-run; updates existing, creates new.
 *
 * Auth:
 *   Set FIREBASE_SERVICE_ACCOUNT_BASE64 env var (base64-encoded service account JSON)
 *   OR set GOOGLE_APPLICATION_CREDENTIALS to a path of the service account JSON file.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT_BASE64=<base64> node scripts/seed_all.js
 *   node scripts/seed_all.js --dry-run   (print counts only, no writes)
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Config ────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 499; // Firestore max is 500 ops per batch
const DATA_FILE = path.join(__dirname, '..', 'google_sheets_data.json');

// Sheet GID → human name mapping
const SHEET_IDS = {
  BOOTH_LAYOUT:  '242605686',
  SEATS:         '1092783721',
  MARKET_ZONES:  '1486942240',
  VENDORS:       '1981204303',
};

// Firestore collection names
const COLLECTIONS = {
  MARKET_ZONES:  'market_zones',
  SEATS:         'seats',
  PARTICIPANTS:  'participants',
  BOOTH_MAPPING: 'boothMapping',
};

// ─── Firebase Init ──────────────────────────────────────────────────────────
function initFirebase() {
  if (admin.apps.length) return;

  const base64Creds = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (base64Creds) {
    const serviceAccount = JSON.parse(
      Buffer.from(base64Creds, 'base64').toString('utf8')
    );
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log('🔐 Authenticated via FIREBASE_SERVICE_ACCOUNT_BASE64');
  } else if (credPath) {
    const serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log(`🔐 Authenticated via GOOGLE_APPLICATION_CREDENTIALS: ${credPath}`);
  } else {
    console.error(
      '❌ No credentials found.\n' +
      '   Set FIREBASE_SERVICE_ACCOUNT_BASE64 or GOOGLE_APPLICATION_CREDENTIALS.'
    );
    process.exit(1);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Commit documents in chunks of BATCH_SIZE using set+merge (upsert).
 * @param {admin.firestore.Firestore} db
 * @param {Array<{ref: DocumentReference, data: object}>} ops
 * @param {string} label  - for logging
 */
async function batchUpsert(db, ops, label) {
  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would upsert ${ops.length} docs → ${label}`);
    return;
  }

  let committed = 0;
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const chunk = ops.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const { ref, data } of chunk) {
      batch.set(ref, data, { merge: true });
    }
    await batch.commit();
    committed += chunk.length;
    process.stdout.write(
      `\r  ✅ ${committed}/${ops.length} written → ${label}   `
    );
  }
  console.log(); // newline after progress
}

/** Parse a comma-separated string into a trimmed string array, ignoring empties. */
function parseCSVList(str) {
  if (!str || String(str).trim() === '') return [];
  return String(str).split(',').map(s => s.trim()).filter(Boolean);
}

/** Extract zone code prefix from table number e.g. "A121-3" → "A121" */
function tableToZoneCode(tableNum) {
  const match = String(tableNum).match(/^([A-Z]+\d+)-\d+$/);
  return match ? match[1] : null;
}

// ─── Sheet Transformers ─────────────────────────────────────────────────────

/**
 * Sheet 1486942240 → market_zones collection
 * Doc ID: zone_<ลำดับ>  (e.g. "zone_1")
 */
function transformMarketZones(rows) {
  return rows
    .filter(r => r['ลำดับ'] && r['ตลาด'])
    .map(r => {
      const id = String(r['ลำดับ']).trim();
      return {
        docId: `zone_${id}`,
        data: {
          id: Number(id),
          name: String(r['ตลาด']).trim(),
          banquetSeats: Number(r['จำนวนที่นั่งโต๊ะจีน']) || 0,
          registrationBooths: parseCSVList(r['บูธลงทะเบียน']),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      };
    });
}

/**
 * Sheet 1092783721 → seats collection
 * Doc ID: tableNumber itself  (e.g. "A121-1")  — naturally unique
 * Also stores zoneCode for efficient querying (e.g. "A121")
 */
function transformSeats(rows) {
  return rows
    .filter(r => r['เลขที่โต๊ะ'])
    .map(r => {
      const tableNumber = String(r['เลขที่โต๊ะ']).trim();
      const zoneCode = tableToZoneCode(tableNumber);
      return {
        docId: tableNumber,
        data: {
          seq: Number(r['ลำดับ']) || 0,
          tableNumber,
          zoneCode,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      };
    });
}

/**
 * Sheet 1981204303 → participants collection
 *
 * Doc ID strategy:
 *   - Normal rows: use ลำดับ (e.g. "2681")
 *   - VIP rows:    ลำดับ is empty; use เลขที่โต๊ะ as the doc ID (e.g. "VIP_C151-1")
 *     prefixed with "VIP_" to avoid collisions with numeric IDs.
 *
 * Relations:
 *   tableNumber → seats/<tableNumber>
 *   market      → (matches market_zones.name)
 */
function transformParticipants(rows) {
  const seen = new Set();
  const ops = [];

  for (const r of rows) {
    const seq = String(r['ลำดับ'] || '').trim();
    const name = String(r['ชื่อผู้ค้า'] || '').trim();
    const tableNumber = String(r['เลขที่โต๊ะ'] || '').trim();

    // Skip completely empty rows (no sequence, no name, no table)
    if (!seq && !name && !tableNumber) continue;

    // Derive a stable doc ID:
    //   - Normal participants: their ลำดับ number
    //   - VIP rows (empty ลำดับ): prefix "VIP_" + trimmed table number
    let docId;
    if (seq) {
      docId = seq;
    } else if (tableNumber) {
      docId = `VIP_${tableNumber}`;
    } else {
      // No usable ID — skip
      continue;
    }

    // Guard against duplicate doc IDs within the same sheet
    if (seen.has(docId)) continue;
    seen.add(docId);

    const zoneCode = tableNumber ? tableToZoneCode(tableNumber) : null;

    ops.push({
      docId,
      data: {
        seq: Number(seq) || 0,
        ชื่อผู้ค้า: name,
        ชื่อร้าน:  String(r['ชื่อร้าน']  || '').trim(),
        ตลาด:     String(r['ตลาด']     || '').trim(),
        เบอร์โทร: String(r['เบอร์โทร']  || '').trim(),
        เลขที่โต๊ะ: tableNumber,
        zoneCode,
        isVip: !seq && name.startsWith('VIP'),
        // Preserve existing check-in status fields if they already exist (merge: true does this).
        // These are set to empty string as defaults when document is new.
        สถานะการเข้างาน: '',
        เวลาอนุมัติ: '',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    });
  }

  return ops;
}

/**
 * Sheet 242605686 → boothMapping collection
 * This sheet is a zone-layout grid.
 * Doc ID: row index  (or derived zone group label)
 * We normalise it into individual table-zone group entries.
 */
function transformBoothMapping(rows) {
  // Filter only rows that contain actual zone codes (not header/empty rows)
  const entries = [];
  let groupLabel = '';

  for (const row of rows) {
    const cols = Object.entries(row).filter(([k]) => k !== '');
    const nonEmpty = cols.filter(([, v]) => v && String(v).trim() !== '');

    if (nonEmpty.length === 0) continue;

    // Detect group header rows (like "A2", "A3", etc.)
    const isHeader = nonEmpty.length === 1 && /^[A-F]\d$/.test(String(nonEmpty[0][1]).trim());
    if (isHeader) {
      groupLabel = String(nonEmpty[0][1]).trim();
      continue;
    }

    // Detect named zone annotation rows (like "อิสลาม", "แตงโม")
    const isAnnotation =
      nonEmpty.length === 1 &&
      !/^[A-F]\d{3}$/.test(String(nonEmpty[0][1]).trim());
    if (isAnnotation) continue;

    // Actual booth code rows — each column is a zone seat block
    const boothCodes = cols
      .map(([col, val]) => String(val || '').trim())
      .filter(Boolean);

    if (boothCodes.length > 0) {
      const docId = boothCodes[0]; // use the first code as natural ID
      entries.push({
        docId,
        data: {
          boothCodes,
          group: groupLabel || null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      });
    }
  }

  return entries;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Talad Thai — Full Firestore Seed from google_sheets_data.json ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (DRY_RUN) {
    console.log('⚠️  DRY-RUN mode — no data will be written to Firestore\n');
  }

  // Load data
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`❌ Data file not found: ${DATA_FILE}`);
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  console.log(`📂 Loaded: ${DATA_FILE}\n`);

  // Init Firebase (skip for dry-run to not require credentials)
  if (!DRY_RUN) {
    initFirebase();
  }

  const db = DRY_RUN ? null : admin.firestore();
  const ts = DRY_RUN ? null : admin.firestore.FieldValue.serverTimestamp;

  // ── 1. market_zones ────────────────────────────────────────────────────
  console.log(`\n📋 [1/4] market_zones (from sheet ${SHEET_IDS.MARKET_ZONES})`);
  const zoneRows = rawData[SHEET_IDS.MARKET_ZONES] || [];
  const zoneOps = transformMarketZones(zoneRows).map(({ docId, data }) => ({
    ref: DRY_RUN ? null : db.collection(COLLECTIONS.MARKET_ZONES).doc(docId),
    data,
    docId,
  }));
  console.log(`  Found ${zoneOps.length} market zones`);
  if (!DRY_RUN) await batchUpsert(db, zoneOps, COLLECTIONS.MARKET_ZONES);
  else console.log(`  [DRY-RUN] Would upsert ${zoneOps.length} docs → ${COLLECTIONS.MARKET_ZONES}`);

  // ── 2. seats ─────────────────────────────────────────────────────────
  console.log(`\n🪑 [2/4] seats (from sheet ${SHEET_IDS.SEATS})`);
  const seatRows = rawData[SHEET_IDS.SEATS] || [];
  const seatOps = transformSeats(seatRows).map(({ docId, data }) => ({
    ref: DRY_RUN ? null : db.collection(COLLECTIONS.SEATS).doc(docId),
    data,
    docId,
  }));
  console.log(`  Found ${seatOps.length} seat records`);
  if (!DRY_RUN) await batchUpsert(db, seatOps, COLLECTIONS.SEATS);
  else console.log(`  [DRY-RUN] Would upsert ${seatOps.length} docs → ${COLLECTIONS.SEATS}`);

  // ── 3. participants ────────────────────────────────────────────────────
  console.log(`\n👤 [3/4] participants (from sheet ${SHEET_IDS.VENDORS})`);
  const vendorRows = rawData[SHEET_IDS.VENDORS] || [];
  const participantOps = transformParticipants(vendorRows).map(({ docId, data }) => ({
    ref: DRY_RUN ? null : db.collection(COLLECTIONS.PARTICIPANTS).doc(docId),
    data,
    docId,
  }));
  console.log(`  Found ${participantOps.length} participant records`);
  if (!DRY_RUN) await batchUpsert(db, participantOps, COLLECTIONS.PARTICIPANTS);
  else console.log(`  [DRY-RUN] Would upsert ${participantOps.length} docs → ${COLLECTIONS.PARTICIPANTS}`);

  // ── 4. boothMapping ────────────────────────────────────────────────────
  console.log(`\n🗺️  [4/4] boothMapping (from sheet ${SHEET_IDS.BOOTH_LAYOUT})`);
  const layoutRows = rawData[SHEET_IDS.BOOTH_LAYOUT] || [];
  const boothOps = transformBoothMapping(layoutRows).map(({ docId, data }) => ({
    ref: DRY_RUN ? null : db.collection(COLLECTIONS.BOOTH_MAPPING).doc(docId),
    data,
    docId,
  }));
  console.log(`  Found ${boothOps.length} booth mapping entries`);
  if (!DRY_RUN) await batchUpsert(db, boothOps, COLLECTIONS.BOOTH_MAPPING);
  else console.log(`  [DRY-RUN] Would upsert ${boothOps.length} docs → ${COLLECTIONS.BOOTH_MAPPING}`);

  // ── Summary ─────────────────────────────────────────────────────────────
  const total = zoneOps.length + seatOps.length + participantOps.length + boothOps.length;
  console.log('\n══════════════════════════════════════════');
  console.log(`✅  Seed ${DRY_RUN ? 'simulation' : 'complete'}!`);
  console.log(`   market_zones  : ${zoneOps.length} docs`);
  console.log(`   seats         : ${seatOps.length} docs`);
  console.log(`   participants  : ${participantOps.length} docs`);
  console.log(`   boothMapping  : ${boothOps.length} docs`);
  console.log(`   Total         : ${total} docs`);
  console.log('══════════════════════════════════════════');

  if (!DRY_RUN) {
    const projectId = admin.app().options.credential?.projectId ||
                      JSON.parse(Buffer.from(
                        process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || 'e30=', 'base64'
                      ).toString()).project_id || 'talad-thai-checkin';
    console.log(`\n🔗 Verify: https://console.firebase.google.com/project/${projectId}/firestore`);
  }
}

main().catch(err => {
  console.error('\n❌ Seed failed:', err.message || err);
  process.exit(1);
});
