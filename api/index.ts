import app from '../backend/src/app';

const getForwardedPath = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.join('/');
  }

  if (typeof value === 'string') {
    return value;
  }

  return '';
};

export default function handler(request: any, response: any) {
  const forwardedPath = getForwardedPath(request.query?.path);

  if (forwardedPath) {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(request.query || {})) {
      if (key === 'path') {
        continue;
      }

      if (Array.isArray(value)) {
        value.forEach((entry) => query.append(key, String(entry)));
        continue;
      }

      if (value !== undefined) {
        query.append(key, String(value));
      }
    }

    const queryString = query.toString();
    request.url = `/api/${forwardedPath}${queryString ? `?${queryString}` : ''}`;
  } else if (!request.url?.startsWith('/api')) {
    request.url = '/api';
  }

  return app(request, response);
}
