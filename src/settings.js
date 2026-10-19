// Player settings (audio levels, look, FOV), persisted in localStorage. `apply` is called with the whole object whenever a
// value changes so the game wires each key to its sink in one place (main.js).
const KEY = 'sgu.settings';
/** Default settings: master/music/sfx volume, sensitivity, invertY, fov, subtitles, clockScale. */
export const DEFAULTS = { master: 0.9, music: 1.0, sfx: 1.0, sensitivity: 1.0, invertY: false, fov: 60, subtitles: true, clockScale: 1.0 };
/** Mutable settings object (spread of DEFAULTS, overridden by localStorage). Read each frame; never assign directly — use setSetting. */
export const settings = { ...DEFAULTS };
try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) ?? '{}')); } catch (e) { console.warn('settings: failed to load saved settings', e); }
const listeners = new Set();
/** Subscribe to settings changes. The callback is called immediately with current settings and on every change.
 * @param {(settings: object) => void} fn — settings listener
 */
export const onSettings = (fn) => { listeners.add(fn); fn(settings); };
/** Set a setting key, persist to localStorage, and notify listeners.
 * @param {string} k — settings key (must exist in DEFAULTS)
 * @param {*} v — new value
 */
export const setSetting = (k, v) => { settings[k] = v; try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { console.warn('settings: failed to persist setting', e); } for (const fn of listeners) fn(settings); };
/** Reset all settings to DEFAULTS and persist. */
export const resetSettings = () => { for (const k in DEFAULTS) settings[k] = DEFAULTS[k]; setSetting('master', DEFAULTS.master); };

const FIELDS = [
	['master', 'Master volume', 'range', 0, 1, 0.05], ['music', 'Music', 'range', 0, 1, 0.05], ['sfx', 'Sound effects', 'range', 0, 1, 0.05],
	['sensitivity', 'Look sensitivity', 'range', 0.3, 2.5, 0.05], ['invertY', 'Invert look Y', 'checkbox'], ['fov', 'Field of view', 'range', 50, 90, 1], ['subtitles', 'Subtitles', 'checkbox'],
	['clockScale', 'Clock length (FTL window, countdowns)', 'range', 0.5, 2.5, 0.25],
];
/** Render the settings form into `el` (title screen and Kino Remote share it). */
export const renderSettings = (el) => {
	el.innerHTML = FIELDS.map(([k, label, type, min, max, step]) => `<div class="srow"><label>${label}</label>${type === 'checkbox' ? `<input type="checkbox" data-s="${k}" ${settings[k] ? 'checked' : ''}>` : `<input type="range" data-s="${k}" min="${min}" max="${max}" step="${step}" value="${settings[k]}"><b>${type === 'range' && max <= 2.5 ? Math.round(settings[k] * 100) + (k === 'sensitivity' ? '%' : '%') : settings[k]}</b>`}</div>`).join('') + `<div class="srow"><span></span><button class="btn" data-reset="1">Reset to defaults</button></div>`;
	el.querySelectorAll('[data-s]').forEach((inp) => (inp.oninput = () => { const k = inp.dataset.s; setSetting(k, inp.type === 'checkbox' ? inp.checked : +inp.value); const b = inp.nextElementSibling; if (b) b.textContent = k === 'fov' ? settings[k] : `${Math.round(settings[k] * 100)}%`; }));
	el.querySelector('[data-reset]').onclick = () => { resetSettings(); renderSettings(el); };
};
