import 'dotenv/config';
import app from './app.js';
import { connectDatabase } from './config/database.js';
import { isJwtConfigured } from './middleware/auth.js';

const port = Number(process.env.PORT || 5000);

async function startServer() {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port number.');
  }
  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 5) {
    throw new Error('TRUST_PROXY_HOPS must be a number from 0 to 5.');
  }
  app.set('trust proxy', trustProxyHops);

  if (!isJwtConfigured()) {
    throw new Error('JWT_SECRET must be a random secret with at least 32 characters.');
  }

  await connectDatabase();
  app.listen(port, () => {
    console.log('LaundryAI API is running on port ' + port + '.');
  });
}

startServer().catch(error => {
  console.error('LaundryAI could not start: ' + error.message);
  process.exitCode = 1;
});
