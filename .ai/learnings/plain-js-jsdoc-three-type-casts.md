# Plain-JS + JSDoc: Three.js Type Casts

## Lesson

When using TypeScript's `checkJs`/JSDoc mode on a plain-JS Three.js project
(no `tsc` build step, just `tsc --noEmit` for type-checking), the most common
errors are all **type-narrowing casts** — not logic bugs. Fix them with JSDoc
`@type` and `@cast` annotations, not by switching to `.ts` files.

## Patterns

### `Object3D` → `Mesh` (and children)

Three.js factory functions (`new THREE.Mesh()`, `scene.getObjectByName()`)
return `Object3D` or `Mesh` depending on overload. JSDoc infers the wider
type. When you access `.geometry`, `.material`, or `.morphTargetInfluences`,
cast:

```js
/** @type {THREE.Mesh} */
const mesh = scene.getObjectByName('player');
mesh.geometry.setAttribute('position', buf);
```

For `SkinnedMesh` specifically, use `@type {THREE.SkinnedMesh}`.

### `EventTarget` → `HTMLElement`

DOM events fire on `EventTarget`, but you often need `.tagName`, `.style`,
`.classList`, or `.requestPointerLock()`. Cast in the handler:

```js
document.addEventListener('click', (/** @type {MouseEvent} */ e) => {
  /** @type {HTMLElement} */
  const el = e.target;
  if (el.tagName === 'BUTTON') { /* ... */ }
});
```

For inputs: `/** @type {HTMLInputElement} */ (el)` to access `.value`, `.checked`.

### `window` custom globals

Dev/debug globals (`window.__dbg`, `window.__save`, `window.__auto`,
`window.__rec`, `window.__ASSET_ROOT`) don't exist in any TS lib. Add a
`globals.d.ts` file:

```ts
interface Window {
  __dbg?: object;
  __save?: (slot: number) => void;
  __auto?: { run: () => void; report: object };
  __rec?: { start: (n: string) => void; stop: () => void };
  __ASSET_ROOT?: string;
}
```

This resolves 10+ `TS2339: Property '__dbg' does not exist on type 'Window'`
errors in one shot.

### BiquadFilterType

`BiquadFilterNode.type` expects `BiquadFilterType` (a TS union), not a plain
string. Use the constant:

```js
filter.type = 'lowpass'; // TS error
filter.type = THREE.AudioContext LowPassFilter; // wrong
// Correct — TS knows 'lowpass' is a valid BiquadFilterType
```

Actually `'lowpass'` IS a valid `BiquadFilterType` — the error only appears
if the JSDoc `@type` on the variable was annotated as `string` instead of
`BiquadFilterType`. Remove the explicit `string` annotation and let TS infer.

### AnimationAction loop parameter

`AnimationAction.setLoop(THREE.LoopRepeat, count)` — the first arg is
`AnimationActionLoopStyles`, not `number`. Use the constant, not a magic
number.

### `flow.play()` return type

If a function sometimes returns `undefined` (early exit) and sometimes an
object, JSDoc `@returns {Object}` will error. Use `@returns {Object|undefined}`
or `@returns {Object|void}`.

### Optional chaining on nullable DOM refs

```js
// TS error: Object is possibly 'null'
element.requestFullscreen();
// Fix:
element?.requestFullscreen?.();
```

## Verification

After all fixes, `npx tsc --noEmit --project jsconfig.json` should output
zero errors. CI on origin/main does not run tsc (only `node --check` for
syntax), but the local main and PR #197 branch both pass clean.

## Context

- 200+ TS errors were resolved across 20+ commits (2026-11-09 through 2026-11-10)
- All fixes are JSDoc annotations or type casts — zero `.ts` files added
  (except `globals.d.ts` which is a type declaration file, not source)
- The project uses `jsconfig.json` with `checkJs: true` and `allowJs: true`
