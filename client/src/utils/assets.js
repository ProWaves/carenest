// ==========================================================================
// client/src/utils/assets.js — Backend asset URL helper
// ==========================================================================
// The backend stores relative asset paths (e.g. "/uploads/abc.jpg") and serves
// them from its root. This helper converts those relative paths into absolute
// URLs based on the environment.
//
//   Production:  VITE_API_URL = https://sitterspot-backend.onrender.com/api
//                → ASSET_BASE = https://sitterspot-backend.onrender.com
//
//   Dev (Vite):  VITE_API_URL = /api
//                → ASSET_BASE = "" (the dev proxy forwards /uploads/* to
//                  the backend, so relative paths just work)
//
// Usage:
//   import { assetUrl } from '../utils/assets';
//   <img src={assetUrl(user.avatar_url)} />
//
// Returns an empty string for null/undefined input so callers can safely do
// `<img src={assetUrl(x)} />` without extra checks.
// ==========================================================================

const ASSET_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '');

export function assetUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  // Ensure we don't double-slash
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${ASSET_BASE}${cleanPath}`;
}

export { ASSET_BASE };