import bcrypt from 'bcrypt';
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { authenticate, cookieOptions, isJwtConfigured, requireCustomer, sendLoginCookie } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const bcryptRounds = 12;
const limitRegistration = createRateLimiter({ windowMs: 60 * 60 * 1000, maxRequests: 5, message: 'Too many registration attempts. Try again in an hour.' });
const limitLogin = createRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 10, message: 'Too many sign-in attempts. Try again in 15 minutes.' });

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

function validEmail(email) {
  return typeof email === 'string' && email.length <= 254 && emailPattern.test(email.trim());
}

function validPassword(password) {
  return typeof password === 'string' && password.length >= 8 && Buffer.byteLength(password, 'utf8') <= 72;
}

async function login(request, response, role) {
  const { email, password } = request.body ?? {};

  if (!validEmail(email) || typeof password !== 'string' || password.length === 0 || Buffer.byteLength(password, 'utf8') > 72) {
    return response.status(400).json({ message: 'Enter a valid email and password.' });
  }

  const user = await User.findOne({ email: email.trim().toLowerCase(), role }).select('+passwordHash');
  if (!user || !(await user.checkPassword(password))) {
    return response.status(401).json({ message: 'Email or password is incorrect.' });
  }

  sendLoginCookie(response, user);
  return response.json({ message: 'Signed in successfully.', user: publicUser(user) });
}

router.post('/register', limitRegistration, async (request, response, next) => {
  try {
    const { name, email, password } = request.body ?? {};
    const cleanName = typeof name === 'string' ? name.trim() : '';

    if (cleanName.length < 2 || cleanName.length > 80) {
      return response.status(400).json({ message: 'Name must be between 2 and 80 characters.' });
    }
    if (!validEmail(email)) {
      return response.status(400).json({ message: 'Enter a valid email address.' });
    }
    if (!validPassword(password)) {
      return response.status(400).json({ message: 'Password must be 8 or more characters and no more than 72 UTF-8 bytes.' });
    }
    if (!isJwtConfigured()) {
      return response.status(500).json({ message: 'Authentication is not configured on the server.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, bcryptRounds);
    const user = await User.create({
      name: cleanName,
      email: normalizedEmail,
      passwordHash,
      role: 'customer',
    });

    sendLoginCookie(response, user);
    return response.status(201).json({ message: 'Account created successfully.', user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      return response.status(409).json({ message: 'An account with that email already exists.' });
    }
    return next(error);
  }
});

router.post('/login', limitLogin, async (request, response, next) => {
  try {
    if (!isJwtConfigured()) {
      return response.status(500).json({ message: 'Authentication is not configured on the server.' });
    }
    return await login(request, response, 'customer');
  } catch (error) {
    return next(error);
  }
});

router.post('/admin/login', limitLogin, async (request, response, next) => {
  try {
    if (!isJwtConfigured()) {
      return response.status(500).json({ message: 'Authentication is not configured on the server.' });
    }
    return await login(request, response, 'admin');
  } catch (error) {
    return next(error);
  }
});

router.post('/logout', async (request, response, next) => {
  const token = request.cookies?.laundryai_token;
  response.clearCookie('laundryai_token', cookieOptions);

  if (token && isJwtConfigured()) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (typeof payload.sub === 'string') {
        await User.updateOne({ _id: payload.sub }, { $inc: { tokenVersion: 1 } });
      }
    } catch (error) {
      if (!(error instanceof jwt.JsonWebTokenError)) return next(error);
    }
  }

  return response.status(204).end();
});

router.patch('/me', authenticate, requireCustomer, async (request, response, next) => {
  try {
    const body = request.body ?? {};
    if (Object.keys(body).length !== 1 || typeof body.name !== 'string') {
      return response.status(400).json({ message: 'Only the profile name can be changed.' });
    }

    const name = body.name.trim();
    if (name.length < 2 || name.length > 80) {
      return response.status(400).json({ message: 'Name must be between 2 and 80 characters.' });
    }

    request.user.name = name;
    await request.user.save();
    return response.json({ message: 'Profile updated.', user: publicUser(request.user) });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', authenticate, (request, response) => {
  response.json({ user: publicUser(request.user) });
});

export default router;

