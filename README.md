# Library Management System — Neon + Render

This version keeps the existing HTML/CSS/JS interface and adds a Node.js/Express backend, Neon PostgreSQL persistence, hashed-password authentication, secure HTTP-only login sessions, and Render deployment support.

## Stack
- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js + Express
- Database: Neon PostgreSQL
- Auth: bcrypt password hashes + JWT stored in an HTTP-only cookie
- Hosting: Render Web Service

## Local setup
1. Install Node.js 20+.
2. Create a Neon project and copy its PostgreSQL connection string.
3. Copy `.env.example` to `.env`.
4. Set `DATABASE_URL` and a long random `JWT_SECRET`.
5. Run `npm install`.
6. Run `npm start`.
7. Open `http://localhost:3000`.

The server automatically creates the required `users` and `app_state` tables on first start.

## Initial logins
These accounts are inserted only when the `users` table is empty:
- Admin: `admin` / `admin123`
- Librarian: `librarian` / `lib123`
- Member: `arun@lib.com` / `member123`

Change production passwords after the first deployment. Demo credentials should not be treated as permanent production credentials.

## Deploy to Render
1. Push this project to GitHub.
2. In Render, create a new **Web Service** from the GitHub repository, or use the included `render.yaml` Blueprint.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add the Neon connection string as `DATABASE_URL`.
6. Add a long random value as `JWT_SECRET` (Blueprint deployment can generate this automatically).
7. Set `NODE_ENV=production`.
8. Deploy. Render will provide an HTTPS `onrender.com` URL.

## Important
- Never commit `.env` or your real Neon database password.
- The first staff login initializes the existing demo library state in Neon if the database has no library state yet.
- Staff changes are persisted to Neon. Member profile changes are also persisted through the backend.

## V6 interface
- Blue liquid-glass authentication card over the photographic library wallpaper.
- Full liquid-glass admin/member shell with colored inline SVG navigation icons.
- Light/dark theme toggle stored in the browser.
- Live local clock with seconds in the top bar.
- Existing Neon/JWT authentication and cloud state APIs are unchanged.

## V7 visual update
Raised 3D liquid-glass surfaces, dimensional statistic cards, hover lift/perspective, deeper sidebar/topbar layers, dark-mode glow depth, and tactile button states. Backend/auth/database behavior is unchanged.
