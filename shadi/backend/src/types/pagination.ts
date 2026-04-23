export interface PaginationParams {
  page: number;
  size: number;
  sort?: string;
  order?: 'ASC' | 'DESC';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    size: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export function parsePaginationParams(query: any): PaginationParams {
  const page = Math.max(1, parseInt(query.page) || 1);
  const size = Math.min(100, Math.max(1, parseInt(query.size) || 10));
  
  let sort = 'id';
  let order: 'ASC' | 'DESC' = 'DESC';
  
  if (query.sort) {
    const sortParts = query.sort.split(',');
    sort = sortParts[0] || 'id';
    order = sortParts[1]?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  }
  
  return { page, size, sort, order };
}

export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / params.size);
  
  return {
    data,
    pagination: {
      page: params.page,
      size: params.size,
      totalItems: total,
      totalPages,
      hasNext: params.page < totalPages,
      hasPrevious: params.page > 1,
    },
  };
}
