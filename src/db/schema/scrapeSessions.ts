import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { scraperSources } from './scraperSources'

export const scrapeSessions = sqliteTable('scrape_sessions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  sessionId: text('session_id').notNull().unique(),
  sourceId: text('source_id')
    .notNull()
    .references(() => scraperSources.id),
  sourceName: text('source_name').notNull(),
  mode: text('mode', { enum: ['manual', 'automatic'] }).notNull(),
  status: text('status', {
    enum: ['pending', 'in_progress', 'completed', 'failed'],
  }).notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  pagesScraped: integer('pages_scraped').notNull().default(0),
  jobsFound: integer('jobs_found').notNull().default(0),
  errors: text('errors'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
})

export type ScrapeSession = typeof scrapeSessions.$inferSelect
export type NewScrapeSession = typeof scrapeSessions.$inferInsert
