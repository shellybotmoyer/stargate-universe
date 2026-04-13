/**
 * GateRoomCinematicController
 *
 * Plugs into the live gate-room scene to play the 9-beat "Air" opening
 * sequence.  It reuses everything already in the scene — the room geometry,
 * lighting, and the player's VRoid (Eli) — and loads additional crew members
 * via loadCrewMember().  When Beat 9 ends it calls onComplete() so the
 * caller can re-enable StarterPlayerController input.
 */

import * as THREE from "three";
import { loadCrewMember } from "../../characters/character-loader";
import type { CharacterLoadResult } from "../../characters/character-loader";

// ─── Beat definitions ─────────────────────────────────────────────────────────

interface Beat {
	start: number;
	end: number;
	camFrom: THREE.Vector3;
	camTo: THREE.Vector3;
	lookAt: THREE.Vector3;
	easing: "linear" | "ease-in" | "ease-out" | "smooth";
}

function smooth(t: number): number {
	return t * t * (3 - 2 * t);
}

function easeIn(t: number): number {
	return t * t;
}

function easeOut(t: number): number {
	return 1 - (1 - t) * (1 - t);
}

function applyEasing(t: number, mode: Beat["easing"]): number {
	switch (mode) {
		case "ease-in":  return easeIn(t);
		case "ease-out": return easeOut(t);
		case "smooth":   return smooth(t);
		default:         return t;
	}
}

// Gate center in world space (matches gate-room buildStargate placement)
const GATE_CENTER = new THREE.Vector3(0, 3.2, 0);
const GATE_BACK   = new THREE.Vector3(0, 3.2, 0.5);  // just behind the horizon
const OVERHEAD    = new THREE.Vector3(0, 14, -4);

const BEATS: Beat[] = [
	// Beat 1 — dormant gate, slow push toward ring
	{
		start: 0, end: 4,
		camFrom: new THREE.Vector3(0, 1.7, 16),
		camTo:   new THREE.Vector3(0, 1.7,  6),
		lookAt:  GATE_CENTER,
		easing:  "ease-in",
	},
	// Beat 2 — gate activates, kawoosh expands
	{
		start: 4, end: 7,
		camFrom: new THREE.Vector3(0, 1.7, 6),
		camTo:   new THREE.Vector3(0, 1.7, 4),
		lookAt:  GATE_CENTER,
		easing:  "ease-out",
	},
	// Beat 3 — Scott through, low angle toward camera
	{
		start: 7, end: 11,
		camFrom: new THREE.Vector3(0.5, 0.6, -2),
		camTo:   new THREE.Vector3(0.5, 0.6, -4),
		lookAt:  GATE_BACK,
		easing:  "linear",
	},
	// Beat 4 — evacuation chaos, crew flying, camera shake
	{
		start: 11, end: 16,
		camFrom: new THREE.Vector3(-1.5, 0.4, -5),
		camTo:   new THREE.Vector3(-2.0, 0.4, -8),
		lookAt:  new THREE.Vector3(0, 2, 0),
		easing:  "linear",
	},
	// Beat 5 — overhead wide shot, NPCs sprawled
	{
		start: 16, end: 20,
		camFrom: OVERHEAD.clone(),
		camTo:   OVERHEAD.clone().add(new THREE.Vector3(0, -1, 0)),
		lookAt:  new THREE.Vector3(0, 0, -4),
		easing:  "smooth",
	},
	// Beat 6 — Rush lands clean, walks off
	{
		start: 20, end: 23,
		camFrom: new THREE.Vector3(-3, 1.4, -4),
		camTo:   new THREE.Vector3(-4, 1.4, -8),
		lookAt:  new THREE.Vector3(-2, 1.4, -6),
		easing:  "ease-out",
	},
	// Beat 7 — Eli and TJ tumble through
	{
		start: 23, end: 26,
		camFrom: new THREE.Vector3(1.5, 0.5, -3),
		camTo:   new THREE.Vector3(2.0, 0.5, -6),
		lookAt:  GATE_BACK,
		easing:  "linear",
	},
	// Beat 8 — Young last through at high speed, gate flickers shut
	{
		start: 26, end: 31,
		camFrom: new THREE.Vector3(0, 1.4, -4),
		camTo:   new THREE.Vector3(0, 1.4, -10),
		lookAt:  new THREE.Vector3(0, 1.2, -16),
		easing:  "ease-in",
	},
	// Beat 9 — ground level push up near Eli, Scott crouches in
	{
		start: 31, end: 36,
		camFrom: new THREE.Vector3(0.4, 0.15, -2.5),
		camTo:   new THREE.Vector3(0.4, 0.9,  -2.5),
		lookAt:  new THREE.Vector3(0.4, 1.0,  -5),
		easing:  "ease-out",
	},
];

