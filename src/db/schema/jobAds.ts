import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const jobAds = sqliteTable('job_ads', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  url: text('url').notNull().unique(),
  postedDate: integer('posted_date', { mode: 'timestamp' }).notNull(),
  source: text('source').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
})

export type JobAd = typeof jobAds.$inferSelect
export type NewJobAd = typeof jobAds.$inferInsert
