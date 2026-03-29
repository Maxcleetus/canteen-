const parseConfiguredOrigins = () =>
  (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

export const isAllowedOrigin = (origin: string | undefined) => {
  if (!origin) {
    return true;
  }

  const configuredOrigins = parseConfiguredOrigins();
  if (configuredOrigins.length === 0) {
    return true;
  }

  if (configuredOrigins.includes('*')) {
    return true;
  }

  if (configuredOrigins.includes(origin)) {
    return true;
  }

  return false;
};

export const applyCorsHeaders = (requestOrigin: string | undefined, response: { header: (key: string, value: string) => unknown }) => {
  if (!requestOrigin || !isAllowedOrigin(requestOrigin)) {
    return;
  }

  response.header('Access-Control-Allow-Origin', requestOrigin);
  response.header('Vary', 'Origin');
  response.header('Access-Control-Allow-Credentials', 'true');
  response.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  response.header(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, X-Requested-With'
  );
};
