import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Employee } from './models/Employee.js';
import { MealSlot } from './models/MealSlot.js';
import { TransportUnit } from './models/TransportUnit.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/canteen_db';

const DEFAULT_MEAL_SLOTS = [
  {
    name: 'Tiffin',
    startTime: '07:30',
    endTime: '11:00',
    displayName: 'Tiffin',
    tamilDisplayName: 'காலை உணவு',
    emoji: '🥞',
    category: 'Morning',
    description: '',
    rate: 40,
    cost: 40,
    isEligible: true,
    isActive: true,
  },
  {
    name: 'Lunch',
    startTime: '12:00',
    endTime: '15:30',
    displayName: 'Lunch',
    tamilDisplayName: 'மதிய உணவு',
    emoji: '🍛',
    category: 'Active Now',
    description: '',
    rate: 40,
    cost: 40,
    isEligible: true,
    isActive: true,
  },
  {
    name: 'Tea/Snacks',
    startTime: '15:30',
    endTime: '18:30',
    displayName: 'Tea/Snacks',
    tamilDisplayName: 'தேநீர் & ஸ்நாக்ஸ்',
    emoji: '☕',
    category: 'Evening',
    description: '',
    rate: 20,
    cost: 20,
    isEligible: true,
    isActive: true,
  },
];

const DEFAULT_TRANSPORT_UNITS = [
  { id: 'UNIT-1', name: 'Unit 1 - Spinning Division', location: 'Block A, North Wing', contactPerson: 'Suresh Kumar' },
  { id: 'UNIT-2', name: 'Unit 2 - Weaving Division', location: 'Block B, Main Plant', contactPerson: 'Murugan R' },
  { id: 'UNIT-3', name: 'Unit 3 - Processing & Dyeing', location: 'Industrial Sector 4', contactPerson: 'Anand P' },
  { id: 'UNIT-4', name: 'Unit 4 - Garments & Packing', location: 'South Campus Gate 2', contactPerson: 'Karthik S' },
  { id: 'UNIT-HQ', name: 'Admin Block & Executive Office', location: 'Central Headquarters', contactPerson: 'HR Frontdesk' },
];

async function runImport() {
  console.log(`[Import] Connecting to MongoDB: ${MONGODB_URI}...`);
  await mongoose.connect(MONGODB_URI);
  console.log('[Import] Connected to MongoDB.');

  // 1. Seed Default Meal Slots if not present
  for (const slot of DEFAULT_MEAL_SLOTS) {
    await MealSlot.findOneAndUpdate({ name: slot.name }, { $setOnInsert: slot }, { upsert: true });
  }
  console.log('[Import] Meal slots checked/initialized.');

  // 2. Seed Default Transport Units if not present
  for (const u of DEFAULT_TRANSPORT_UNITS) {
    await TransportUnit.findOneAndUpdate({ id: u.id }, { $setOnInsert: u }, { upsert: true });
  }
  console.log('[Import] Transport units checked/initialized.');

  // 3. Locate exported biometric JSON file (supports CLI argument: node server/import_exported_faces.js <path>)
  let jsonPath = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : null;

  if (!jsonPath || !fs.existsSync(jsonPath)) {
    const candidatePaths = [
      path.join(__dirname, '..', 'exported_faces', 'biometric_roster_export.json'),
      path.join(process.cwd(), 'exported_faces', 'biometric_roster_export.json'),
      path.join(process.env.USERPROFILE || 'C:\\Users\\Texplus-3', 'Downloads', 'exported_faces', 'biometric_roster_export.json'),
    ];

    // Also look for any *.json in ./exported_faces/
    const exportedDir = path.join(process.cwd(), 'exported_faces');
    if (fs.existsSync(exportedDir)) {
      const files = fs.readdirSync(exportedDir).filter((f) => f.endsWith('.json'));
      if (files.length > 0) {
        candidatePaths.unshift(path.join(exportedDir, files[0]));
      }
    }

    jsonPath = candidatePaths.find((p) => fs.existsSync(p));
  }

  if (!jsonPath || !fs.existsSync(jsonPath)) {
    console.warn('[Import] biometric JSON file not found in candidate paths:');
    console.log('Usage: node server/import_exported_faces.js [path/to/exported.json]');
    await mongoose.disconnect();
    return;
  }

  console.log(`[Import] Reading exported faces from: ${jsonPath}`);
  const rawData = fs.readFileSync(jsonPath, 'utf8');
  const roster = JSON.parse(rawData);

  console.log(`[Import] Processing ${roster.length} employee records...`);
  let importedCount = 0;
  let updatedCount = 0;

  for (const emp of roster) {
    if (!emp.id || String(emp.id).startsWith('__SYSTEM_')) continue;

    const cleanId = String(emp.id).trim().toUpperCase();
    const faceDescriptor = emp.face_descriptor_128d || emp.face_descriptor || emp.embedding || null;

    const doc = {
      id: cleanId,
      name: String(emp.name).trim(),
      dept: emp.dept || 'Employee',
      role: emp.role || (emp.dept?.toLowerCase().includes('staff') ? 'Staff' : 'Employee'),
      photo_url: emp.photo_url_raw || emp.photo_url || emp.photo || '',
      face_descriptor: Array.isArray(faceDescriptor) ? faceDescriptor.map(Number) : null,
      confidence_score: emp.confidence_score || emp.confidence || 0.98,
      subsidy_rate: emp.subsidy_rate || emp.subsidyRate || 1.0,
      is_active: true,
    };

    const res = await Employee.findOneAndUpdate(
      { id: cleanId },
      { $set: doc },
      { upsert: true, returnDocument: 'after', rawResult: true }
    );

    if (res.lastErrorObject?.updatedExisting) {
      updatedCount++;
    } else {
      importedCount++;
    }
  }

  console.log(`[Import] Finished: ${importedCount} created, ${updatedCount} updated.`);
  const totalInDb = await Employee.countDocuments();
  console.log(`[Import] Total employees in MongoDB 'employees' collection: ${totalInDb}`);

  await mongoose.disconnect();
  console.log('[Import] MongoDB disconnected.');
}

runImport().catch((err) => {
  console.error('[Import] Error:', err);
  process.exit(1);
});
