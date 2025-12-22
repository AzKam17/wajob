import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { JobAdEntity } from './entities/JobAdEntity'
import { ScraperSourceEntity } from './entities/ScraperSourceEntity'
import { ScrapeSessionEntity } from './entities/ScrapeSessionEntity'
import { BotUserEntity } from './entities/BotUserEntity'
import { PersonalizedLinkEntity } from './entities/PersonalizedLinkEntity'

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: './data/sqlite.db',
  synchronize: true, // Auto-migration enabled
  logging: false,
  entities: [JobAdEntity, ScraperSourceEntity, ScrapeSessionEntity, BotUserEntity, PersonalizedLinkEntity],
  migrations: [],
  subscribers: [],
})

export async function initializeDatabase() {
  try {
    await AppDataSource.initialize()
    console.log('Database initialized successfully!')
  } catch (error) {
    console.error('Error initializing database:', error)
    throw error
  }
}
