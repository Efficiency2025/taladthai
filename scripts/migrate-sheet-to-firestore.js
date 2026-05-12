#!/usr/bin/env node
/**
 * One-time migration: Google Sheet CSV → Firestore
 *
 * Usage:
 *   1. Export the Google Sheet as a CSV file (File > Download > CSV)
 *   2. Save it as scripts/participants.csv and scripts/booth-mapping.csv
 *   3. Run:  node scripts/migrate-sheet-to-firestore.js
 *
 * Requires:
 *   npm install firebase-admin papaparse
 *   (or use the project's existing papaparse)
 *
 * Environment:
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json
 *
 * This script uses firebase-admin (server SDK) NOT the client SDK.
 */

import { readFileSync, existsSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import Papa from 'papaparse';

// --- Configuration ---
const PROJECT_ID = 'talad-thai-checkin';
const PARTICIPANTS_CSV = new URL('./participants.csv', import.meta.url).pathname;
const BOOTH_CSV = new URL('./booth-mapping.csv', import.meta.url).pathname;

// --- Initialize Firebase Admin ---
let app;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  app = initializeApp({ projectId: PROJECT_ID });
} else {
  console.warn('⚠️  GOOGLE_APPLICATION_CREDENTIALS not set.');
  console.warn('   Using default credentials (works if running on GCP or with gcloud auth).');
  app = initializeApp({ projectId: PROJECT_ID });
}

const db = getFirestore();

// --- Helpers ---
function parseCSV(filePath) {
  if (!existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }
  const csv = readFileSync(filePath, 'utf8');
  const { data, errors } = Papa.parse(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (errors.length > 0) {
    console.warn('⚠️  CSV parse warnings:', errors);
  }
  return data;
}

/**
 * Upload an array of objects to a Firestore collection using batch writes.
 * @param {string} collectionName
 * @param {Array<Object>} rows
 */
async function uploadToCollection(collectionName, rows) {
  const BATCH_SIZE = 500; // Firestore batch limit
  let uploaded = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = rows.slice(i, i + BATCH_SIZE);

    for (const row of chunk) {
      const ref = db.collection(collectionName).doc(); // auto-generated ID
      batch.set(ref, row);
    }

    await batch.commit();
    uploaded += chunk.length;
    console.log(`  ✅ ${uploaded}/${rows.length} documents written to '${collectionName}'`);
  }
}

// --- Main ---
async function main() {
  console.log('🚀 Talad Thai — Google Sheet → Firestore Migration\n');

  // 1. Migrate participants
  console.log(`📄 Reading participants from: ${PARTICIPANTS_CSV}`);
  const participants = parseCSV(PARTICIPANTS_CSV);
  console.log(`   Found ${participants.length} participant rows`);

  // Clean up empty string values & ensure status fields
  const cleanParticipants = participants.map((row, idx) => {
    const clean = {};
    for (const [key, value] of Object.entries(row)) {
      if (key) {
        clean[key] = (value || '').trim();
      }
    }
    // Ensure required fields exist
    clean['สถานะการเข้างาน'] = clean['สถานะการเข้างาน'] || '';
    clean['เวลาอนุมัติ'] = clean['เวลาอนุมัติ'] || '';
    return clean;
  });

  console.log(`\n📤 Uploading ${cleanParticipants.length} participants to Firestore...`);
  await uploadToCollection('participants', cleanParticipants);

  // 2. Migrate booth mapping
  if (existsSync(BOOTH_CSV)) {
    console.log(`\n📄 Reading booth mapping from: ${BOOTH_CSV}`);
    const booths = parseCSV(BOOTH_CSV);
    console.log(`   Found ${booths.length} booth mapping rows`);

    const cleanBooths = booths.map(row => {
      const clean = {};
      for (const [key, value] of Object.entries(row)) {
        if (key) {
          // Try to parse numeric values
          const numVal = Number(value);
          clean[key] = (!isNaN(numVal) && key.includes('จำนวน')) ? numVal : (value || '').trim();
        }
      }
      return clean;
    });

    console.log(`\n📤 Uploading ${cleanBooths.length} booth mappings to Firestore...`);
    await uploadToCollection('boothMapping', cleanBooths);
  } else {
    console.log(`\n⏭️  Skipping booth mapping (${BOOTH_CSV} not found)`);
  }

  console.log('\n✅ Migration complete!');
  console.log(`   Project: ${PROJECT_ID}`);
  console.log('   Verify data at: https://console.firebase.google.com/project/' + PROJECT_ID + '/firestore');
}

main().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
