# Food Donation Connect

Food Donation Connect is a beginner-friendly full-stack web application that helps food donors and community groups coordinate surplus food. Donors publish food availability with quantity, location and a pickup window. Community groups can request a donation, donors can approve a request, and the community group can mark the pickup as completed.

## 1. Problem

Usable surplus food is often available at the wrong time or without a clear way for community organizations to coordinate pickup. This project creates a simple shared workflow for:

1. Donors publishing available food.
2. Community groups discovering suitable donations.
3. Community groups submitting claim requests.
4. Donors approving one request.
5. Community groups marking an approved pickup complete.
6. Administrators monitoring accounts and platform activity.

## 2. Users and roles

- **Donor:** creates food donations and reviews requests.
- **Community group:** browses available food and requests donations.
- **Admin:** monitors users, donation counts and claims.

The admin account is created automatically from server-side environment variables. Do not put admin credentials in frontend code or GitHub.

## 3. Features

- Sign up and sign in.
- Password hashing with bcrypt.
- JWT-based authentication.
- Role-based backend authorization.
- Donor donation posting.
- Quantity and unit tracking.
- Pickup start/end date and time.
- Pickup location.
- Donation status tracking.
- Community claim requests.
- Donor approval of a request.
- Claim completion.
- Search and filtering.
- Admin dashboard.
- Supabase PostgreSQL persistence.
- PostgreSQL constraints and indexes.
- Security headers and authentication rate limiting.
- Responsive HTML/CSS/Vanilla JS interface.

## 4. Technology stack

- HTML5
- CSS3
- Vanilla JavaScript
- Node.js 20+
- Express.js
- Supabase PostgreSQL
- npm packages: `@supabase/supabase-js`, `bcryptjs`, `dotenv`, `express`, `express-rate-limit`, `helmet`, `jsonwebtoken`
- Git and GitHub

No React, Vue, Angular, MongoDB, Firebase or Python is used.

## 5. Folder structure

```text
food-donation-connect/
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── backend/
│   ├── server.js
│   ├── supabase.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── donations.js
│   │   ├── claims.js
│   │   └── admin.js
│   ├── middleware/
│   │   └── auth.js
│   ├── utils/
│   │   └── response.js
│   ├── package.json
│   ├── .env
│   ├── .env.example
│   └── .gitignore
├── database/
│   └── schema.sql
├── .gitignore
└── README.md
```

## 6. Prerequisites

Install:

- Visual Studio Code: https://code.visualstudio.com/
- Node.js LTS: https://nodejs.org/
- Git: https://git-scm.com/
- A free Supabase account: https://supabase.com/

Verify Node and npm:

```bash
node --version
npm --version
```

Verify Git:

```bash
git --version
```

Node 20 or newer is recommended.

## 7. Supabase setup

1. Create a Supabase account.
2. Create a new project.
3. Open **SQL Editor**.
4. Create a new query.
5. Copy the complete contents of `database/schema.sql`.
6. Run the query.
7. Open **Table Editor** and confirm that `users`, `donations` and `claims` exist.

### Server key

Open Supabase project settings and find the API credentials. Copy the server-only service-role key into `backend/.env`.

Never put the service-role key in `frontend/app.js`, HTML, CSS or GitHub.

## 8. Environment variables

Copy:

```text
backend/.env.example
```

to:

```text
backend/.env
```

Example structure:

```env
PORT=3000
NODE_ENV=development
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
JWT_SECRET=YOUR_LONG_RANDOM_SECRET
ADMIN_EMAIL=your-admin-email@example.com
ADMIN_PASSWORD=your-strong-admin-password
```

The actual values are private and must not be committed.

Generate a JWT secret with Node:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 9. Install dependencies

Open a terminal in the `backend` folder:

```bash
cd backend
npm install
```

This downloads the packages listed in `package.json`.

## 10. Run the application

From `backend`:

```bash
npm start
```

You should see:

```text
Food Donation Connect running at http://localhost:3000
```

Open:

```text
http://localhost:3000
```

The Express server serves the `frontend` directory.

Health check:

```text
http://localhost:3000/api/health
```

A working database connection returns JSON with `"status":"ok"`.

## 11. Authentication

The project uses a simple server-managed JWT system.

- Passwords are hashed with bcrypt before storage.
- The backend signs an 8-hour JWT after successful login.
- The browser sends the JWT in an `Authorization: Bearer ...` header.
- The backend verifies the token and loads the current user from PostgreSQL.
- Roles are checked on the backend.
- The browser never decides whether a user is an admin.
- The Supabase service-role key is server-only.

For a classroom MVP this keeps the architecture understandable. For a production public service, additional hardening such as secure HTTP-only cookies, stronger session management, audit logging and more extensive abuse controls would be appropriate.

