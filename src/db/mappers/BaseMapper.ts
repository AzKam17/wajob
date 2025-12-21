import { BaseEntity } from '../entities/BaseEntity'

export interface IModel {
  id?: string
  createdAt?: Date
  updatedAt?: Date
}

export abstract class BaseMapper<TModel extends IModel, TEntity extends BaseEntity> {
  /**
   * Convert model to entity for saving to database
   */
  abstract toEntity(model: TModel): Partial<TEntity>

  /**
   * Convert entity to model for business logic
   */
  abstract toModel(entity: TEntity): TModel

  /**
   * Convert array of models to entities
   */
  toEntities(models: TModel[]): Partial<TEntity>[] {
    return models.map(model => this.toEntity(model))
  }

  /**
   * Convert array of entities to models
   */
  toModels(entities: TEntity[]): TModel[] {
    return entities.map(entity => this.toModel(entity))
  }

  /**
   * Create entity instance with base fields
   */
  protected mapBaseToEntity(model: IModel): Partial<BaseEntity> {
    return {
      id: model.id,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    }
  }

  /**
   * Create model with base fields from entity
   */
  protected mapBaseToModel(entity: BaseEntity): IModel {
    return {
      id: entity.id,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    }
  }
}
