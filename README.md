# Exam Pro

A full-stack project built with **HTML, CSS, JavaScript, SQL (SQLite), and Node.js/Express**.

## Core Workflow

1. Student logs in and writes exam.
2. Student submits exam.
3. Admin monitors attempts and verifies the submitted result.
4. Admin publishes verified result.
5. Student can view result **only after publish**.

## Roles & Demo Credentials

- Admin: `admin / admin123`
- Student: `student1 / student123`
- Student: `student2 / student123`

## Features

- Separate login for Admin and Student.
- Student can start exams and submit responses.
- Student cannot view score before admin publish.
- Admin monitoring panel for all attempts.
- Admin actions:
  - Verify submitted attempt
  - Publish verified result
- Published results visible in student dashboard.

## Tech Stack

- Frontend: HTML, CSS, Vanilla JavaScript
- Backend: Node.js + Express
- Database: SQLite

## Project Structure

- `public/index.html` -> role-based UI
- `public/styles.css` -> styling
- `public/app.js` -> frontend logic
- `db/schema.sql` -> schema (users, attempts workflow)
- `db/seed.sql` -> demo users + exams + questions
- `server.js` -> backend APIs + auth + role checks

## Setup

1. Install Node.js (v18+ recommended).
2. Install dependencies:

```bash
npm install
```

3. Start server:

```bash
npm start
```

4. Open browser:

```text
http://localhost:3000
```

## API Endpoints

### Auth

- `POST /api/auth/register-student`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Student

- `GET /api/exams`
- `POST /api/attempts/start`
- `POST /api/attempts/:attemptId/submit`
- `GET /api/student/results` (published only)

### Admin

- `GET /api/admin/attempts`
- `PATCH /api/admin/attempts/:attemptId/verify`
- `PATCH /api/admin/attempts/:attemptId/publish`

## Notes

- This is a demo app with plain-text password check for simplicity.
- Sessions are token-based and stored in memory.
- If server restarts, users need to login again.
