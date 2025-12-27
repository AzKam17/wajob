import { initializeDatabase } from '../src/db'

console.log('🔧 Synchronizing database schema...\n')

try {
  // Initialize database - TypeORM synchronize:true will handle schema updates
  await initializeDatabase()

  console.log('\n✅ Database schema synchronized successfully!')
  console.log('ℹ️  TypeORM has automatically updated the job_ads table with company, location, and description columns.')
} catch (error) {
  console.error('❌ Error synchronizing schema:', error)
  process.exit(1)
}

process.exit(0)
