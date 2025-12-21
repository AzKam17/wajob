import { Type } from '@sinclair/typebox'

export const envSchema = Type.Object({
  // Server
  PORT: Type.Optional(Type.String({ default: '3000' })),

  // Redis
  REDIS_HOST: Type.Optional(Type.String({ default: 'localhost' })),
  REDIS_PORT: Type.Optional(Type.String({ default: '6379' })),
  REDIS_PASSWORD: Type.Optional(Type.String()),

  // Scraping
  MAX_PAGES_PER_SCRAPE: Type.Optional(Type.String({ default: '3' })),
  DEFAULT_SCRAPE_INTERVAL_MINUTES: Type.Optional(Type.String({ default: '30' })),

  // Cron
  SCRAPE_CHECK_CRON: Type.Optional(Type.String({ default: '*/5 * * * *' })), // Every 5 minutes
})
