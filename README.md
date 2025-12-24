# CivicTrack

A real-time civic issue reporting platform connecting citizens with government officials for efficient problem resolution.

## Overview

CivicTrack enables citizens to report civic issues (potholes, streetlights, garbage, etc.) with photos/videos and location data. Officials are automatically assigned based on geographic jurisdiction and receive real-time notifications to address issues efficiently.

## Features

- **Citizens**: Create reports with media, track status, view reports on interactive maps
- **Officials**: Auto-assigned to reports, manage status updates, view performance analytics
- **Admins**: Manage officials, assign tenures, view system-wide analytics

## Tech Stack

**Backend**: Node.js, Express, MongoDB, Redis, Bull MQ, Socket.io  
**Frontend**: Next.js 14, TypeScript, Tailwind CSS  
**Storage**: Cloudinary + GridFS hybrid  
**Infrastructure**: Docker, Docker Compose

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
npm install
npm run seed:admin
npm run dev
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```


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

- **Real-time notifications** via WebSocket and email
- **Background jobs** for media processing, notifications, and report assignment
- **Geographic assignment** of officials based on report location
- **AI-powered** report categorization
- **Role-based access** control (User, Official, Admin)

## Project Structure

```
civictrack/
├── backend/          # Express API server
│   ├── controllers/  # Request handlers
│   ├── models/       # MongoDB schemas
│   ├── services/     # Business logic
│   ├── workers/      # Background jobs
│   └── config/       # App configuration
├── frontend/         # Next.js application
│   ├── app/          # Pages (App Router)
│   ├── components/   # React components
│   └── hooks/        # Custom hooks
└── docker-compose.yml
```



---

Made with ❤️ for better civic engagement