// Global type declarations for stargate-universe
// Declares custom window properties used by the game's debug/autoplay/recorder systems.

interface Window {
  /** Debug API exposed at window.__dbg for console inspection and autoplay. */
  __dbg?: any;
  /** Save/load API at window.__save. */
  __save?: any;
  /** Autoplay driver at window.__auto (created via ?autoplay query param). */
  __auto?: any;
  /** In-page recorder at window.__rec (created via ?record query param). */
  __rec?: any;
  /** Asset root path set in index.html, used by assets.js. */
  __ASSET_ROOT?: string;
}
