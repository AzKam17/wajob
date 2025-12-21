import {
  Repository,
  FindOptionsWhere,
  DeepPartial,
  FindManyOptions,
} from 'typeorm'
import { BaseEntity } from '../entities/BaseEntity'

export abstract class BaseRepository<T extends BaseEntity> {
  constructor(protected repository: Repository<T>) {}

  async create(data: DeepPartial<T>): Promise<T> {
    const entity = this.repository.create(data)
    return await this.repository.save(entity)
  }

  async findById(id: string): Promise<T | null> {
    return await this.repository.findOne({
      where: { id } as FindOptionsWhere<T>,
    })
  }

  async findBy(where: FindOptionsWhere<T>): Promise<T[]> {
    return await this.repository.find({ where })
  }

  async findOneBy(where: FindOptionsWhere<T>): Promise<T | null> {
    return await this.repository.findOne({ where })
  }

  async findAll(options?: FindManyOptions<T>): Promise<T[]> {
    return await this.repository.find(options)
  }

  async update(id: string, data: DeepPartial<T>): Promise<T | null> {
    await this.repository.update(id, data as any)
    return await this.findById(id)
  }

  async updateWhere(
    where: FindOptionsWhere<T>,
    data: DeepPartial<T>
  ): Promise<number> {
    const result = await this.repository.update(where, data as any)
    return result.affected || 0
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.softDelete(id)
    return (result.affected || 0) > 0
  }

  async hardDelete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id)
    return (result.affected || 0) > 0
  }

  async count(where?: FindOptionsWhere<T>): Promise<number> {
    return await this.repository.count({ where })
  }

  async restore(id: string): Promise<boolean> {
    const result = await this.repository.restore(id)
    return (result.affected || 0) > 0
  }
}
