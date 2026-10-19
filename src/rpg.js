// RPG layer: level/XP, health/oxygen, inventory, equipment slots, talents. Item catalog = repo data/items.json + web-only additions.
import { ASSETS } from './assets.js';
const listeners = new Set();
/** Subscribe to RPG state changes. The callback receives the current `rpg` state object on every mutation.
 * @param {(rpg: object) => void} fn — change listener
 */
export const onRpgChange = (fn) => listeners.add(fn);
const emit = () => { for (const fn of listeners) fn(rpg); };

/** Item catalog: id → { id, name, category, slot?, stackable, description, stats? }. Populated at init from items.json + WEB_ITEMS. */
export const ITEMS = {};
const WEB_ITEMS = [
	{ id: 'shovel', name: 'Field Shovel', category: 'equipment', slot: 'tool', stackable: false, description: 'Folding entrenching tool. Required to dig lime or cut ice.', stats: { mine: 1 } },
	{ id: 'refined_lime', name: 'Refined Lime', category: 'resource', stackable: true, description: 'Calcium hydroxide, ready for the CO2 scrubber bed.' },
	{ id: 'ice', name: 'Ice', category: 'resource', stackable: true, description: 'Frozen water cut from the surface.' },
	{ id: 'radio', name: 'Crew Radio', category: 'tool', stackable: false, description: 'Short-range crew radio.' },
	{ id: 'conduit', name: 'Conduit Segment', category: 'resource', stackable: true, description: 'Ancient alloy machined by Brody to bridge the crew-deck power junction.' },
];
/** Consumables: `use(id)` runs these and removes one. */
const USES = { rations: { verb: 'Eat', apply: () => { rpg.hp = Math.min(stats().maxHp, rpg.hp + 25); return 'Ate a ration pack (+25 health)'; } } };
/** Check whether an item id is usable (has a USES entry).
 * @param {string} id — item id
 * @returns {boolean}
 */
export const usable = (id) => !!USES[id];
/** Use one unit of a consumable item: applies its effect, decrements inventory, and emits change.
 * @param {string} id — item id
 * @returns {boolean} true if the item was used, false if not usable or out of stock
 */
export const use = (id) => { const u = USES[id]; if (!u || count(id) <= 0) return false; const msg = u.apply(); removeItem(id, 1); addLog(msg); emit(); return true; };
/** Get the verb for using an item (e.g. "Eat" for rations). Falls back to "Use".
 * @param {string} id — item id
 * @returns {string}
 */
export const useVerb = (id) => USES[id]?.verb ?? 'Use';
/** Inventory icon: 160 px copy of the repo sprite when one exists (assets/items/<id>.png), else an emoji glyph. */
const ICON_SPRITES = new Set(['combat_boots', 'field_backpack', 'kino_orb', 'kino_remote', 'large_fuse', 'lime', 'marine_helmet', 'rations', 'recon_cap', 'small_fuse', 'tablet', 'tac_vest']);
const GLYPHS = { shovel: '⛏', refined_lime: '🧪', ice: '🧊', radio: '📻', water: '💧', food: '🍲', parts: '⚙️', conduit: '🔩', bus_fuse: '🔌', sidearm: '🔫' };
/** Render the inventory icon HTML for an item: sprite img if available, else an emoji glyph span.
 * @param {string} id — item id
 * @returns {string} HTML string
 */
export const iconHtml = (id) => (ICON_SPRITES.has(id) ? `<img src="./assets/items/${id}.png" alt="">` : `<span>${GLYPHS[id] ?? '▪'}</span>`);
const GEAR_STATS = { field_backpack: { carry: 6 }, tac_vest: { hp: 20 }, marine_helmet: { hp: 10 }, recon_cap: { speed: 0.05 }, combat_boots: { speed: 0.08 } };

/** Talent definitions: id, display name, description, max rank, stat key, per-rank bonus. */
export const TALENTS = [
	{ id: 'engineer', name: 'Engineer', desc: 'Dig / cut 30% faster per rank.', max: 3, stat: 'mine', per: 0.3 },
	{ id: 'pathfinder', name: 'Pathfinder', desc: 'Move 8% faster per rank.', max: 3, stat: 'speed', per: 0.08 },
	{ id: 'pack_mule', name: 'Pack Mule', desc: '+2 carry capacity per rank.', max: 3, stat: 'carry', per: 2 },
];

/** Mutable RPG state: level, XP, health, oxygen, inventory, equipment, talents, log. Emit via onRpgChange listeners. */
export const rpg = {
	level: 1, xp: 0, hp: 100, o2: 100, talentPoints: 0,
	inventory: {},            // id → count
	equipment: { head: null, torso: null, back: null, legs: null, tool: null },
	talents: { engineer: 0, pathfinder: 0, pack_mule: 0 },
	log: [],                  // chat/log panel entries
};
/** XP required to advance from the given level to the next.
 * @param {number} lvl — current level
 * @returns {number}
 */
export const xpToNext = (lvl) => 100 * lvl;

/** Load the item catalog: fetches data/items.json (optional) and merges with WEB_ITEMS.
 * @returns {Promise<void>}
 */
