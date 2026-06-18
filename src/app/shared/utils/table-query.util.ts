import { TableLazyLoadEvent } from 'primeng/table';
import { SortOrder, TableQueryParams } from '../models/table-query.model';

export function tableQueryFromLazyEvent(
  event: TableLazyLoadEvent,
  overrides: Partial<TableQueryParams> = {},
): TableQueryParams {
  const rows = event.rows ?? overrides.pageSize ?? 10;
  const pageNumber = event.first != null && rows > 0 ? Math.floor(event.first / rows) + 1 : 1;

  const prevSortBy = overrides.sortBy;
  const prevSortOrder = overrides.sortOrder;
  let sortBy = prevSortBy;
  let sortOrder: SortOrder | undefined = prevSortOrder;

  if (event.sortField != null && event.sortField !== '') {
    sortBy = String(event.sortField);
    sortOrder = event.sortOrder === 1 ? 'asc' : event.sortOrder === -1 ? 'desc' : undefined;
  }

  return {
    pageNumber,
    pageSize: rows,
    sortBy,
    sortOrder,
    searchTerm: overrides.searchTerm,
    status: overrides.status,
  };
}

export function toQueryRecord(
  query: TableQueryParams,
  required: Record<string, string> = {},
): Record<string, string> {
  const params: Record<string, string> = { ...required };
  params['pageNumber'] = String(query.pageNumber ?? 1);
  params['pageSize'] = String(query.pageSize ?? 10);
  if (query.searchTerm?.trim()) {
    params['searchTerm'] = query.searchTerm.trim();
  }
  if (query.sortBy) {
    params['sortBy'] = query.sortBy;
  }
  if (query.sortOrder) {
    params['sortOrder'] = query.sortOrder;
  }
  if (query.status?.trim()) {
    params['status'] = query.status.trim();
  }
  return params;
}
