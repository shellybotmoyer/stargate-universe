/**
 * Build script — generates public/manifest.webmanifest from the typed
 * engine helper. Run as part of `bun run build` or manually with
 * `bun run scripts/gen-manifest.ts`.
 *
 * Keeping this as a script (rather than a static JSON) means the
 * manifest stays in sync with TypeScript types if the engine adds new
 * manifest fields or changes defaults.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateManifest } from "@kopertop/vibe-game-engine";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = `${__dirname}/../public/manifest.webmanifest`;

const manifest = generateManifest({
	name: "Stargate Universe",
	shortName: "SGU",
	description: "Survive aboard the Ancient vessel Destiny — a browser-native sci-fi RPG.",
	startUrl: "/?pwa=1",
	scope: "/",
	display: "fullscreen",
	orientation: "landscape",
	backgroundColor: "#000005",
	themeColor: "#4488ff",
	categories: ["games", "entertainment"],
	lang: "en-US",
	icons: [
		{ src: "/icons/icon-192.svg",          sizes: "192x192", type: "image/svg+xml", purpose: "any" },
		{ src: "/icons/icon-512.svg",          sizes: "512x512", type: "image/svg+xml", purpose: "any" },
		{ src: "/icons/icon-maskable-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
	],
});

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`✓ wrote ${outputPath}`);
