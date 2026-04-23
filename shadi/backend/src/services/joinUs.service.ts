import { AppDataSource } from '../config/database';
import { JoinUs } from '../entities/JoinUs';
import { ServiceType } from '../entities/Transaction';
import { AppError } from '../utils/AppError';
import {
  PaginationParams,
  PaginatedResponse,
  createPaginatedResponse,
} from '../types/pagination';

const joinUsRepository = AppDataSource.getRepository(JoinUs);

export interface JoinUsFilters {
  name?: string;
  phone?: string;
  engineeringType?: ServiceType;
}

export class JoinUsService {
  static async create(data: Partial<JoinUs>): Promise<JoinUs> {
    const joinUs = joinUsRepository.create(data);
    return joinUsRepository.save(joinUs);
  }

  static async update(id: string, data: Partial<JoinUs>): Promise<JoinUs> {
    const joinUs = await joinUsRepository.findOne({ where: { id } });

    if (!joinUs) {
      throw new AppError(404, 'NOT_FOUND', 'JoinUs record not found');
    }

    Object.assign(joinUs, data);
    return joinUsRepository.save(joinUs);
  }

  static async findById(id: string): Promise<JoinUs> {
    const joinUs = await joinUsRepository.findOne({ where: { id } });

    if (!joinUs) {
      throw new AppError(404, 'NOT_FOUND', 'JoinUs record not found');
    }

    return joinUs;
  }

  static async findAll(
    filters: JoinUsFilters,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<JoinUs>> {
    const queryBuilder = joinUsRepository.createQueryBuilder('joinUs');

    // Apply filters
    if (filters.name) {
      queryBuilder.andWhere('joinUs.name LIKE :name', {
        name: `%${filters.name}%`,
      });
    }

    if (filters.phone) {
      queryBuilder.andWhere('joinUs.phone LIKE :phone', {
        phone: `%${filters.phone}%`,
      });
    }

    if (filters.engineeringType) {
      queryBuilder.andWhere('joinUs.engineeringType LIKE :engineeringType', {
        engineeringType: `%${filters.engineeringType}%`,
      });
    }

    // Apply sorting
    const sortField = pagination.sort || 'createdAt';
    const sortOrder = pagination.order || 'DESC';
    queryBuilder.orderBy(`joinUs.${sortField}`, sortOrder);

    // Apply pagination
    const skip = (pagination.page - 1) * pagination.size;
    queryBuilder.skip(skip).take(pagination.size);

    const [data, total] = await queryBuilder.getManyAndCount();

    return createPaginatedResponse(data, total, pagination);
  }

  static async delete(id: string): Promise<void> {
    const result = await joinUsRepository.delete(id);

    if (result.affected === 0) {
      throw new AppError(404, 'NOT_FOUND', 'JoinUs record not found');
    }
  }
}
