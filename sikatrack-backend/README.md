# SikaTrack Backend 🇬🇭

## Setup Instructions — Windows PC

### Step 1 — Install Node.js
1. Go to nodejs.org
2. Download the LTS version
3. Install it — just click Next, Next, Finish

### Step 2 — Set up the project
1. Create a folder on your Desktop called `sikatrack-backend`
2. Copy all these files into that folder
3. Open that folder in VS Code
4. Open the Terminal in VS Code (Ctrl + `)
5. Run: `npm install`

### Step 3 — Set up the database in Supabase
1. Go to supabase.com and open your sikatrack project
2. Click "SQL Editor" on the left sidebar
3. Copy everything from `database.sql`
4. Paste it into the SQL editor
5. Click "Run"
6. You should see: "SikaTrack database setup complete! 🇬🇭"

### Step 4 — Configure your .env file
The .env file already has your Supabase keys filled in.
You just need to add your Paystack key later.

### Step 5 — Run the server
In VS Code terminal run:
```
npm run dev
```

You should see:
```
╔══════════════════════════════════╗
║   SikaTrack API — Running! 🇬🇭   ║
║   http://localhost:3000          ║
╚══════════════════════════════════╝
```

### Step 6 — Test it works
Open your browser and go to:
http://localhost:3000

You should see:
```json
{
  "app": "SikaTrack API",
  "version": "2.0.0",
  "status": "running"
}
```

### Step 7 — Deploy to Render (free hosting)
1. Push your code to GitHub
2. Go to render.com — sign up free
3. Click "New Web Service"
4. Connect your GitHub repo
5. Set environment variables (same as .env file)
6. Deploy — Render gives you a free URL like:
   https://sikatrack-api.onrender.com

---

## API Endpoints

### Auth
- POST /auth/send-otp     — Send OTP to phone
- POST /auth/verify-otp   — Verify OTP and get token
- GET  /auth/me           — Get current user

### Sales
- GET    /sales           — Get all sales
- POST   /sales           — Add sale
- DELETE /sales/:id       — Delete sale
- DELETE /sales           — Clear all sales

### Expenses
- GET    /expenses        — Get all expenses
- POST   /expenses        — Add expense
- DELETE /expenses/:id    — Delete expense
- DELETE /expenses        — Clear all expenses

### Inventory
- GET    /inventory       — Get all items
- POST   /inventory       — Add item
- PATCH  /inventory/:id   — Update stock
- DELETE /inventory/:id   — Delete item

### Payments
- GET  /payments/status      — Check subscription
- POST /payments/initialize  — Start payment
- GET  /payments/verify      — Verify payment

---

## Tech Stack
- Node.js + Express
- Supabase (PostgreSQL database)
- JWT authentication
- Paystack payments (Ghana mobile money)
- Deployed on Render (free)
