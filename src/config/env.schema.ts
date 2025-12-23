import { t } from 'elysia'

export const envSchema = {
  // Server
  PORT: t.Optional(t.String({ default: '3000' })),

  // Database (PostgreSQL)
  DB_HOST: t.Optional(t.String({ default: 'localhost' })),
  DB_PORT: t.Optional(t.String({ default: '5432' })),
  DB_USER: t.Optional(t.String({ default: 'wajobs' })),
  DB_PASSWORD: t.Optional(t.String({ default: 'wajobs123' })),
  DB_NAME: t.Optional(t.String({ default: 'wajobs' })),

  // Redis
  REDIS_HOST: t.Optional(t.String({ default: 'localhost' })),
  REDIS_PORT: t.Optional(t.String({ default: '6379' })),
  REDIS_PASSWORD: t.Optional(t.String()),

  // Scraping
  MAX_PAGES_PER_SCRAPE: t.Optional(t.String({ default: '3' })),
  DEFAULT_SCRAPE_INTERVAL_MINUTES: t.Optional(t.String({ default: '30' })),

  // Cron
  SCRAPE_CHECK_CRON: t.Optional(t.String({ default: '*/5 * * * *' })), // Every 5 minutes

  // WhatsApp
  WHATSAPP_ACCESS_TOKEN: t.String(),
  WHATSAPP_PHONE_NUMBER_ID: t.String(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: t.String(),
  WHATSAPP_VERSION: t.Optional(t.String({ default: 'v23.0' })),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: t.Optional(t.String({ default: 'your-verify-token-here' })),
  WHATSAPP_WEBHOOK_URL: t.Optional(t.String()),
}