export const loadItems = async () => {
	try { for (const it of await (await fetch(`${ASSETS}data/items.json`)).json()) ITEMS[it.id] = it; } catch (e) { console.warn('items.json load failed, using WEB_ITEMS fallback:', e?.message ?? e); }
	for (const it of WEB_ITEMS) ITEMS[it.id] = it;
	if (ITEMS.field_backpack) ITEMS.field_backpack.description ??= 'Roomy canvas pack. +6 carry.';
};

/** Append a message to the RPG log panel (capped at 80 entries, FIFO). Emits change.
 * @param {string} text — log message
 */
export const addLog = (text) => { rpg.log.push(text); if (rpg.log.length > 80) rpg.log.shift(); emit(); };
/** Get the count of an item in inventory (0 if not present).
 * @param {string} id — item id
 * @returns {number}
 */
export const count = (id) => rpg.inventory[id] ?? 0;
/** Add n units of an item to inventory and log the receipt. Emits change.
 * @param {string} id — item id
 * @param {number} [n=1] — quantity
 */
export const addItem = (id, n = 1) => { rpg.inventory[id] = count(id) + n; addLog(`Received: ${ITEMS[id]?.name ?? id}${n > 1 ? ` ×${n}` : ''}`); emit(); };
/** Remove n units of an item from inventory. Deletes the entry when count reaches zero. Emits change.
 * @param {string} id — item id
 * @param {number} [n=1] — quantity
 */
export const removeItem = (id, n = 1) => { const c = count(id) - n; if (c <= 0) delete rpg.inventory[id]; else rpg.inventory[id] = c; emit(); };
/** Equip an item to its slot: swaps out previous gear back to inventory, applies stat caps.
 * @param {string} id — item id with a slot property
 * @returns {boolean} true if equipped, false if item has no slot
 */
export const equip = (id) => {
	const it = ITEMS[id]; if (!it?.slot) return false;
	const prev = rpg.equipment[it.slot]; if (prev) rpg.inventory[prev] = count(prev) + 1;
	rpg.equipment[it.slot] = id; if (count(id) > 0) removeItem(id, 1);
	rpg.hp = Math.min(rpg.hp, stats().maxHp); emit(); return true;
};
/** Unequip gear from a slot: returns the item to inventory. Emits change.
 * @param {string} slot — equipment slot key (head, torso, back, legs, tool)
 */
export const unequip = (slot) => { const id = rpg.equipment[slot]; if (!id) return; rpg.equipment[slot] = null; rpg.inventory[id] = count(id) + 1; emit(); };
/** Spend a talent point to rank up a talent. Logs and emits change.
 * @param {string} id — talent id (must exist in TALENTS)
 * @returns {boolean} true if ranked up, false if no points or max rank reached
 */
export const spendTalent = (id) => {
	const t = TALENTS.find((x) => x.id === id); if (!t || rpg.talentPoints <= 0 || rpg.talents[id] >= t.max) return false;
	rpg.talents[id]++; rpg.talentPoints--; addLog(`Talent: ${t.name} rank ${rpg.talents[id]}`); emit(); return true;
};
/** Derived stats from level, gear and talents. */
export const stats = () => {
	let carry = 2, mine = 0, speed = 1, maxHp = 100 + (rpg.level - 1) * 5;
	for (const id of Object.values(rpg.equipment)) { const g = GEAR_STATS[id]; if (g) { carry += g.carry ?? 0; maxHp += g.hp ?? 0; speed += g.speed ?? 0; } if (ITEMS[id]?.stats?.mine) mine += ITEMS[id].stats.mine; }
	for (const t of TALENTS) { const r = rpg.talents[t.id]; if (t.stat === 'carry') carry += r * t.per; if (t.stat === 'mine') mine *= 1 + r * t.per; if (t.stat === 'speed') speed += r * t.per; }
	return { carry, mineSpeed: mine, speed, maxHp, canMine: mine > 0 };
};
/** Total weight of carried resources (stackable resource items only).
 * @returns {number}
 */
export const carried = () => Object.entries(rpg.inventory).reduce((n, [id, c]) => n + (ITEMS[id]?.category === 'resource' ? c : 0), 0);
/** Grant XP to the player: handles level-up loop, awards talent points, heals to max on level-up. Logs and emits.
 * @param {number} n — XP amount
 * @returns {number} number of level-ups
 */
export const grantXp = (n) => {
	rpg.xp += n; let ups = 0;
	while (rpg.xp >= xpToNext(rpg.level)) { rpg.xp -= xpToNext(rpg.level); rpg.level++; rpg.talentPoints++; ups++; }
	addLog(`+${n} XP${ups ? ` — Level ${rpg.level}! +${ups} talent point` : ''}`); rpg.hp = stats().maxHp; emit(); return ups;
};
/** Persist RPG state to localStorage (log truncated to last 30 entries).
 * @returns {void}
 */
export const save = () => { try { localStorage.setItem('sgu.rpg', JSON.stringify({ ...rpg, log: rpg.log.slice(-30) })); } catch (e) { console.warn('rpg: failed to save game state', e); } };
/** Load RPG state from localStorage into the shared `rpg` object.
 * @returns {void}
 */
export const load = () => { try { const s = JSON.parse(localStorage.getItem('sgu.rpg') || 'null'); if (s) Object.assign(rpg, s); } catch (e) { console.warn('rpg: failed to load saved game state', e); } };
