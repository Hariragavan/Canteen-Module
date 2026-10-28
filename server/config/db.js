import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/canteen_db';

// Cache connection across serverless invocations (e.g. Vercel)
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export const connectDB = async () => {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      serverSelectionTimeoutMS: 10000,
      autoIndex: true,
      maxPoolSize: 10,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => {
      console.log(`[MongoDB] Connected successfully to host: ${m.connection.host}, database: ${m.connection.name}`);
      return m;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    console.error(`[MongoDB] Connection error: ${error.message}`);
    console.warn(`[MongoDB] Ensure MongoDB Atlas network access (0.0.0.0/0) is allowed and credentials are correct.`);
  }

  return cached.conn;
};

export const getDbStatus = () => {
  return {
    isConnected: mongoose.connection.readyState === 1,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host || '127.0.0.1',
    name: mongoose.connection.name || 'canteen_db',
    uri: MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'), // Mask password if Atlas URI
  };
};
