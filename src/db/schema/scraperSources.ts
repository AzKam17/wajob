import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const scraperSources = sqliteTable('scraper_sources', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  url: text('url').notNull(),
  lastScrapedAt: integer('last_scraped_at', { mode: 'timestamp' }),
  lastPageScrapped: integer('last_page_scrapped'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  shouldScrapeNext: integer('should_scrape_next', { mode: 'boolean' })
    .notNull()
    .default(false),
  scrapeInterval: integer('scrape_interval'),
  maxPages: integer('max_pages'),
  totalJobsFound: integer('total_jobs_found').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
})

export type ScraperSource = typeof scraperSources.$inferSelect
export type NewScraperSource = typeof scraperSources.$inferInsert
