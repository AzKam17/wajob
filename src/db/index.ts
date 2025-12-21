import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'

const sqlite = new Database('./data/sqlite.db')
export const db = drizzle(sqlite, { schema })

export async function runMigrations() {
  console.log('Running migrations...')
  migrate(db, { migrationsFolder: './drizzle' })
  console.log('Migrations completed!')
}

export { schema }
