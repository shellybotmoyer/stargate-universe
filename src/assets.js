// Asset root: dev serves the repo root (./models, ./sounds, ./data); the itch.io build sets
// window.__ASSET_ROOT = './assets/' in index.html and copies the referenced files under dist/assets/.
/** Base URL for all game assets. Defaults to './' (dev), overridden to './assets/' in the itch.io build. */
export const ASSETS = window.__ASSET_ROOT ?? './';
