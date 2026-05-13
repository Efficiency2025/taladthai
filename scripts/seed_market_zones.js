import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin SDK
// Uses FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable
if (!admin.apps.length) {
  const base64Creds = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!base64Creds) {
    console.error("Missing FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable.");
    process.exit(1);
  }
  const serviceAccount = JSON.parse(Buffer.from(base64Creds, 'base64').toString('utf8'));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const COLLECTION_NAME = 'market_zones';
const DATA_FILE_PATH = path.join(__dirname, 'market_zones_data.json');

async function seedData() {
  try {
    console.log(`Reading JSON data from local file...`);
    const fileContent = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
    const zones = JSON.parse(fileContent);
    console.log(`Starting to seed/update ${zones.length} zones into '${COLLECTION_NAME}' collection...`);

    let count = 0;
    const batch = db.batch();

    for (const zone of zones) {
      const id = zone.id;
      if (!id) continue; // Skip empty rows

      // Using the unique id as the document ID helps avoid duplicates
      const docRef = db.collection(COLLECTION_NAME).doc(id.toString());
      
      const registrationBoothRaw = zone.registration_booth;
      const boothArray = registrationBoothRaw 
        ? registrationBoothRaw.toString().split(',').map(s => s.trim()) 
        : [];

      // .set with { merge: true } performs an update if it exists, or creates it if it doesn't
      batch.set(docRef, {
        originalId: Number(id),
        name: zone.name || '',
        chineseBanquetSeats: Number(zone.chinese_banquet_seats) || 0,
        registrationBooth: boothArray,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      count++;
    }

    await batch.commit();
    console.log(`Successfully seeded/updated ${count} zones.`);
    
  } catch (error) {
    console.error('Error seeding data:', error);
  }
}

seedData();