const TOTAL_DURATION = 36;

// ─── Thrown NPC helper ────────────────────────────────────────────────────────

interface ThrownActor {
	char: CharacterLoadResult;
	startPos: THREE.Vector3;
	velocity: THREE.Vector3;
	t0: number;         // time within the beat that throw starts
	flightTime: number;
	landPos: THREE.Vector3;
	landed: boolean;
}

function createThrownActor(
	char: CharacterLoadResult,
	startPos: THREE.Vector3,
	velocity: THREE.Vector3,
	t0: number,
	flightTime: number,
	landPos: THREE.Vector3,
): ThrownActor {
	char.root.position.copy(startPos);
	char.root.visible = false;
	return { char, startPos: startPos.clone(), velocity: velocity.clone(), t0, flightTime, landPos: landPos.clone(), landed: false };
}

function updateThrown(actor: ThrownActor, beatElapsed: number) {
	const t = beatElapsed - actor.t0;
	if (t < 0) return;

	actor.char.root.visible = true;

	if (actor.landed) return;

	if (t >= actor.flightTime) {
		actor.landed = true;
		actor.char.root.position.copy(actor.landPos);
		return;
	}

	// Parabolic arc
	actor.char.root.position.set(
		actor.startPos.x + actor.velocity.x * t,
		actor.startPos.y + actor.velocity.y * t - 4.9 * t * t,
		actor.startPos.z + actor.velocity.z * t,
	);
}

// ─── Subtitle overlay ─────────────────────────────────────────────────────────

function createSubtitle(): { show: (text: string, duration: number) => void; dispose: () => void } {
	const el = document.createElement("div");
	el.style.cssText = [
		"position:fixed;bottom:10%;left:50%;transform:translateX(-50%);",
		"color:#fff;font-size:1.3rem;text-align:center;",
		"text-shadow:0 2px 6px #000,0 0 20px #000;",
		"font-family:'Segoe UI',sans-serif;pointer-events:none;",
		"max-width:80vw;z-index:50;opacity:0;transition:opacity 0.4s;",
	].join("");
	document.body.appendChild(el);

	let timer: ReturnType<typeof setTimeout> | undefined;

	return {
		show(text, duration) {
			if (timer) clearTimeout(timer);
			el.textContent = text;
			el.style.opacity = "1";
			timer = setTimeout(() => { el.style.opacity = "0"; }, duration * 1000 - 400);
		},
		dispose() {
			if (timer) clearTimeout(timer);
			el.remove();
		},
	};
}

// ─── Controller ───────────────────────────────────────────────────────────────

export class GateRoomCinematicController {
	private elapsed = 0;
	private disposed = false;
	private shakeIntensity = 0;
	private readonly shakeOffset = new THREE.Vector3();
	private flickerActive = false;
	private kawooshDisc: THREE.Mesh | undefined;
	private kawooshElapsed = 0;
	private kawooshDone = false;
	private eventHorizon: THREE.Mesh | undefined;
	private subtitle = createSubtitle();
	private subtitleShown = new Set<string>();
	private thrownActors: ThrownActor[] = [];
	private crewLoaded = false;
	private rushNpc: CharacterLoadResult | undefined;
	private scottNpc: CharacterLoadResult | undefined;
	private youngNpc: CharacterLoadResult | undefined;
	private camera: THREE.PerspectiveCamera;
	private scene: THREE.Scene;
	private readonly onComplete: () => void;

	constructor(
		scene: THREE.Scene,
		camera: THREE.PerspectiveCamera,
		onComplete: () => void,
	) {
		this.scene = scene;
		this.camera = camera;
		this.onComplete = onComplete;
		this.buildKawoosh();
		this.loadCrew();
	}

	// ── Kawoosh effect ────────────────────────────────────────────────────────

	private buildKawoosh() {
		// Expanding disc (additive blue)
		const discGeo  = new THREE.CircleGeometry(1, 64);
		const discMat  = new THREE.MeshBasicMaterial({
			color: 0x2266ff, transparent: true, opacity: 0.85,
			blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
		});
		this.kawooshDisc = new THREE.Mesh(discGeo, discMat);
		this.kawooshDisc.position.copy(GATE_CENTER);
		this.kawooshDisc.scale.setScalar(0);
		this.kawooshDisc.visible = false;
		this.scene.add(this.kawooshDisc);

		// Stable event horizon (shown after kawoosh)
		const horizonGeo = new THREE.CircleGeometry(2.55, 64);
		const horizonMat = new THREE.MeshStandardMaterial({
			color: 0x224488, emissive: 0x112244, emissiveIntensity: 1.5,
			transparent: true, opacity: 0.7, side: THREE.DoubleSide,
		});
		this.eventHorizon = new THREE.Mesh(horizonGeo, horizonMat);
		this.eventHorizon.position.copy(GATE_CENTER);
		this.eventHorizon.visible = false;
		this.scene.add(this.eventHorizon);
	}

