# Worker Setup Guide

## Running Workers

### Development Mode (Single Process)

For development, the worker runs in the same process as the web server:

```bash
bun run dev
```

This is convenient for testing and debugging. Both the API server and worker share the same process.

### Production Mode (Separate Processes)

For production, you should run workers in separate processes for better scalability and isolation.

**Terminal 1 - API Server:**
```bash
PORT=3000 bun run src/index.ts
```

**Terminal 2 - Worker Process:**
```bash
bun run src/workers/standalone-worker.ts
```

## Logging Format

All logs are in JSON format for easy parsing:

```json
{"timestamp":"2024-01-15T10:30:00.000Z","level":"INFO","message":"Checking for sources that need scraping"}
{"timestamp":"2024-01-15T10:30:00.123Z","level":"SUCCESS","message":"Source enqueued for scraping","data":{"source":"sociumjob","reason":"Never scraped before"}}
{"timestamp":"2024-01-15T10:30:01.456Z","level":"INFO","message":"Scraping job started","data":{"jobId":"1","sourceName":"sociumjob","maxPages":3}}
```

### Log Levels

- **INFO** - General information
- **SUCCESS** - Successful operations
- **WARN** - Warnings
- **ERROR** - Errors
- **DEBUG** - Debug information (skipped sources, detailed flow)

### Filtering Logs

**Show only errors:**
```bash
bun run dev | grep '"level":"ERROR"'
```

**Show only successful jobs:**
```bash
bun run dev | grep '"level":"SUCCESS"'
```

**Pretty print with jq:**
```bash
bun run dev | grep -v '"type":"SYS"' | jq .
```

## Worker Configuration

Edit [src/workers/scrape.worker.ts](src/workers/scrape.worker.ts:44):

```typescript
concurrency: 2  // Process 2 jobs simultaneously
```

Increase for more parallel scraping (use with caution to avoid being rate-limited).

## Monitoring

Use BullMQ Board for visual monitoring:

```bash
bunx bull-board
```

Or use Redis CLI to inspect queues:

```bash
redis-cli
> KEYS *scrape-jobs*
> LLEN bull:scrape-jobs:waiting
```
