# LaundryAI

## Run locally

1. Start MongoDB Community Server.
2. In PowerShell, open the backend folder and prepare its private environment file:

   ```powershell
   cd server
   Copy-Item .env.example .env
   node -e "console.log(require('node:crypto').randomBytes(64).toString('hex'))"
   ```

   Put the generated value in `JWT_SECRET` in `server/.env`. Keep `.env` private. The MongoDB URI in the example uses the existing `LaundryAI` database.

3. Start the API in the backend terminal:

   ```powershell
   npm install
   npm run dev
   ```

4. In a second terminal, start the frontend:

   ```powershell
   cd client
   npm install
   npm run dev
   ```

5. Open the URL printed by Vite, usually `http://localhost:5173`.

## Create the first administrator

Public registration always creates a customer. To create the first admin, open a backend terminal and set the account details only in that terminal. Use a password with at least 12 characters:

```powershell
$env:ADMIN_NAME = 'LaundryAI Admin'
$env:ADMIN_EMAIL = Read-Host 'Admin email'
$securePassword = Read-Host 'Admin password' -AsSecureString
$env:ADMIN_PASSWORD = (New-Object System.Net.NetworkCredential('', $securePassword)).Password
npm run create-admin
Remove-Item Env:ADMIN_NAME, Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD
Remove-Variable securePassword
```

The script creates a new admin account and refuses to change an existing user's role. Sign in through the Admin option in the frontend.
