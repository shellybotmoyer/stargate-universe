/**
 * Asset URL Resolver — maps relative asset paths to full URLs.
 *
 * In development, paths are served by Vite's dev server (e.g., `/characters/eli.vrm`).
 * In production, paths are prefixed with the R2 public bucket URL.
 *
 * Set `VITE_R2_PUBLIC_URL` in `.env.production` to the public R2 bucket URL
 * (e.g., `https://sgu-assets.<account>.r2.dev`).
 */

const R2_PUBLIC_URL = (import.meta.env.VITE_R2_PUBLIC_URL as string | undefined) ?? "";

/**
 * Resolve an asset path to a full URL.
 *
 * - Absolute URLs (https://, //) are passed through unchanged.
 * - In development, paths are served by Vite from `public/` — NEVER rewrite
 *   to R2 in dev even if VITE_R2_PUBLIC_URL happens to be set, because the
 *   bucket may not mirror local assets yet (BUG-001: VRM 404s traced here).
 * - In production, relative paths are prefixed with the R2 public URL.
 *
 * @param path Asset path or URL
 * @returns Resolved URL string
 */
export function resolveAssetUrl(path: string): string {
	// Already an absolute URL — pass through
	if (/^[a-z]+:/i.test(path) || path.startsWith("//")) {
		return path;
	}

	// Dev mode — always serve from the Vite dev server (public/)
	if (import.meta.env.DEV) {
		return path;
	}

	// No R2 URL configured — pass through
	if (!R2_PUBLIC_URL) {
		return path;
	}

	// Ensure clean join (no double slashes)
	const base = R2_PUBLIC_URL.replace(/\/+$/, "");
	const asset = path.replace(/^\/+/, "");
	return `${base}/${asset}`;
}
