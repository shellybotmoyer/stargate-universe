/**
 * Opening Cinematic — Start Screen only
 *
 * This scene shows a full-screen start menu (star field + title + NEW GAME /
 * CONTINUE), then hands off to the real gate-room scene.  All cinematic
 * camera work happens inside the gate-room via GateRoomCinematicController,
 * which is activated when sessionStorage["sgu-new-game"] is set.
 */
import * as THREE from "three";
import {
	createColocatedRuntimeSceneSource,
	defineGameScene,
} from "../../game/runtime-scene-sources";
import type { GameSceneModuleContext, GameSceneLifecycle } from "../../game/scene-types";

const assetUrlLoaders = import.meta.glob("./assets/**/*", {
	import: "default",
	query: "?url",
}) as Record<string, () => Promise<string>>;

// ─── Star-field background ────────────────────────────────────────────────────

function buildStarField(scene: THREE.Scene): THREE.Points {
	const count = 2000;
	const positions = new Float32Array(count * 3);
	for (let i = 0; i < count; i++) {
		positions[i * 3    ] = (Math.random() - 0.5) * 400;
		positions[i * 3 + 1] = (Math.random() - 0.5) * 400;
		positions[i * 3 + 2] = (Math.random() - 0.5) * 400;
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
	const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true });
	const stars = new THREE.Points(geo, mat);
	scene.add(stars);
	return stars;
}

// ─── DOM start screen ─────────────────────────────────────────────────────────

function createStartScreen(): { waitForChoice: () => Promise<"new" | "continue">; dispose: () => void } {
	const root = document.createElement("div");
	root.style.cssText = [
		"position:fixed;inset:0;display:flex;flex-direction:column;",
		"align-items:center;justify-content:center;z-index:100;",
		"background:rgba(0,0,0,0.55);font-family:'Segoe UI',sans-serif;",
	].join("");

	const title = document.createElement("h1");
	title.textContent = "STARGATE UNIVERSE";
	title.style.cssText = [
		"font-size:clamp(2rem,6vw,4.5rem);letter-spacing:0.25em;",
		"color:#d4b96a;text-shadow:0 0 40px #d4b96a88,0 0 80px #d4b96a44;",
		"margin:0 0 3rem;text-transform:uppercase;",
	].join("");

	const btnStyle = (active = false) => [
		"display:block;padding:1rem 3rem;margin:0.6rem;border:2px solid",
		active ? " #d4b96a;color:#d4b96a;" : " #ffffff66;color:#ffffffcc;",
		"background:transparent;font-size:1.1rem;letter-spacing:0.15em;",
		"text-transform:uppercase;cursor:pointer;transition:all 0.2s;",
		"font-family:inherit;",
	].join("");

	const newBtn  = document.createElement("button");
	newBtn.textContent  = "NEW GAME";
	newBtn.style.cssText = btnStyle(true);

	const contBtn = document.createElement("button");
	contBtn.textContent = "CONTINUE";
	contBtn.style.cssText = btnStyle(false);

	// Hover effects
	[newBtn, contBtn].forEach(btn => {
		btn.addEventListener("mouseenter", () => {
			btn.style.borderColor = "#d4b96a";
			btn.style.color = "#d4b96a";
			btn.style.boxShadow = "0 0 20px #d4b96a44";
		});
		btn.addEventListener("mouseleave", () => {
			if (btn !== document.activeElement) {
				btn.style.borderColor = "#ffffff66";
				btn.style.color = "#ffffffcc";
				btn.style.boxShadow = "";
			}
		});
	});

	root.appendChild(title);
	root.appendChild(newBtn);
	root.appendChild(contBtn);
	document.body.appendChild(root);

	// Keyboard nav
	let selected = 0;
	const buttons = [newBtn, contBtn];
	const updateFocus = () => {
		buttons.forEach((b, i) => {
			if (i === selected) {
				b.style.borderColor = "#d4b96a";
				b.style.color = "#d4b96a";
				b.style.boxShadow = "0 0 20px #d4b96a44";
			} else {
				b.style.borderColor = "#ffffff66";
				b.style.color = "#ffffffcc";
				b.style.boxShadow = "";
			}
		});
	};
	updateFocus();

	const waitForChoice = () => new Promise<"new" | "continue">((resolve) => {
		const onKey = (e: KeyboardEvent) => {
			if (e.code === "ArrowUp" || e.code === "ArrowDown") {
				selected = selected === 0 ? 1 : 0;
				updateFocus();
			}
			if (e.code === "Enter" || e.code === "Space") {
				window.removeEventListener("keydown", onKey);
				resolve(selected === 0 ? "new" : "continue");
			}
		};
		window.addEventListener("keydown", onKey);
		newBtn.addEventListener("click",  () => { window.removeEventListener("keydown", onKey); resolve("new"); });
		contBtn.addEventListener("click", () => { window.removeEventListener("keydown", onKey); resolve("continue"); });
	});

	const dispose = () => root.remove();

	return { waitForChoice, dispose };
}

// ─── Scene mount ──────────────────────────────────────────────────────────────

async function mount(context: GameSceneModuleContext): Promise<GameSceneLifecycle> {
	const { scene, camera, gotoScene } = context;

	// Black space background
	scene.background = new THREE.Color(0x000005);
	camera.position.set(0, 0, 1);
	camera.lookAt(0, 0, 0);

	const stars = buildStarField(scene);

	// Slow star drift
	let elapsed = 0;
	let disposed = false;

	const startScreen = createStartScreen();
	const choice = await startScreen.waitForChoice();
	startScreen.dispose();

	if (choice === "new") {
		// Signal gate-room to boot in cinematic mode
		sessionStorage.setItem("sgu-new-game", "1");
	} else {
		sessionStorage.removeItem("sgu-new-game");
	}

	// Navigate to gate-room — cinematic controller activates there if flagged
	void gotoScene("gate-room");

	return {
		update(delta: number) {
			if (disposed) return;
			elapsed += delta;
			// Slow rotation of star field for atmosphere
			stars.rotation.y = elapsed * 0.003;
			stars.rotation.x = Math.sin(elapsed * 0.001) * 0.05;
		},
		dispose() {
			disposed = true;
		},
	};
}

// ─── Scene definition ─────────────────────────────────────────────────────────

export const openingCinematicScene = defineGameScene({
	id: "opening-cinematic",
	source: createColocatedRuntimeSceneSource({
		assetUrlLoaders,
		manifestLoader: () => import("./scene.runtime.json?raw").then((m) => m.default),
	}),
	title: "Opening Cinematic",
	player: false,
	mount,
});
