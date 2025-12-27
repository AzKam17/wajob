import { initializeDatabase } from '../src/db'
import { AppDataSource } from '../src/db/data-source'
import { Logger } from '../src/utils/logger'

console.log('🔧 Creating database indexes...\n')

const indexes = [
  {
    name: 'idx_job_ads_fulltext_french',
    description: 'Full-text search index for French language on job fields',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_job_ads_fulltext_french
      ON job_ads USING GIN(
        to_tsvector('french',
          COALESCE(title, '') || ' ' ||
          COALESCE(description, '') || ' ' ||
          COALESCE(company, '') || ' ' ||
          COALESCE(location, '')
        )
      )
    `,
  },
  {
    name: 'idx_job_ads_posted_date',
    description: 'Index on postedDate for sorting recent jobs',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_job_ads_posted_date
      ON job_ads("postedDate" DESC)
    `,
  },
  {
    name: 'idx_job_ads_deleted_at',
    description: 'Index on deletedAt for soft delete filtering',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_job_ads_deleted_at
      ON job_ads("deletedAt")
      WHERE "deletedAt" IS NULL
    `,
  },
  {
    name: 'idx_job_ads_source',
    description: 'Index on source for filtering by scraper source',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_job_ads_source
      ON job_ads(source)
    `,
  },
  {
    name: 'idx_job_ads_url_unique',
    description: 'Unique index on url for duplicate prevention',
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_job_ads_url_unique
      ON job_ads(url)
      WHERE "deletedAt" IS NULL
    `,
  },
  {
    name: 'idx_job_ads_company',
    description: 'Index on company for filtering by company name',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_job_ads_company
      ON job_ads(company)
    `,
  },
  {
    name: 'idx_job_ads_location',
    description: 'Index on location for filtering by job location',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_job_ads_location
      ON job_ads(location)
    `,
  },
  {
    name: 'idx_job_ads_title_trgm',
    description: 'Trigram index for fuzzy matching on job titles (requires pg_trgm extension)',
    sql: `
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
      CREATE INDEX IF NOT EXISTS idx_job_ads_title_trgm
      ON job_ads USING GIN(title gin_trgm_ops)
    `,
  },
  {
    name: 'idx_bot_users_phone_number',
    description: 'Index on phoneNumber for quick user lookup',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_bot_users_phone_number
      ON bot_users("phoneNumber")
    `,
  },
  {
    name: 'idx_bot_users_last_message_at',
    description: 'Index on lastMessageAt for finding inactive users',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_bot_users_last_message_at
      ON bot_users("lastMessageAt" DESC)
    `,
  },
  {
    name: 'idx_personalized_links_link_id',
    description: 'Index on linkId for quick link resolution',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_personalized_links_link_id
      ON personalized_links("linkId")
    `,
  },
  {
    name: 'idx_personalized_links_user_job',
    description: 'Composite index on userId and jobId for duplicate prevention',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_personalized_links_user_job
      ON personalized_links("userId", "jobId")
    `,
  },
  {
    name: 'idx_conversations_phone_number',
    description: 'Index on phoneNumber for conversation lookup',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_conversations_phone_number
      ON conversations("phoneNumber")
    `,
  },
  {
    name: 'idx_conversations_updated_at',
    description: 'Index on updatedAt for finding recent conversations',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_conversations_updated_at
      ON conversations("updatedAt" DESC)
    `,
  },
  {
    name: 'idx_messages_conversation_id',
    description: 'Index on conversationId for message history retrieval',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
      ON messages("conversationId")
    `,
  },
  {
    name: 'idx_messages_created_at',
    description: 'Index on createdAt for chronological message ordering',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_messages_created_at
      ON messages("createdAt" DESC)
    `,
  },
  {
    name: 'idx_scraper_sources_active',
    description: 'Index on isActive for filtering active scrapers',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_scraper_sources_active
      ON scraper_sources("isActive")
      WHERE "isActive" = true
    `,
  },
  {
    name: 'idx_scrape_sessions_source_id',
    description: 'Index on sourceId for session history per source',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_scrape_sessions_source_id
      ON scrape_sessions("sourceId")
    `,
  },
  {
    name: 'idx_scrape_sessions_started_at',
    description: 'Index on startedAt for recent scrape sessions',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_scrape_sessions_started_at
      ON scrape_sessions("startedAt" DESC)
    `,
  },
]

async function createIndexes() {
  try {
    await initializeDatabase()

    console.log(`📊 Creating ${indexes.length} indexes...\n`)

    let successCount = 0
    let skippedCount = 0
    let errorCount = 0

    for (const index of indexes) {
      try {
        console.log(`⏳ Creating: ${index.name}`)
        console.log(`   ${index.description}`)

        // Execute the SQL
        await AppDataSource.query(index.sql)

        console.log(`   ✅ Created successfully\n`)
        successCount++
      } catch (error: any) {
        // Check if index already exists
        if (error.message?.includes('already exists')) {
          console.log(`   ⏭️  Already exists, skipping\n`)
          skippedCount++
        } else {
          console.error(`   ❌ Error: ${error.message}\n`)
          errorCount++
        }
      }
    }

    console.log('═══════════════════════════════════════════════════════')
    console.log(`📈 Index Creation Summary:`)
    console.log(`   ✅ Created: ${successCount}`)
    console.log(`   ⏭️  Skipped: ${skippedCount}`)
    console.log(`   ❌ Failed: ${errorCount}`)
    console.log(`   📊 Total: ${indexes.length}`)
    console.log('═══════════════════════════════════════════════════════\n')

    // Show index statistics
    console.log('📊 Checking index sizes...\n')

    const sizeQuery = `
      SELECT
        schemaname,
        tablename,
        indexname,
        pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
      ORDER BY pg_relation_size(indexrelid) DESC
      LIMIT 20
    `

    const sizes = await AppDataSource.query(sizeQuery)

    console.log('Top 20 largest indexes:')
    console.log('─────────────────────────────────────────────────────────')
    sizes.forEach((row: any, i: number) => {
      console.log(
        `${(i + 1).toString().padStart(2, ' ')}. ${row.indexname.padEnd(40, ' ')} ${row.index_size.padStart(10, ' ')}`
      )
    })
    console.log('─────────────────────────────────────────────────────────\n')

    // Check for missing indexes
    console.log('🔍 Checking for potentially missing indexes...\n')

    const missingIndexQuery = `
      SELECT
        schemaname,
        tablename,
        attname,
        n_distinct,
        correlation
      FROM pg_stats
      WHERE schemaname = 'public'
        AND n_distinct > 100
        AND correlation < 0.1
      ORDER BY n_distinct DESC
      LIMIT 10
    `

    const potentialIndexes = await AppDataSource.query(missingIndexQuery)

    if (potentialIndexes.length > 0) {
      console.log('⚠️  Columns that might benefit from indexes:')
      potentialIndexes.forEach((row: any) => {
        console.log(
          `   - ${row.tablename}.${row.attname} (distinct values: ${row.n_distinct}, correlation: ${row.correlation})`
        )
      })
      console.log()
    } else {
      console.log('✅ No obvious missing indexes detected\n')
    }

    console.log('✨ Done!\n')
  } catch (error) {
    console.error('❌ Error creating indexes:', error)
    process.exit(1)
  }

  process.exit(0)
}

createIndexes()
