const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

const defaultApiBaseUrl = import.meta.env.DEV ? 'http://localhost:5000/api' : '/api';
const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl;
const configuredSocketUrl = import.meta.env.VITE_SOCKET_URL || '';

export const API_BASE_URL = trimTrailingSlash(configuredApiBaseUrl);
export const SOCKET_URL = configuredSocketUrl ? trimTrailingSlash(configuredSocketUrl) : '';
export const REALTIME_ENABLED = SOCKET_URL.length > 0;
