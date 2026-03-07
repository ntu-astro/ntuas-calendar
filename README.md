# NTUAS Calendar API

A Cloudflare Worker-based API that serves an ICS calendar subscription and a public-facing calendar website. It utilizes a Cloudflare D1 database to store and manage calendar events, allowing users to subscribe to dynamic events seamlessly across calendar clients (like Apple Calendar, Google Calendar, Outlook). It also includes a public landing page and a built-in GUI admin dashboard for creating, editing, and managing events.

## Features

- **Public Calendar Page:** A beautiful, responsive web calendar served at the root (`/`) for users to view upcoming events.
- **ICS Subscription Endpoint:** Serves a standard RFC 5545 `.ics` feed directly from the D1 database.
- **Admin Dashboard:** A responsive web interface at `/admin` for creating, editing, and deleting calendar events, protected by a secure cookie-based session login.
- **Event Support:** Comprehensive support for both Timed and All-Day events.
- **API Endpoint:** Fetch all active events via a JSON endpoint (`/api/events`).
- **Cloudflare D1:** Uses a serverless SQLite database for low-latency, globally distributed database queries.

## Database Schema

![Database ERD](https://ntuas.com/ntuas-calendar/docs/database_erd.avif)

## Prerequisites

- [Node.js](https://nodejs.org/) installed
- A [Cloudflare](https://cloudflare.com/) account
- Cloudflare [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

## Setup & Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Log in to Cloudflare:**
   ```bash
   npx wrangler login
   ```

3. **Create the D1 Database:**
   ```bash
   npx wrangler d1 create calendar_db
   ```
   *Take note of the `database_name` and `database_id` returned in the output and update your `wrangler.jsonc` file with these values under the `d1_databases` section.*

4. **Initialize Database Schema:**
   Apply the provided schema (`schema.sql`) to your local and production databases:
   ```bash
   # For local development
   npx wrangler d1 execute calendar_db --local --file=./schema.sql

   # For production
   npx wrangler d1 execute calendar_db --remote --file=./schema.sql
   ```
   
   *Wait! Before you can use the dashboard to add events, you must insert an initial calendar record using the ID the worker expects (`main-cal-001`):*
   ```bash
   # For local development
   npx wrangler d1 execute calendar_db --local --command="INSERT INTO calendars (id, x_wr_calname, x_wr_timezone) VALUES ('main-cal-001', 'NTUAS Events', 'Asia/Singapore');"

   # For production
   npx wrangler d1 execute calendar_db --remote --command="INSERT INTO calendars (id, x_wr_calname, x_wr_timezone) VALUES ('main-cal-001', 'NTUAS Events', 'Asia/Singapore');"
   ```

5. **Set the Admin Password:**
   You must set the `ADMIN_PASSWORD` securely via Wrangler secrets. This is required for both local development and production.
   ```bash
   npx wrangler secret put ADMIN_PASSWORD
   ```

6. **Start the local server:**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:8787` (or whatever port Wrangler assigns).

## Deployment

Deploy the worker to the Cloudflare network:

```bash
npm run deploy
```

## Usage & Endpoints

- **`GET /`**: The public-facing HTML calendar page showing valid events.
- **`GET /subscribe` or `GET /calendar.ics`**: The main ICS feed URL. Add this URL to Apple Calendar, Google Calendar, or other clients to subscribe to the events.
- **`GET /admin`**: The admin dashboard UI to manage events. Requires the admin session login using the environment secret password.
- **`POST /admin`**: API to programmatically insert, update, or delete an event (requires authentication).
- **`GET /api/events`**: Returns a JSON array of all current calendar events in the database.