## 12. API endpoints

### Authentication

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/signup` | Create donor/community account |
| POST | `/api/auth/signin` | Sign in |
| GET | `/api/auth/me` | Get authenticated user |

### Donations

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/api/donations` | Authenticated | Browse/search donations |
| POST | `/api/donations` | Donor | Publish donation |
| GET | `/api/donations/mine` | Authenticated | Donor's own donations |
| PATCH | `/api/donations/:id/status` | Owner/admin | Change donation status |

### Claims

| Method | Path | Permission | Purpose |
|---|---|---|---|
| POST | `/api/claims` | Community | Request a donation |
| GET | `/api/claims/mine` | Community | View own requests |
| GET | `/api/claims/for-donation/:donationId` | Donor/admin | View requests for a donation |
| PATCH | `/api/claims/:id/status` | Authorized user | Approve/reject/cancel/complete |

### Admin

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/api/admin/summary` | Admin | Platform counts |
| GET | `/api/admin/users` | Admin | List users |
| GET | `/api/admin/donations` | Admin | List donations |
| DELETE | `/api/admin/users/:id` | Admin | Delete another user |

## 13. Main workflow

### Donor

1. Create a donor account.
2. Sign in.
3. Click **Post donation**.
4. Enter food name, quantity, unit, pickup window and location.
5. Publish.
6. Open **My Activity**.
7. View requests and approve a pending request.

### Community group

1. Create a community account.
2. Sign in.
3. Browse **Donations**.
4. Search for food.
5. Request an available donation.
6. Open **My Activity**.
7. After the donor approves and pickup happens, mark the claim completed.

### Admin

The server creates the admin account from `ADMIN_EMAIL` and `ADMIN_PASSWORD` on startup if it does not already exist. Sign in normally, then open the Admin tab.

## 14. Testing

### Basic

- Start the backend.
- Open `/api/health`.
- Confirm the response says the database is available.
- Create a donor account.
- Create a community account.
- Sign out and sign back in.

### Donor

- Create a donation with valid values.
- Try an empty food name.
- Try quantity `0`.
- Try an end time before the start time.
- Confirm invalid requests are rejected.
- Confirm a valid donation appears in the donation board.

### Community

- Request an available donation.
- Request the same donation twice.
- Confirm the second request is rejected.
- Confirm the request appears in My Activity.

### Authorization

- Try posting a donation as a community account.
- Try approving a claim as a community account.
- Try accessing another donor's claim list.
- Confirm unauthorized actions return HTTP 403.

### Admin

- Sign in with the configured admin account.
- Confirm the Admin tab is visible.
- Confirm user and activity counts load.
- Confirm an admin cannot delete their own account.

### Responsive UI

Check the application at desktop and mobile widths. Forms, cards and navigation should remain usable.

## 15. Troubleshooting

### `SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required`

Make sure `backend/.env` exists and contains both values. Restart the server after editing `.env`.

### Database unavailable

Open Supabase and check that:

- The project is running.
- `schema.sql` was executed.
- The URL is correct.
- The service-role key is correct.

### `Invalid email or password`

Check that the email is correct. For the admin account, check `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Restarting with the same admin email does not overwrite an existing password.

### `401 Authentication required`

Sign in again. The browser token expires after 8 hours.

### `403 You do not have permission`

The account role does not have permission for that operation. Authorization is deliberately enforced on the backend.

### Port already in use

Change:

```env
PORT=3001
```

Then restart the server and open `http://localhost:3001`.

### Frontend does not load

Make sure the command is run from `backend` and the folder structure matches the README. Express serves:

```text
../frontend
```

from `backend/server.js`.

## 16. Security

- Never commit `.env`.
- Never expose the Supabase service-role key to the browser.
- Never store plaintext passwords.
- Never trust a role supplied by the browser.
- Do not put private credentials in README files.
- Rotate any credential that is accidentally committed.
- `.gitignore` prevents future tracking but does not erase secrets already committed to Git history.

## 17. GitHub upload

From the root project directory:

```bash
git init
git status
git add .
git status
git commit -m "Build project"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Before `git add .`, verify:

```text
backend/.env
backend/node_modules/
```

are ignored.

Create an empty GitHub repository first. Replace `YOUR_GITHUB_REPOSITORY_URL` with your actual repository URL.

## 18. Limitations and future improvements

Possible future improvements:

- Email notifications.
- Secure HTTP-only cookie sessions.
- More detailed claim-management screens.
- Donation expiry automation.
- Admin audit logs.
- Food category and dietary/allergen filters.
- Location-based search.
- Pickup confirmation codes.
- Reports for food quantity rescued.
- Automated tests with a dedicated test database.

These are intentionally outside the first-year MVP so students can understand the core workflow first.
