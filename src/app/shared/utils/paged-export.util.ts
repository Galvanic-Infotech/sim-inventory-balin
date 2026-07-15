import { forkJoin, Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { RbacResponse } from '../models/rbac.model';

/** Fetch every page of a paginated API and concatenate `data` arrays. */
export function fetchAllPagedRows<T>(
  fetchPage: (pageNumber: number) => Observable<RbacResponse<T[]>>,
): Observable<T[]> {
  return fetchPage(1).pipe(
    switchMap((first) => {
      const rows = first.data ?? [];
      const totalPages = first.metadata?.pagination?.totalPages ?? 1;
      if (totalPages <= 1) return of(rows);

      return forkJoin(
        Array.from({ length: totalPages - 1 }, (_, i) => fetchPage(i + 2)),
      ).pipe(map((rest) => [...rows, ...rest.flatMap((r) => r.data ?? [])]));
    }),
  );
}
