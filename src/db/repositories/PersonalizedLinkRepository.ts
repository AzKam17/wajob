import { AppDataSource } from '../index'
import { PersonalizedLinkEntity } from '../entities/PersonalizedLinkEntity'
import { BaseRepository } from './BaseRepository'

export class PersonalizedLinkRepository extends BaseRepository<PersonalizedLinkEntity> {
  constructor() {
    super(AppDataSource.getRepository(PersonalizedLinkEntity))
  }

  async incrementClickCount(id: string, clickData: Record<string, any>): Promise<PersonalizedLinkEntity | null> {
    const link = await this.findById(id)
    if (!link) return null

    // Initialize click history if it doesn't exist
    const clickHistory = link.metadata?.clickHistory || []

    // Append the new click data to the history
    clickHistory.push({
      clickNumber: link.clickCount + 1,
      ...clickData,
    })

    return await this.update(id, {
      clickCount: link.clickCount + 1,
      metadata: {
        ...link.metadata,
        clickHistory,
        lastClick: clickData,
      },
    })
  }

  async findByPhoneNumber(phoneNumber: string): Promise<PersonalizedLinkEntity[]> {
    return await this.findBy({ phoneNumber })
  }

  async getClicksPerTimeBucket(startTime: number, endTime: number): Promise<Array<{ bucket: number; count: number }>> {
    const bucketSize = this.calculateBucketSize(startTime, endTime)

    try {
      // metadata is stored as simple-json (TEXT), timestamp is ISO string
      const results = await this.repository.query(`
        SELECT
          FLOOR(EXTRACT(EPOCH FROM (click->>'timestamp')::timestamp) * 1000 / $1) * $1 as bucket,
          COUNT(*) as count
        FROM personalized_links,
          jsonb_array_elements(metadata::jsonb->'clickHistory') as click
        WHERE "deletedAt" IS NULL
          AND EXTRACT(EPOCH FROM (click->>'timestamp')::timestamp) * 1000 >= $2
          AND EXTRACT(EPOCH FROM (click->>'timestamp')::timestamp) * 1000 <= $3
        GROUP BY bucket
        ORDER BY bucket ASC
      `, [bucketSize, startTime, endTime])

      return results.map((r: any) => ({
        bucket: parseInt(r.bucket),
        count: parseInt(r.count),
      }))
    } catch (e) {
      console.error('getClicksPerTimeBucket error:', e)
      return []
    }
  }

  async getDeviceBreakdown(startTime: number, endTime: number): Promise<Array<{ device: string; count: number }>> {
    try {
      // metadata is stored as simple-json (TEXT), parse userAgent for device info
      const results = await this.repository.query(`
        SELECT
          CASE
            WHEN click->>'userAgent' ILIKE '%mobile%' OR click->>'userAgent' ILIKE '%android%' OR click->>'userAgent' ILIKE '%iphone%' THEN 'Mobile'
            WHEN click->>'userAgent' ILIKE '%tablet%' OR click->>'userAgent' ILIKE '%ipad%' THEN 'Tablet'
            WHEN click->>'userAgent' ILIKE '%bot%' OR click->>'userAgent' ILIKE '%crawler%' THEN 'Bot'
            WHEN click->>'userAgent' IS NULL OR click->>'userAgent' = '' THEN 'Unknown'
            ELSE 'Desktop'
          END as device,
          COUNT(*) as count
        FROM personalized_links,
          jsonb_array_elements(metadata::jsonb->'clickHistory') as click
        WHERE "deletedAt" IS NULL
          AND EXTRACT(EPOCH FROM (click->>'timestamp')::timestamp) * 1000 >= $1
          AND EXTRACT(EPOCH FROM (click->>'timestamp')::timestamp) * 1000 <= $2
        GROUP BY device
        ORDER BY count DESC
      `, [startTime, endTime])

      return results.map((r: any) => ({
        device: r.device || 'Unknown',
        count: parseInt(r.count),
      }))
    } catch (e) {
      console.error('getDeviceBreakdown error:', e)
      return []
    }
  }

  private calculateBucketSize(startTime: number, endTime: number): number {
    const duration = endTime - startTime
    const fifteenMin = 15 * 60 * 1000
    const oneHour = 60 * 60 * 1000
    const oneDay = 24 * 60 * 60 * 1000

    if (duration <= fifteenMin) return 60 * 1000 // 1 minute buckets
    if (duration <= oneHour) return 5 * 60 * 1000 // 5 minute buckets
    if (duration <= 6 * oneHour) return 15 * 60 * 1000 // 15 minute buckets
    if (duration <= oneDay) return oneHour // 1 hour buckets
    if (duration <= 7 * oneDay) return 6 * oneHour // 6 hour buckets
    return oneDay // 1 day buckets
  }
}
