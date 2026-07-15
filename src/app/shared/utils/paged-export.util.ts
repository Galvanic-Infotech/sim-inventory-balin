import { forkJoin, Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { RbacResponse } from '../models/rbac.model';

/** Fetch every page of a list API shaped as `{ rows, totalPages }`. */
export function fetchAllPages<T>(
  fetchPage: (pageNumber: number) => Observable<{ rows: T[]; totalPages: number }>,
): Observable<T[]> {
  return fetchPage(1).pipe(
    switchMap((first) => {
      if (first.totalPages <= 1) return of(first.rows);

      return forkJoin(
        Array.from({ length: first.totalPages - 1 }, (_, i) => fetchPage(i + 2)),
      ).pipe(map((rest) => [...first.rows, ...rest.flatMap((r) => r.rows)]));
    }),
  );
}

/** Fetch every page of an `RbacResponse<T[]>` API and concatenate `data` arrays. */
export function fetchAllPagedRows<T>(
  fetchPage: (pageNumber: number) => Observable<RbacResponse<T[]>>,
): Observable<T[]> {
  return fetchAllPages((pageNumber) =>
    fetchPage(pageNumber).pipe(
      map((res) => ({
        rows: res.data ?? [],
        totalPages: res.metadata?.pagination?.totalPages ?? 1,
      })),
    ),
  );
}
