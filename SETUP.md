# WA Jobs Scraper Setup Guide

## Prerequisites

1. **Redis Server** - BullMQ requires Redis to be running

### Install Redis

**macOS (via Homebrew):**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis
```

**Docker:**
```bash
docker run -d -p 6379:6379 redis:alpine
```

## Getting Started

### 1. Install Dependencies

```bash
bun install
```

### 2. Configure Environment

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` if needed:
```env
PORT=3000
REDIS_HOST=localhost
REDIS_PORT=6379
MAX_PAGES_PER_SCRAPE=3
DEFAULT_SCRAPE_INTERVAL_MINUTES=30
SCRAPE_CHECK_CRON=*/5 * * * *
```

### 3. Seed Scraper Sources

```bash
bun run seed
```

This creates 6 scraper sources:
- sociumjob (30 min interval)
- djamo (60 min interval)
- educarriere (45 min interval)
- optioncarriere (30 min interval)
- jobivoire (30 min interval)
- projobivoire (30 min interval)

### 4. Start the Application

```bash
bun run dev
```

## How It Works

### Architecture

```
Cron Job (Every 5 min)
    ↓
Check ScraperSource table
    ↓
Calculate if scrape needed (based on interval)
    ↓
Enqueue job to BullMQ
    ↓
Worker processes job
    ↓
Console log (for now)
```

### Scheduling Logic

A source will be scraped if:
1. **Never scraped before** - First time scraping
2. **Manually flagged** - `shouldScrapeNext = true`
3. **Interval elapsed** - `(currentTime - lastScrapedAt) >= scrapeInterval`

### Example Output

```
⏰ Checking for sources that need scraping...
📋 Found 6 active source(s)

🚀 ENQUEUED: sociumjob
   Reason: Never scraped before
   Next check: 2024-01-15T14:30:00.000Z

⏸️  SKIPPED: djamo
   Reason: Only 10 minutes elapsed, need 60m (50m remaining)
   Next scrape: 2024-01-15T15:00:00.000Z

✅ Enqueued 1 scraping job(s)
```

## Configuration

### Scrape Intervals

Edit in database or seed script:
- `scrapeInterval` - Minutes between scrapes (default: 30)
- `maxPages` - Max pages to scrape per run (default: 3)
- `isActive` - Enable/disable scraper
- `shouldScrapeNext` - Force next scrape

### Cron Schedule

Default: Every 5 minutes (`*/5 * * * *`)

Change in `.env`:
```env
SCRAPE_CHECK_CRON=*/10 * * * *  # Every 10 minutes
SCRAPE_CHECK_CRON=0 * * * *     # Every hour
SCRAPE_CHECK_CRON=0 0 * * *     # Daily at midnight
```

## Testing

Monitor the logs when running `bun run dev`:
- Cron checks every 5 minutes
- Sources enqueued based on intervals
- Worker processes jobs and logs details

## Next Steps

The worker currently just logs. To implement actual scraping:
1. Edit `src/workers/scrape.worker.ts`
2. Import the appropriate scraper class
3. Call the scraper based on `sourceName`
4. Update `ScraperSource` with results
5. Save `JobAd` records to database