	private updateKawoosh(delta: number, globalElapsed: number) {
		if (this.kawooshDone) {
			// Flicker at Beat 8 (t≈27-29)
			if (globalElapsed >= 27 && globalElapsed <= 29) {
				const flicker = Math.random() > 0.7;
				if (this.eventHorizon) this.eventHorizon.visible = flicker;
				this.flickerActive = true;
			} else if (this.flickerActive && globalElapsed > 29) {
				this.flickerActive = false;
				if (this.eventHorizon) this.eventHorizon.visible = false;
			}
			return;
		}

		if (globalElapsed < 4) return;  // Before Beat 2

		this.kawooshElapsed += delta;

		if (!this.kawooshDisc) return;

		if (this.kawooshElapsed <= 0.4) {
			// Expand 0 → 3.5 in 0.4s
			const s = (this.kawooshElapsed / 0.4) * 3.5;
			this.kawooshDisc.visible = true;
			this.kawooshDisc.scale.setScalar(s);
		} else {
			// Snap to stable event horizon
			this.kawooshDisc.visible = false;
			if (this.eventHorizon) {
				this.eventHorizon.visible = true;
			}
			this.kawooshDone = true;
		}
	}

	// ── Crew loading ──────────────────────────────────────────────────────────

	private async loadCrew() {
		try {
			const [scott, rush, young, tj, eli] = await Promise.allSettled([
				loadCrewMember("scott"),
				loadCrewMember("rush"),
				loadCrewMember("young"),
				loadCrewMember("tj"),
				loadCrewMember("eli"),
			]);

			if (scott.status === "fulfilled") {
				this.scottNpc = scott.value;
				this.scene.add(this.scottNpc.root);
				this.scottNpc.root.visible = false;
			}

			if (rush.status === "fulfilled") {
				// Rush is already in the scene as the main NPC — use cinematic
				// version separately positioned at the gate mouth for the throw
				this.rushNpc = rush.value;
				this.rushNpc.root.position.set(0.3, 3.2, 0.5);
				this.rushNpc.root.visible = false;
				this.scene.add(this.rushNpc.root);
			}

			if (young.status === "fulfilled") {
				this.youngNpc = young.value;
				this.scene.add(this.youngNpc.root);
				this.youngNpc.root.visible = false;
			}

			// Set up thrown actors once crew is loaded
			const actors: ThrownActor[] = [];

			if (scott.status === "fulfilled") {
				// Beat 3: Scott walks through at t=7, arrives at t=9
				actors.push(createThrownActor(
					scott.value,
					new THREE.Vector3(0, 3.2, 0.3),
					new THREE.Vector3(-0.3, -0.5, -4),
					0, 1.8,
					new THREE.Vector3(-0.5, 0.1, -7),
				));
			}

			if (rush.status === "fulfilled") {
				// Beat 6: Rush lands mostly clean at t=20
				actors.push(createThrownActor(
					rush.value,
					new THREE.Vector3(0.2, 3.2, 0.3),
					new THREE.Vector3(0.2, 0.2, -5),
					0, 1.2,
					new THREE.Vector3(0.3, 0.1, -6),
				));
			}

			if (tj.status === "fulfilled") {
				// Beat 7: TJ tumbles at t=23
				actors.push(createThrownActor(
					tj.value,
					new THREE.Vector3(-0.5, 3.2, 0.3),
					new THREE.Vector3(-1.2, 2.5, -8),
					0.3, 1.0,
					new THREE.Vector3(-1.8, 0.1, -8),
				));
			}

			if (eli.status === "fulfilled") {
				// Beat 7: Eli tumbles (NPC version — player Eli is prone on ground)
				actors.push(createThrownActor(
					eli.value,
					new THREE.Vector3(0.4, 3.2, 0.3),
					new THREE.Vector3(0.9, 3.0, -7),
					0.6, 1.1,
					new THREE.Vector3(1.2, 0.1, -7),
				));
				this.scene.add(eli.value.root);
			}

			if (young.status === "fulfilled") {
				// Beat 8: Young high-speed, hits far wall unconscious
				actors.push(createThrownActor(
					young.value,
					new THREE.Vector3(-0.2, 3.2, 0.3),
					new THREE.Vector3(-1.0, 1.5, -14),
					0, 0.7,
					new THREE.Vector3(-1.2, 0.1, -17),
				));
			}

			this.thrownActors = actors;
			this.crewLoaded = true;
		} catch (err) {
			console.warn("[Cinematic] Crew load error:", err);
			this.crewLoaded = true; // continue without crew
		}
	}

	// ── Camera ────────────────────────────────────────────────────────────────

