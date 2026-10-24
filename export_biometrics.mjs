import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const url = 'https://ppyasypabniuhoqpglay.supabase.co';
const key = 'sb_publishable_ZKBs3ehomxW6UVPL9II0IA_3cVIA55Q';
const client = createClient(url, key);

async function exportData() {
  const { data, error } = await client
    .from('canteen_employees')
    .select('id, name, dept, role, photo_url, face_descriptor, created_at');

  if (error) {
    console.error('Supabase error:', error);
    return;
  }

  console.log(`Found ${data.length} records in canteen_employees.`);
  
  const exportDir = path.join(process.cwd(), 'exported_faces');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const exportMetadata = [];

  for (const emp of data) {
    if (emp.id.startsWith('__SYSTEM_')) continue;

    let imageFileName = null;

    if (emp.photo_url) {
      if (emp.photo_url.startsWith('data:image/')) {
        // Base64 format
        const matches = emp.photo_url.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        if (matches) {
          const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
          const base64Data = matches[2];
          imageFileName = `${emp.id}_${emp.name.replace(/[^a-zA-Z0-9]/g, '_')}.${ext}`;
          const filePath = path.join(exportDir, imageFileName);
          fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
          console.log(`Saved image: ${imageFileName}`);
        }
      } else {
        imageFileName = emp.photo_url;
      }
    }

    exportMetadata.push({
      id: emp.id,
      name: emp.name,
      dept: emp.dept,
      role: emp.role,
      image_file: imageFileName,
      photo_url_raw: emp.photo_url,
      face_descriptor_128d: emp.face_descriptor,
      created_at: emp.created_at,
    });
  }

  const jsonPath = path.join(exportDir, 'biometric_roster_export.json');
  fs.writeFileSync(jsonPath, JSON.stringify(exportMetadata, null, 2), 'utf8');
  console.log(`Exported biometric descriptors to: ${jsonPath}`);
}

exportData();
