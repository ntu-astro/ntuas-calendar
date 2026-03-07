# NTUAS Calendar System

A Cloudflare Worker-based system that serves an ICS calendar subscription and a public-facing calendar website. It utilizes a Cloudflare D1 database to store and manage calendar events, allowing users to subscribe to dynamic events seamlessly across calendar clients (like Apple Calendar, Google Calendar, Outlook). It also includes a public landing page and a built-in GUI admin dashboard for creating, editing, and managing events.

## Features

- **Public Calendar Page:** A beautiful, responsive web calendar served at the root (`/`) for users to view upcoming events.
- **ICS Subscription Endpoint:** Serves a standard RFC 5545 `.ics` feed directly from the D1 database.
- **Admin Dashboard:** A responsive web interface at `/admin` for creating, editing, and deleting calendar events, protected by a secure cookie-based session login.
- **Event Support:** Comprehensive support for both Timed and All-Day events.
- **JSON Endpoint:** Fetch all active events via a JSON endpoint (`/api/events`).
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

## User Guide

### 1. Admin Dashboard Usage
The Admin Dashboard located at `/admin` is your control center for managing the calendar.
- **Logging In**: Access the dashboard and log in using the `ADMIN_PASSWORD` defined in your environment secrets.
- **Creating & Editing Events**: Fill out the event details such as title, location, category, and time. 
- **Timed vs. All-Day Events**: 
  - *Timed Events*: Specify an exact start and end time (e.g., a meeting from 2:00 PM to 3:00 PM).
  - *All-Day Events*: Toggle "All Day Event" to span the entire day without specific hours. If an end date is not provided, it defaults to a single day.
- **Deleting Events**: Existing events listed on the dashboard can be deleted by entering your admin password in the deletion prompt.

### 2. Calendar Subscription
Users can subscribe to the calendar so that events sync directly to their personal devices.
1. Navigate to the public calendar page (`/`).
2. Click the **"Copy Subscription URL"** button or manually copy the `/subscribe` link.
3. Add the copied URL to your preferred calendar application:
   - **Apple Calendar**: Go to *File > New Calendar Subscription...* and paste the URL.
   - **Google Calendar**: On the left panel under "Other calendars," click the `+` icon > *From URL* and paste the link.
   - **Outlook**: Go to *Add Calendar > Subscribe from web* and paste the URL.

### 3. Public View
The root page (`/`) serves as a public-facing, responsive web calendar for your users.
- **Interactive Calendar Widget**: Users can view the current month, shift through previous or upcoming months using the navigation arrows, and click on highlighted dates to view specific event details.
- **Upcoming Events**: A quick-glance list of the closest upcoming events is prominently displayed alongside the calendar for easy access.

### 4. Important Notes
- **ICS Sync Latency**: Please note that third-party calendar applications check for updates at their own internal intervals. While Apple Calendar allows you to set the refresh frequency (e.g., every 5 minutes), **Google Calendar may take up to 12-24 hours to reflect new updates or changes**. This latency is controlled by Google and cannot be forced from the application.
