# AttendEase — College Attendance System

This is the existing Next.js application with its UI and pages retained. MongoDB is the persistent database; MongoDB Compass is used to inspect the same server/database. Postman can create students and mark attendance through the API.

## Requirements

- Node.js 20.9+ (Node 22 recommended)
- MongoDB Community Server running locally, or a MongoDB Atlas cluster
- MongoDB Compass (optional, for viewing documents)

## Local setup with Compass

1. Start MongoDB Community Server. In Compass, connect to `mongodb://127.0.0.1:27017`.
2. Copy `.env.example` to `.env.local` in the project root.
3. Set `MONGODB_URI=mongodb://127.0.0.1:27017/attendease` and `MONGODB_DB=attendease`. For Atlas, use the same Atlas URI in both the app configuration and Compass.
4. Run:

   ```bash
   npm install
   npm run seed
   npm run dev
   ```

5. Open `http://localhost:3000`. The local demo login is `admin@attendease.local` / `admin123` unless you configured a different initial admin password before the first user was created.
6. Check `http://localhost:3000/api/test-db`. In Compass, refresh the `attendease` database to see `students`, `attendance`, and `users` collections.

`npm run seed` imports any legacy `data/db.json` records it can add without overwriting MongoDB documents, then adds sample students with ERP IDs `DEMO1001`–`DEMO1005` and a current-day sample attendance record if absent. It is safe to rerun. It does not reset existing records or change existing user passwords.

## Postman

Import `AttendEase.postman_collection.json`. Run **Login** first so Postman stores the `attendease_session` cookie, then run the student and attendance requests. Full examples and the `PUT` replacement behavior are documented in [POSTMAN.md](./POSTMAN.md).

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — production server
- `npm run lint` — ESLint
- `npm run seed` — idempotently add example data to MongoDB

## Data safety

`POST /api/students` adds one student. `POST /api/attendance` marks attendance for an existing ERP ID. `PUT /api/students` and `PUT /api/attendance` replace their entire respective collections to preserve the current frontend's bulk-save contract; do not send an empty array unless you intend to clear that collection. Back up existing data before manual database cleanup.
