// Chapter/quest engine: declarative steps advance when their `complete_when` flag is set. Triggers run on step enter/exit.
/** Create a quest engine that drives chapter progression from declarative step definitions.
 * @param {{onTrigger?: Function, onStep?: Function, onChapterComplete?: Function, grantXp?: Function}} hooks — callbacks for triggers, step changes, chapter completion, and XP awards
 * @returns {{chapters: Array, chapter: object|null, stepIndex: number, flags: Set, done: Array, load: Function, step: Function, chapterById: Function, startChapter: Function, setFlag: Function, has: Function, check: Function, nextChapter: Function}}
 */
export const createQuestEngine = ({ onTrigger, onStep, onChapterComplete, grantXp }) => {
	const chapterById = (id) => eng.chapters.find((c) => c.id === id);
	const runTriggers = (list) => { for (const t of list ?? []) onTrigger?.(t, eng); };
	const step = () => eng.chapter?.steps[eng.stepIndex] ?? null;
	const load = async (url) => { eng.chapters = (await (await fetch(url)).json()).chapters; };
	const startChapter = (id) => {
		eng.chapter = chapterById(id); eng.stepIndex = 0;
		// keep world-state flags (power, kino, seals…) across chapters; only reset the ones this chapter's steps complete on
		for (const s of eng.chapter.steps) eng.flags.delete(s.complete_when);
		runTriggers(step()?.on_enter); onStep?.(step(), eng.chapter);
	};
	const setFlag = (f) => { if (!f || eng.flags.has(f)) return; eng.flags.add(f); check(); };
	const has = (f) => eng.flags.has(f);
	/** Advance through every step whose completion flag is already set. */
	const check = () => {
		let guard = 0;
		while (eng.chapter && guard++ < 20) {
			const s = step(); if (!s || s.terminal) break;
			if (!eng.flags.has(s.complete_when)) break;
			runTriggers(s.on_exit); if (s.xp) grantXp?.(s.xp);
			eng.stepIndex++;
			const n = step(); runTriggers(n?.on_enter); onStep?.(n, eng.chapter);
			if (n?.terminal) { eng.done.push(eng.chapter.id); onChapterComplete?.(eng.chapter); }
		}
	};
	const nextChapter = () => { const i = eng.chapters.indexOf(eng.chapter); return eng.chapters[i + 1] ?? null; };
	const eng = { chapters: [], chapter: null, stepIndex: 0, flags: new Set(), done: [], load, step, chapterById, startChapter, setFlag, has, check, nextChapter };
	return eng;
};
