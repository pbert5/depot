import { describe, expect, it } from 'vitest';

const resolveE2EApiBaseURL = (environment: {
  E2E_API_BASE_URL?: string;
  WEB_BASE_URL?: string;
  HOST?: string;
  PORT?: string;
}) =>
  environment.E2E_API_BASE_URL
  ?? environment.WEB_BASE_URL
  ?? `http://${environment.HOST ?? 'localhost'}:${environment.PORT ?? '5173'}`;

describe('resolveE2EApiBaseURL', () => {
  it('prefers E2E_API_BASE_URL for API setup', () => {
    expect(resolveE2EApiBaseURL({ E2E_API_BASE_URL: 'http://depot-api:8787', WEB_BASE_URL: 'http://depot-web' })).toBe('http://depot-api:8787');
  });

  it('falls back to WEB_BASE_URL for backwards compatibility', () => {
    expect(resolveE2EApiBaseURL({ WEB_BASE_URL: 'http://depot-web' })).toBe('http://depot-web');
  });

  it('falls back to the local host and port', () => {
    expect(resolveE2EApiBaseURL({ HOST: '127.0.0.1', PORT: '5174' })).toBe('http://127.0.0.1:5174');
  });
});
