# Development Guide

## Running the Application

The application is split into two main processes:

1. **API Server** - Handles HTTP requests and WhatsApp webhooks
2. **Worker** - Processes scraping jobs and manages the job queue

### Development Mode

For local development, run both processes in separate terminals:

**Terminal 1 - API Server:**
```bash
bun run dev
```

**Terminal 2 - Worker:**
```bash
bun run worker
```

Both commands run with `--watch` flag, so they will automatically reload on file changes.

### Production Mode

For production, you can use the production commands:

**API Server:**
```bash
bun run prod
```

**Worker:**
```bash
bun run prod:worker
```

Or use PM2 (recommended):
```bash
pm2 start ecosystem.config.js
```

## Available Scripts

- `bun run dev` - Start API server in development mode with auto-reload
- `bun run worker` - Start worker in development mode with auto-reload
- `bun run prod` - Start API server in production mode
- `bun run prod:worker` - Start worker in production mode
- `bun run seed` - Seed the database with scraper sources

## Architecture

### API Server (src/index.ts)
- Handles HTTP endpoints
- Manages WhatsApp webhook integration
- Serves personalized job links
- Does NOT process scraping jobs directly

### Worker (src/workers/standalone-worker.ts)
- Runs the BullMQ worker to process scraping jobs
- Performs initial scrape check on startup
- Runs periodic scrape checks every 20 minutes
- Independent from the API server

## Why Split?

This architecture provides:
- **Better resource management** - Scraping operations don't block API requests
- **Easier debugging** - You can restart the worker without affecting the API
- **Scalability** - Can run multiple worker instances if needed
- **Cleaner development** - API changes don't require worker restarts and vice versa
