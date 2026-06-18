/** Shape of API error JSON (HTTP 4xx/5xx body or RbacResponse). */
export interface ApiErrorBody {
  success?: boolean;
  message?: string;
  data?: { message?: string } | unknown;
}

/** Extract user-facing message from HttpErrorResponse or similar. */
export function extractApiError(err: unknown, fallback = 'Something went wrong'): string {
  if (!err || typeof err !== 'object') return fallback;
  const e = err as { error?: ApiErrorBody; message?: string };
  const fromBody = messageFromApiBody(e.error);
  if (fromBody) return fromBody;
  if (typeof e.message === 'string' && e.message) return e.message;
  return fallback;
}

/** When API returns 200 with success: false, return message; otherwise null. */
export function getApiResponseError(
  res: ApiErrorBody | null | undefined,
  fallback: string,
): string | null {
  if (!res || res.success !== false) return null;
  return messageFromApiBody(res) || res.message || fallback;
}

function messageFromApiBody(body: ApiErrorBody | undefined): string | undefined {
  if (!body) return undefined;
  const data = body.data;
  if (data && typeof data === 'object' && 'message' in data) {
    const msg = (data as { message?: string }).message;
    if (msg) return msg;
  }
  return body.message || undefined;
}

/** Pulls `data.attemptsRemaining` from either a thrown HttpErrorResponse or a success=false RbacResponse. */
export function extractAttemptsRemaining(source: unknown): number | null {
  if (!source || typeof source !== 'object') return null;
  const body =
    'error' in source ? (source as { error?: ApiErrorBody }).error : (source as ApiErrorBody);
  const data = body?.data;
  if (data && typeof data === 'object' && 'attemptsRemaining' in data) {
    const n = (data as { attemptsRemaining?: unknown }).attemptsRemaining;
    if (typeof n === 'number') return n;
  }
  return null;
}
