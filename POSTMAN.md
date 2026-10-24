# AttendEase: MongoDB Compass + Postman setup

This project connects to **MongoDB Server**, while Compass is the desktop GUI used to inspect the same database. Compass does not itself host the database.

## 1. Configure local MongoDB

1. Start MongoDB Community Server on your computer.
2. Open Compass and connect to `mongodb://127.0.0.1:27017`.
3. Copy `.env.example` to `.env.local` (do not name it `.env.local.txt`).
4. Set the following values in `.env.local`:

   ```env
   MONGODB_URI=mongodb://127.0.0.1:27017/attendease
   MONGODB_DB=attendease
   DEFAULT_ADMIN_PASSWORD=admin123
   ```

   For Atlas, replace `MONGODB_URI` with the Atlas connection string and use that same cluster in Compass.

5. Install and seed example data:

   ```bash
   npm install
   npm run seed
   npm run dev
   ```

   `npm run seed` is safe to rerun: it preserves existing records and adds only missing demo ERP IDs. It adds the original example student (`6605745`), five `DEMO1001`–`DEMO1005` students when absent, and a current-day sample attendance record for Computer Science, 3rd Year, Section A when absent. It creates the default administrator only if the `users` collection is empty.

6. In Compass, refresh the `attendease` database. Expected collections after seeding include `students`, `attendance`, and `users`; `sessions` is created when needed. If the data does not appear, compare the exact `MONGODB_URI` and `MONGODB_DB` in `.env.local` with the server/cluster and database you are viewing in Compass.

## 2. Log in from Postman

Base URL: `http://localhost:3000`

First request:

- `POST /api/auth/login`
- Header: `Content-Type: application/json`
- Body:

  ```json
  { "email": "admin@attendease.local", "password": "admin123" }
  ```

Postman should store the `attendease_session` cookie from the response. Keep the cookie jar enabled for `localhost`. If you set `DEFAULT_ADMIN_PASSWORD` before the database's first user was created, use that password instead. Changing the environment variable later does not reset an existing account.

## 3. APIs to test

### Database health (public)

`GET /api/test-db`

Expected: `{ "success": true, "message": "MongoDB connected successfully" }`.

### Students (login cookie required)

`GET /api/students` — list students.

`POST /api/students` — create one student; example body:

```json
{
  "erpId": "POSTMAN2001",
  "name": "Postman Test Student",
  "email": "postman.student@example.com",
  "department": "Computer Science",
  "year": "3rd Year",
  "section": "A",
  "phone": "9000000201"
}
```

`PUT /api/students` replaces the complete student list. Use it for the existing UI's bulk save behavior; send the array returned by `GET /api/students` with your changes. Do not send an empty array unless you intend to clear all students.

### Attendance (login cookie required)

`GET /api/attendance` — list records in the format expected by the app.

`POST /api/attendance` — mark one existing student's attendance by ERP ID:

```json
{
  "erpId": "DEMO1001",
  "subject": "Database Management",
  "department": "Computer Science",
  "year": "3rd Year",
  "section": "A",
  "status": "Present",
  "attendanceDate": "YYYY-MM-DD"
}
```

Replace `YYYY-MM-DD` with today's date for the sample. The ERP ID must already exist in `/api/students`. Allowed statuses are `Present`, `Absent`, and `Late`.

`PUT /api/attendance` replaces the full attendance record list. Use the existing grouped record shape:

```json
[
  {
    "date": "YYYY-MM-DD",
    "subject": "Database Management",
    "department": "Computer Science",
    "year": "3rd Year",
    "section": "A",
    "statuses": { "7b1f8b9a-6b22-4a1d-9f31-3d55f5a10001": "Present" },
    "savedAt": "2026-10-22T00:00:00.000Z"
  }
]
```

Use the current date and a real student `id` from `GET /api/students`.

## 4. Important behavior

- All `/api/*` requests reach their route handlers; protected routes return JSON `401` if the Postman session cookie is missing/expired.
- Student IDs and non-empty ERP IDs are unique in MongoDB. The API also validates duplicates before bulk saves.
- The app's existing pages and attendance record shape are retained.
- `PUT /api/students` and `PUT /api/attendance` are replacement operations, not append operations. Use `POST` to add a student or mark a single attendance status.
- Back up any existing database before manually deleting or editing documents.
