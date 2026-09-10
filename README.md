# CivicTrack
A real-time civic issue reporting platform connecting citizens with government officials for efficient problem resolution.

## Overview

CivicTrack enables citizens to report civic issues (potholes, streetlights, garbage, etc.) with photos/videos and location data. Officials are automatically assigned based on geographic jurisdiction and receive real-time notifications to address issues efficiently.

## Features

- **Citizens**: Create reports with media, track status, view reports on interactive maps
- **Officials**: Auto-assigned to reports, manage status updates, view performance analytics
- **Admins**: Manage officials, assign tenures, view system-wide analytics

## Tech Stack

**Backend**: Node.js, Express, PostgreSQL (+ PostGIS) via raw `pg`, MongoDB (GridFS video storage only), Redis, Bull MQ, Server-Sent Events
**Frontend**: Next.js 14, TypeScript, Tailwind CSS
**Storage**: Cloudinary (images) + GridFS (large videos)
**AI**: OpenRouter (OpenAI-compatible) for report categorization
**Infrastructure**: Docker, Docker Compose

> This project was migrated from MongoDB/Mongoose to PostgreSQL for its
> primary data (users, reports, tenures, notifications). See
> [`MIGRATION.md`](./MIGRATION.md) for what changed and why, and
> `backend/db/schema.sql` for the schema itself. GridFS (MongoDB) is
> still used for video files.

## Quick Start

### Using Docker (Recommended)

```bash
git clone https://github.com/yourusername/civictrack.git
cd civictrack
docker-compose up -d
docker-compose exec backend npm run seed:admin
```

Access: Frontend at `http://localhost:3000`, Backend at `http://localhost:5000`

### Manual Setup

**Backend**
```bash
cd backend
cp .env.example .env   # fill in DATABASE_URL (Postgres), MONGODB_URI (GridFS), JWT_SECRET, OPENROUTER_API_KEY, etc.
npm install
npm run migrate        # applies backend/db/schema.sql to DATABASE_URL
npm run seed:admin
npm run dev
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

### AI Categorization Setup

Report categorization runs on [OpenRouter](https://openrouter.ai), which exposes an OpenAI-compatible API in front of many underlying models. Set these in `backend/.env`:

```
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=openai/gpt-4o-mini
```

Get an API key at https://openrouter.ai/keys. `OPENROUTER_MODEL` can be swapped to any model slug OpenRouter supports without any code changes.


## Key API Endpoints

```
POST   /api/auth/register          Register user
POST   /api/auth/login             Login
GET    /api/reports                Get all reports
POST   /api/reports                Create report
PATCH  /api/reports/:id            Update report status
GET    /api/officials/:id/scorecard  Official performance
```

## Architecture

- **Real-time notifications** via Server-Sent Events and email
- **Background jobs** for media processing, notifications, and report assignment
- **Geographic assignment** of officials based on report location
- **AI-powered** report categorization
- **Role-based access** control (User, Official, Admin)

## Project Structure

```
civictrack/
├── backend/          # Express API server
│   ├── db/           # PostgreSQL schema.sql + connection pool
│   ├── controllers/  # Request handlers
│   ├── models/       # Raw-SQL data-access layer (users, reports, tenures, notifications)
│   ├── services/     # Business logic
│   ├── workers/      # Background jobs
│   └── config/       # App configuration (Postgres primary, Mongo/GridFS for video)
├── frontend/         # Next.js application
│   ├── app/          # Pages (App Router)
│   ├── components/   # React components
│   └── hooks/        # Custom hooks
├── docker-compose.yml
└── MIGRATION.md      # MongoDB → PostgreSQL migration notes
```



---

Made with ❤️ for better civic engagement