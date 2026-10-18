---
paths:
  - "src/ui.js"
  - "src/console.js"
  - "src/leveledit.js"
---

# UI Code Rules

> **Web-era note:** The repo uses flat `src/*.js` modules (no `src/ui/` directory).
> UI-layer modules include `ui.js` (HUD/menus), `console.js` (dev console),
> and `leveledit.js` (in-game level editor).

- UI must NEVER own or directly modify game state — display only, use commands/events to request changes
- All UI text must go through the localization system — no hardcoded user-facing strings
- Support both keyboard/mouse AND gamepad input for all interactive elements
- All animations must be skippable and respect user motion/accessibility preferences
- UI sounds trigger through the audio event system, not directly
- UI must never block the game thread
- Scalable text and colorblind modes are mandatory, not optional
- Test all screens at minimum and maximum supported resolutions
