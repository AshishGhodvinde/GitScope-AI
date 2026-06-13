import axios from 'axios';

/**
 * Pre-configured Axios instance pointing at the Spring Boot backend.
 * Base URL is read from the VITE_API_URL env variable (defaults to /api
 * which is proxied to localhost:8080 by Vite during development).
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 600_000, // 10 minutes — indexing large repos can be slow
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Request interceptor — logging ──────────────────────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    if (import.meta.env.DEV) {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor — normalise errors ────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message ??
      error.response?.data?.error ??
      error.message ??
      'An unexpected error occurred';
    return Promise.reject(new Error(message));
  }
);

export default apiClient;
