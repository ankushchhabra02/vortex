import { NextResponse } from 'next/server';

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'PROVIDER_ERROR'
  | 'INTERNAL_ERROR';

interface ApiErrorOptions {
  code: ErrorCode;
  message: string;
  status: number;
}

export function apiError({ code, message, status }: ApiErrorOptions): NextResponse {
  return NextResponse.json({ error: message, code }, { status });
}