	private applyCamera(elapsed: number) {
		// Find current beat
		const beat = BEATS.find(b => elapsed >= b.start && elapsed < b.end) ?? BEATS[BEATS.length - 1];
		const rawT = (elapsed - beat.start) / (beat.end - beat.start);
		const t = applyEasing(Math.min(1, Math.max(0, rawT)), beat.easing);

		const pos = new THREE.Vector3().lerpVectors(beat.camFrom, beat.camTo, t);

		// Camera shake
		if (this.shakeIntensity > 0.001) {
			this.shakeOffset.set(
				(Math.random() - 0.5) * this.shakeIntensity,
				(Math.random() - 0.5) * this.shakeIntensity,
				(Math.random() - 0.5) * this.shakeIntensity,
			);
			pos.add(this.shakeOffset);
			this.shakeIntensity *= Math.pow(0.85, 1 / 60);
		}

		this.camera.position.copy(pos);

		const lookAt = beat.lookAt instanceof THREE.Vector3 ? beat.lookAt : GATE_CENTER;
		this.camera.lookAt(lookAt);
	}

	// ── Subtitles ─────────────────────────────────────────────────────────────

	private updateSubtitles(elapsed: number) {
		if (elapsed >= 7 && elapsed < 9 && !this.subtitleShown.has("scott")) {
			this.subtitleShown.add("scott");
			this.subtitle.show("It's clear — start the evacuation", 3);
		}
		if (elapsed >= 34 && elapsed < 37 && !this.subtitleShown.has("eli-wake")) {
			this.subtitleShown.add("eli-wake");
			this.subtitle.show("Eli — where the hell are we?", 4);
		}
	}

	// ── Beat-triggered crew visibility ────────────────────────────────────────

	private updateCrew(elapsed: number) {
		if (!this.crewLoaded) return;

		// Scott visible from Beat 3 onwards
		if (this.scottNpc && elapsed >= 7) {
			this.scottNpc.root.visible = true;
		}
		// Rush cinematic NPC visible Beat 6
		if (this.rushNpc && elapsed >= 20 && elapsed < 23) {
			this.rushNpc.root.visible = true;
		}

		// Thrown actors: Beat 4 (chaos) t=11-16, Beat 7 (Eli/TJ) t=23-26, Beat 8 (Young) t=26-31
		const beatElapsed: Record<string, number> = {
			beat4: Math.max(0, elapsed - 11),
			beat7: Math.max(0, elapsed - 23),
			beat8: Math.max(0, elapsed - 26),
		};

		this.thrownActors.forEach((actor, idx) => {
			// Map actors to beats by index (order set in loadCrew):
			// 0=scott(beat3), 1=rush(beat6), 2=tj(beat7), 3=eli(beat7), 4=young(beat8)
			const beatE =
				idx === 0 ? Math.max(0, elapsed - 7) :
				idx === 1 ? Math.max(0, elapsed - 20) :
				idx === 2 || idx === 3 ? beatElapsed.beat7 :
				beatElapsed.beat8;
			updateThrown(actor, beatE);
		});

		// Shake on first landing in Beat 4
		if (elapsed >= 12 && elapsed < 13 && this.shakeIntensity < 0.05) {
			this.shakeIntensity = 0.25;
		}
		// Shake on Young hitting wall in Beat 8
		if (elapsed >= 27 && elapsed < 27.5 && this.shakeIntensity < 0.05) {
			this.shakeIntensity = 0.35;
		}
	}

	// ── Public update — called each frame from gate-room ─────────────────────

	update(delta: number) {
		if (this.disposed) return;

		this.elapsed += delta;
		this.applyCamera(this.elapsed);
		this.updateKawoosh(delta, this.elapsed);
		this.updateCrew(this.elapsed);
		this.updateSubtitles(this.elapsed);

		// VRM spring-bone updates
		this.thrownActors.forEach(a => a.char.update?.(delta));
		this.rushNpc?.update?.(delta);
		this.scottNpc?.update?.(delta);
		this.youngNpc?.update?.(delta);

		if (this.elapsed >= TOTAL_DURATION && !this.disposed) {
			this.dispose();
			this.onComplete();
		}
	}

	// ── Cleanup ───────────────────────────────────────────────────────────────

	dispose() {
		if (this.disposed) return;
		this.disposed = true;
		this.subtitle.dispose();
		if (this.kawooshDisc) { this.scene.remove(this.kawooshDisc); this.kawooshDisc = undefined; }
		if (this.eventHorizon) { this.scene.remove(this.eventHorizon); this.eventHorizon = undefined; }
		[this.scottNpc, this.rushNpc, this.youngNpc].forEach(c => {
			if (c) this.scene.remove(c.root);
		});
		this.thrownActors.forEach(a => this.scene.remove(a.char.root));
		this.thrownActors = [];
	}
}
