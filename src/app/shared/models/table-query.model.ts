export type SortOrder = 'asc' | 'desc';

export interface TableQueryParams {
  pageNumber?: number;
  pageSize?: number;
  searchTerm?: string;
  sortBy?: string;
  sortOrder?: SortOrder;
  status?: string;
}
