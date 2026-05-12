#!/usr/bin/env node
/**
 * Export Firestore data back to CSV for Google Sheets.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json node scripts/export-firestore-to-csv.js
 *
 * Output:
 *   scripts/export-participants.csv
 *   scripts/export-booth-mapping.csv
 */

import { writeFileSync } from 'fs';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import Papa from 'papaparse';

const PROJECT_ID = 'talad-thai-checkin';

initializeApp({ projectId: PROJECT_ID });
const db = getFirestore();

async function exportCollection(collectionName, outputPath) {
  console.log(`📥 Reading '${collectionName}' from Firestore...`);
  const snapshot = await db.collection(collectionName).get();
  const rows = snapshot.docs.map(doc => doc.data());

  console.log(`   Found ${rows.length} documents`);

  if (rows.length === 0) {
    console.log('   ⏭️  Skipping empty collection');
    return;
  }

  const csv = Papa.unparse(rows);
  writeFileSync(outputPath, csv, 'utf8');
  console.log(`   ✅ Exported to ${outputPath}`);
}

async function main() {
  console.log('📦 Talad Thai — Firestore → CSV Export\n');

  await exportCollection('participants', new URL('./export-participants.csv', import.meta.url).pathname);
  await exportCollection('boothMapping', new URL('./export-booth-mapping.csv', import.meta.url).pathname);

  console.log('\n✅ Export complete!');
  console.log('   You can import these CSV files into Google Sheets.');
}

main().catch(err => {
  console.error('❌ Export failed:', err);
  process.exit(1);
});
