# LaundryAI

AI-powered laundry booking and management system built with React, Vite, Express, and MongoDB.

## Requirements
- Node.js 20 or newer (Node 22 LTS recommended)
- npm
- MongoDB Community Server running locally, or a MongoDB connection URI

## Run locally

1. Start MongoDB.
2. In PowerShell, from the project root, prepare the backend environment:

       Copy-Item server/.env.example server/.env
       node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"

   Copy the generated value into JWT_SECRET in server/.env. Keep that file private.
3. Install and start the backend:

       cd server
       npm install
       npm run dev

4. In another terminal, install and start the frontend:

       cd client
       npm install
       npm run dev

5. Open the Vite URL, normally http://localhost:5173. The Vite development proxy forwards /api to http://localhost:5000.

The example MongoDB URI uses the LaundryAI database. The backend exits at startup if MongoDB or a secure JWT secret is unavailable.

## Create the first administrator

Public registration creates customers only. In a backend PowerShell terminal, set admin details and run the existing script:

       $env:ADMIN_NAME = 'LaundryAI Admin'
       $env:ADMIN_EMAIL = Read-Host 'Admin email'
       $securePassword = Read-Host 'Admin password' -AsSecureString
       $env:ADMIN_PASSWORD = (New-Object System.Net.NetworkCredential('', $securePassword)).Password
       npm run create-admin
       Remove-Item Env:ADMIN_NAME, Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD
       Remove-Variable securePassword

Use a unique password with at least 12 characters. The script refuses to change an existing user's role.

## Production build and start

Build the frontend from the client folder using npm run build. Start the backend from the server folder with NODE_ENV=production set using npm start.

server/.env.example lists backend variables. Set MONGO_URI to the production MongoDB URI and JWT_SECRET to a securely generated random secret of at least 32 characters. Never put backend secrets in VITE_ variables or frontend files.

## Deployment checklist

- Serve the built client/dist frontend over HTTPS.
- Route frontend /api requests to Express on the same origin using the hosting platform's reverse proxy.
- Keep frontend and API same-origin. This preserves the HTTP-only, Secure in production, SameSite=Strict cookie and avoids enabling broad CORS access.
- Set NODE_ENV=production, PORT, MONGO_URI, and a strong JWT_SECRET in the deployment platform's private environment settings.
- Restrict production MongoDB network access and use a database user with only the permissions the app needs.
- Create the admin through npm run create-admin using private shell environment variables; do not seed an admin password in source code.
- Confirm /api/health reports database connected after deployment.
- Run npm audit in both server and client, and keep dependency lock files committed.
- Confirm .env files are ignored by Git; commit .env.example only.
- Configure the frontend hosting layer to serve security headers and HTTPS. The Express API sets security headers and enables HSTS in production.
- Back up MongoDB and verify the restore procedure before accepting real bookings.

The application has no online payments, WhatsApp notifications, or paid AI API integration in this version.

## Included customer and admin tools

- Customers can register, sign in, update their display name, make and track bookings, and use the rule-based LaundryAI assistant.
- The assistant answers from the current service catalog and requires explicit confirmation before booking. Voice input/output use browser Web Speech APIs when available.
- Admins can manage order statuses and activate or deactivate catalog services.
- Successful bookings, profile changes, service changes, and order status changes show in-app notifications. The admin dashboard checks for new bookings every minute while open; customer dashboards refresh booking status every minute and show the latest admin update.
- Registration and sign-in are rate-limited in each backend process. In a multi-instance deployment, add shared rate-limit storage or equivalent edge protection.
- No paid generative AI service is configured. Current FAQs and booking assistance work without external AI. WhatsApp remains postponed.

For a deployment behind a reverse proxy, set TRUST_PROXY_HOPS to the exact number of trusted proxy hops. Keep the Express server unreachable directly from the public internet when proxy trust is enabled. The local default is 0.
