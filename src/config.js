/**
 * Application configuration.
 *
 * Values are read from environment variables (VITE_* prefix).
 * See .env.example for the full list.
 */
export const CONFIG = {
  /** Auto-refresh interval (fallback polling, only used if real-time sync is off) */
  AUTO_REFRESH_INTERVAL: Number(import.meta.env.VITE_AUTO_REFRESH_INTERVAL || 120000),

  /** Number of retry attempts for write operations */
  RETRY_ATTEMPTS: Number(import.meta.env.VITE_RETRY_ATTEMPTS || 3),

  /** Base delay for exponential backoff (ms) */
  RETRY_BASE_DELAY: Number(import.meta.env.VITE_RETRY_BASE_DELAY || 1000),
};
