# EMSOU by Anurag and Mohit

EMSOU by Anurag and Mohit is a real full-stack employee management app built with plain Node.js, HTML, CSS, and JavaScript.

## What it does

- Cookie-based login with a seeded admin account
- Persistent employee storage in local JSON data files
- Employee create, update, and delete workflows
- Workforce analytics for leave, submissions, burnout, promotion, and intervention risk
- Audit trail for logins, CRUD actions, and AI summary requests
- Browser-local workforce summaries with no extra AI service setup
- Free on-device intelligence for leave, submissions, burnout, reward, and intervention guidance

## Demo login

- Email: `admin@emsou.local`
- Password: `Admin@12345`

## Run locally

1. Optionally copy `.env.example` to `.env`
2. Start the app:

```powershell
npm start
```

3. Open [http://localhost:3000](http://localhost:3000)

## Deploy on Render

1. Push this project to GitHub.
2. In Render, create a new Blueprint or Web Service from that repository.
3. If Render detects [`render.yaml`](/C:/Users/anura/Documents/New%20project/render.yaml), it will prefill the service settings.
4. Render will generate `SESSION_SECRET` automatically from the Blueprint.
5. After deploy, open your Render URL and sign in with:
   - Email: `admin@emsou.local`
   - Password: `Admin@12345`

### Free-tier note

- Render Free is good for demos, but local JSON file changes are lost when the service redeploys, restarts, or spins down.
- For real employee data, move storage to a database such as Supabase Postgres.

## Environment variables

- `PORT`: server port, default `3000`
- `SESSION_SECRET`: secret used to sign the login session cookie

## Project structure

- `server.js`: backend server, auth, employee data handling, and workforce analytics
- `index.html`: app shell and login/dashboard layout
- `styles.css`: premium glassmorphism UI styling
- `app.js`: frontend state, requests, rendering, local intelligence logic, and interactions
- `data/users.json`: seeded login account
- `data/employees.json`: persistent employee records
- `data/audit-log.json`: persistent activity history

## Notes

- Sensitive people decisions should always stay under human review.
- The JSON data files act as a lightweight local database for this version.
- The smart summary console runs entirely in the browser for this version, so it works on free hosting without any extra AI service.
- If you want next steps, the strongest upgrades would be role-based access, a real SQL database, payroll/attendance integrations, and review workflow automation.
