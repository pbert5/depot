type E2EEnvironment = {
  E2E_API_BASE_URL?: string;
  WEB_BASE_URL?: string;
  HOST?: string;
  PORT?: string;
};

export const resolveE2EApiBaseURL = (environment: E2EEnvironment) =>
  environment.E2E_API_BASE_URL
  ?? environment.WEB_BASE_URL
  ?? `http://${environment.HOST ?? 'localhost'}:${environment.PORT ?? '5173'}`;
