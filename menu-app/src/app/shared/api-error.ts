import { HttpErrorResponse } from '@angular/common/http';

/**
 * The message to show for a failed API call: the server's own message, or the first field
 * validation error (e.g. "Enter a valid GSTIN…"), else the fallback.
 */
export function apiError(err: HttpErrorResponse | any, fallback: string): string {
  const body = err?.error;
  if (body?.message) return body.message;
  const errors = body?.errors;
  if (errors && typeof errors === 'object') {
    const first = Object.values(errors).flat().find(v => typeof v === 'string');
    if (first) return first as string;
  }
  return fallback;
}
