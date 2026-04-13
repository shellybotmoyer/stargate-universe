/**
 * Build script — writes public/sw.js from the engine's default SW
 * template. Run with `bun run scripts/gen-sw.ts` (or as part of build).
 *
 * Keeping the SW as a generated file (rather than hand-editing one)
 * means engine-side improvements to caching strategy flow through on
 * the next `bun run build` without a per-game fork.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_SW_SOURCE } from "@kopertop/vibe-game-engine";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = `${__dirname}/../public/sw.js`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, DEFAULT_SW_SOURCE);
console.log(`✓ wrote ${outputPath}`);
