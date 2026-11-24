import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export function isJwtConfigured() {
  const secret = process.env.JWT_SECRET;
  return typeof secret === 'string' && secret.length >= 32 && secret !== 'replace-with-a-long-random-secret';
}

export function createToken(user) {
  if (!isJwtConfigured()) {
    throw new Error('JWT_SECRET is not securely configured.');
  }

  return jwt.sign(
    { sub: user.id, tokenVersion: user.tokenVersion ?? 0 },
    process.env.JWT_SECRET,
    { expiresIn: '1d' },
  );
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
};

export function sendLoginCookie(response, user) {
  response.cookie('laundryai_token', createToken(user), {
    ...cookieOptions,
    maxAge: 24 * 60 * 60 * 1000,
  });
}

export async function authenticate(request, response, next) {
  const token = request.cookies?.laundryai_token;

  if (!token) {
    return response.status(401).json({ message: 'Authentication is required.' });
  }

  if (!isJwtConfigured()) {
    return next(new Error('JWT_SECRET is not securely configured.'));
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return response.status(401).json({ message: 'Your session is invalid or has expired. Please sign in again.' });
  }

  try {
    const user = await User.findById(payload.sub);
    if (!user) {
      return response.status(401).json({ message: 'Your account is no longer available.' });
    }

    const currentVersion = Number.isInteger(user.tokenVersion) ? user.tokenVersion : 0;
    const tokenVersion = Number.isInteger(payload.tokenVersion) ? payload.tokenVersion : 0;
    if (tokenVersion !== currentVersion) {
      return response.status(401).json({ message: 'Your session is invalid or has expired. Please sign in again.' });
    }

    request.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireAdmin(request, response, next) {
  if (request.user?.role !== 'admin') {
    return response.status(403).json({ message: 'Administrator access is required.' });
  }

  return next();
}


export function requireCustomer(request, response, next) {
  if (request.user?.role !== 'customer') {
    return response.status(403).json({ message: 'Customer access is required.' });
  }

  return next();
}

