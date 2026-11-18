import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function clearFaces() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/canteen_db';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB:', uri);
  
  const res = await mongoose.connection.db.collection('employees').updateMany(
    {},
    {
      $set: {
        face_descriptor: null,
        photo_url: '',
        confidence_score: 0
      },
      $unset: {
        face_vector: '',
        descriptor: ''
      }
    }
  );
  
  console.log(`Successfully cleared face registry: ${res.modifiedCount} employees updated.`);
  await mongoose.disconnect();
  process.exit(0);
}

clearFaces().catch(err => {
  console.error(err);
  process.exit(1);
});
