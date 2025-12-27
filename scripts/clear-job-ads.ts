import { initializeDatabase } from '../src/db'
import { AppDataSource } from '../src/db/data-source'

await initializeDatabase()

console.log('🗑️  Clearing job ads table...\n')

try {
  // Get count before deletion
  const countResult = await AppDataSource.query('SELECT COUNT(*) as count FROM job_ads')
  const totalJobs = parseInt(countResult[0].count)

  if (totalJobs === 0) {
    console.log('ℹ️  Job ads table is already empty')
    process.exit(0)
  }

  console.log(`📊 Found ${totalJobs} job ads to delete (hard delete)`)

  // Execute raw DELETE query
  await AppDataSource.query('DELETE FROM job_ads')

  console.log(`\n✅ Successfully hard deleted ${totalJobs} job ads!`)
} catch (error) {
  console.error('❌ Error clearing job ads:', error)
  process.exit(1)
}

process.exit(0)
