import { db } from '../index'
import { eq, and, isNull, SQL, sql } from 'drizzle-orm'
import type { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core'

export abstract class BaseRepository<
  T extends Record<string, unknown>,
  TInsert extends Record<string, unknown>
> {
  constructor(protected table: SQLiteTableWithColumns<any>) {}

  async create(data: TInsert): Promise<T> {
    const result = await db.insert(this.table).values(data).returning()
    return result[0] as T
  }

  async findById(id: string): Promise<T | null> {
    const result = await db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.id, id),
          isNull(this.table.deletedAt)
        )
      )
      .limit(1)

    return (result[0] as T) || null
  }

  async findBy(where: SQL): Promise<T[]> {
    const result = await db
      .select()
      .from(this.table)
      .where(and(where, isNull(this.table.deletedAt)))

    return result as T[]
  }

  async findOneBy(where: SQL): Promise<T | null> {
    const result = await db
      .select()
      .from(this.table)
      .where(and(where, isNull(this.table.deletedAt)))
      .limit(1)

    return (result[0] as T) || null
  }

  async findAll(): Promise<T[]> {
    const result = await db
      .select()
      .from(this.table)
      .where(isNull(this.table.deletedAt))

    return result as T[]
  }

  async update(id: string, data: Partial<TInsert>): Promise<T | null> {
    const updateData = {
      ...data,
      updatedAt: new Date(),
    }

    const result = await db
      .update(this.table)
      .set(updateData)
      .where(
        and(
          eq(this.table.id, id),
          isNull(this.table.deletedAt)
        )
      )
      .returning()

    return (result[0] as T) || null
  }

  async updateWhere(where: SQL, data: Partial<TInsert>): Promise<number> {
    const updateData = {
      ...data,
      updatedAt: new Date(),
    }

    const result = await db
      .update(this.table)
      .set(updateData)
      .where(and(where, isNull(this.table.deletedAt)))

    return result.changes
  }

  async delete(id: string): Promise<boolean> {
    const result = await db
      .update(this.table)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(this.table.id, id),
          isNull(this.table.deletedAt)
        )
      )

    return result.changes > 0
  }

  async hardDelete(id: string): Promise<boolean> {
    const result = await db.delete(this.table).where(eq(this.table.id, id))

    return result.changes > 0
  }

  async count(where?: SQL): Promise<number> {
    const conditions = where
      ? and(where, isNull(this.table.deletedAt))
      : isNull(this.table.deletedAt)

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(this.table)
      .where(conditions)

    return result[0]?.count || 0
  }
}
