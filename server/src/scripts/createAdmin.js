import bcrypt from 'bcrypt';
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';

const name = process.env.ADMIN_NAME?.trim();
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (!name || name.length < 2 || name.length > 80 || !emailPattern.test(email ?? '') || !password || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
  console.error('Set ADMIN_NAME, ADMIN_EMAIL, and an ADMIN_PASSWORD of 12 to 72 UTF-8 bytes in the current shell.');
  process.exit(1);
}

try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const existingUser = await User.exists({ email });

  if (existingUser) {
    throw new Error('That email already belongs to a LaundryAI user. No account was changed.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await User.create({ name, email, passwordHash, role: 'admin' });
  console.log(`Admin account created for ${admin.email}. Clear ADMIN_PASSWORD from the shell when finished.`);
} catch (error) {
  console.error(`Could not create admin account: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
