import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

export async function connectDatabase() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGO_URI is not set.');
  }

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB.');
  } catch {
    throw new Error('MongoDB connection failed. Check MONGO_URI and database availability.');
  }
}
