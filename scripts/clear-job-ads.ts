import { initializeDatabase } from '../src/db'
import { JobAdRepository } from '../src/db/repositories/JobAdRepository'

await initializeDatabase()

const jobAdRepo = new JobAdRepository()

console.log('🗑️  Clearing job ads table...\n')

try {
  const allJobs = await jobAdRepo.findAll()
  const totalJobs = allJobs.length

  if (totalJobs === 0) {
    console.log('ℹ️  Job ads table is already empty')
    process.exit(0)
  }

  console.log(`📊 Found ${totalJobs} job ads to delete (hard delete)`)

  for (const job of allJobs) {
    await jobAdRepo.hardDelete(job.id!)
  }

  console.log(`\n✅ Successfully hard deleted ${totalJobs} job ads!`)
} catch (error) {
  console.error('❌ Error clearing job ads:', error)
  process.exit(1)
}

process.exit(0)
