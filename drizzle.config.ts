import type { Config } from 'drizzle-kit'

export default {
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './data/sqlite.db',
  },
} satisfies Config
