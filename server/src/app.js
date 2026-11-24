import cookieParser from 'cookie-parser';
import express from 'express';
import mongoose from 'mongoose';
import adminRoutes from './routes/adminRoutes.js';
import adminServiceRoutes from './routes/adminServiceRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import serviceRoutes from './routes/serviceRoutes.js';
import authRoutes from './routes/authRoutes.js';

const app = express();

app.disable('x-powered-by');
app.use((_request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  if (process.env.NODE_ENV === 'production') {
    response.setHeader('Strict-Transport-Security', 'max-age=31536000');
  }
  next();
});
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.get('/api/health', (_request, response) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  response.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? 'ok' : 'unavailable',
    message: 'LaundryAI API is running.',
    database: databaseConnected ? 'connected' : 'disconnected',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin/services', adminServiceRoutes);
app.use('/api/admin', adminRoutes);

app.use((_request, response) => {
  response.status(404).json({ message: 'The requested API route was not found.' });
});

app.use((error, _request, response, _next) => {
  if (error.status === 400 && error.type === 'entity.parse.failed') {
    return response.status(400).json({ message: 'Request body must contain valid JSON.' });
  }

  if (error.status && error.status < 500) {
    return response.status(error.status).json({ message: error.message });
  }

  console.error(error.message);
  return response.status(500).json({ message: 'An unexpected server error occurred.' });
});

export default app;
