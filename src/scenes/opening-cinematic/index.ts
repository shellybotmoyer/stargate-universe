/**
 * Opening Cinematic — SGU Season 1 Episode 1 "Air"
 *
 * Six-beat scripted sequence:
 *   1. Gate activation: POV approaching the active Stargate (blue event horizon).
 *   2. Violent arrival: flung out of gate onto dark ancient ship corridor.
 *   3. Rush breaks away: stands up first, walks away alone.
 *   4. Following Rush: through winding dark corridors.
 *   5. Observation deck reveal: enormous curved FTL window, ship prow visible.
 *   6. Player arrives: HUD + quest marker fade in. Game begins.
 *
 * @see design/gdd/game-concept.md
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface CinematicBeat {
	startTime: number;
	duration: number;
	cameraFrom: THREE.Vector3;
	cameraTo: THREE.Vector3;
	lookAt: THREE.Vector3 | "player" | "rush";
	easing: "linear" | "ease-in" | "ease-out" | "ease-in-out";
}

// ─── Scene palette ────────────────────────────────────────────────────────────

const COLOR_ANCIENT_METAL   = 0x1a1a2e;
const COLOR_EMERGENCY_RED   = 0xff2200;
const COLOR_ANCIENT_GLOW    = 0x4488ff;
const COLOR_GATE_HORIZON    = 0x88bbff;
const COLOR_SKIN            = 0xd4926a;
const COLOR_DARK_WALL       = 0x0d0d1a;
const COLOR_FLOOR           = 0x0a0a14;

// ─── World-space layout ───────────────────────────────────────────────────────
//
//  +Z  → toward player start / gate front face
//  -Z  → deeper into Destiny
//
//  Gate center:         (0, 3.2, 0)
//  Arrival corridor:    z = -15 … +10   (group offset z = 0)
//  Linking tunnel:      z = -20 … -28   (group offset z = -24)
//  Observation deck:    z = -38 … -52   (group offset z = -45)
//  FTL field origin:    z = -60 (particles radiate outward from there)

const GATE_CENTER        = new THREE.Vector3(0, 3.2,   0);
const OBS_WINDOW_WORLD   = new THREE.Vector3(0, 3.5, -51);
const RUSH_FINAL_WP      = new THREE.Vector3(0, 0,   -51);

// ─── Cinematic beats ──────────────────────────────────────────────────────────

const BEATS: CinematicBeat[] = [
	// 0: Gate approach — rushing toward active Stargate
	{
		startTime: 0,
		duration: 4,
		cameraFrom: new THREE.Vector3(0, 1.7,  20),
		cameraTo:   new THREE.Vector3(0, 1.7,   3),
		lookAt: GATE_CENTER,
		easing: "ease-in",
	},
	// 1: Rush into gate — speed into event horizon
	{
		startTime: 4,
		duration: 1.5,
		cameraFrom: new THREE.Vector3(0, 1.7,   3),
		cameraTo:   new THREE.Vector3(0, 1.7,  -0.5),
		lookAt: GATE_CENTER,
		easing: "ease-in",
	},
	// 2: Violent arrival — camera tumbles in dark corridor
	{
		startTime: 5.5,
		duration: 4,
		cameraFrom: new THREE.Vector3( 3, 4,  6),
		cameraTo:   new THREE.Vector3( 1, 1.1, 2),
		lookAt: new THREE.Vector3(-1, 0.6, 0),
		easing: "ease-out",
	},
	// 3: Rush stands up and begins walking away
	{
		startTime: 9.5,
		duration: 5,
		cameraFrom: new THREE.Vector3( 2, 1.4,  3),
		cameraTo:   new THREE.Vector3( 1.5, 1.6, -5),
		lookAt: "rush",
		easing: "ease-in-out",
	},
	// 4: Following Rush through winding corridors
	{
		startTime: 14.5,
		duration: 9,
		cameraFrom: new THREE.Vector3( 0.5, 1.7,  -6),
		cameraTo:   new THREE.Vector3( 0.5, 1.7, -22),
		lookAt: "rush",
		easing: "linear",
	},
	// 5: Observation deck — wide reveal shot
	{
		startTime: 23.5,
		duration: 4.5,
		cameraFrom: new THREE.Vector3( 6,  3.5, -35),
		cameraTo:   new THREE.Vector3( 4,  2.8, -40),
		lookAt: OBS_WINDOW_WORLD,
		easing: "ease-out",
	},
	// 6: Settle behind Rush at the window — game begins
	{
		startTime: 28,
		duration: 6,
		cameraFrom: new THREE.Vector3( 4,  2.8, -40),
		cameraTo:   new THREE.Vector3( 0.8, 1.8, -46),
		lookAt: "rush",
		easing: "ease-in-out",
	},
];

const CINEMATIC_TOTAL_DURATION = 36;
const HUD_FADE_IN_START        = 30;
const HUD_FADE_IN_DURATION     = 4;
const SKIP_FADE_DURATION       = 0.6;

// ─── Easing ───────────────────────────────────────────────────────────────────

const easeFns: Record<CinematicBeat["easing"], (t: number) => number> = {
	"linear":       (t) => t,
	"ease-in":      (t) => t * t,
	"ease-out":     (t) => 1 - (1 - t) * (1 - t),
	"ease-in-out":  (t) => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2,
};

// ─── FTL warp particle system ─────────────────────────────────────────────────
//
//  ~2000 line-segment streak pairs. Each pair = (start, end) 3-component.
//  Blue-white colors. Particles move in +Z (past camera) and wrap.

const STREAK_COUNT        = 1000;   // 2000 total points
const STREAK_FIELD_RADIUS = 28;
const STREAK_FIELD_DEPTH  = 180;

interface FTLSystem {
	group: THREE.Group;
	lines: THREE.LineSegments;
	posArray: Float32Array;
	velZ: Float32Array;
	dispose: () => void;
}

const createFTLSystem = (scene: THREE.Scene): FTLSystem => {
	const group = new THREE.Group();
	// Positioned so the field extends well ahead and behind the obs deck window
	group.position.set(0, 3, -60);

	const posArray  = new Float32Array(STREAK_COUNT * 6);   // 2 pts × 3 floats
	const colArray  = new Float32Array(STREAK_COUNT * 6);
	const velZ      = new Float32Array(STREAK_COUNT);

	for (let i = 0; i < STREAK_COUNT; i++) {
		const angle  = Math.random() * Math.PI * 2;
		const radius = Math.sqrt(Math.random()) * STREAK_FIELD_RADIUS;
		const x      = Math.cos(angle) * radius;
		const y      = Math.sin(angle) * radius;
		const z      = (Math.random() - 0.5) * STREAK_FIELD_DEPTH;

		// Streak length proportional to speed (depth-of-field feel)
		const speed     = 60 + Math.random() * 80;
		const streakLen = 0.3 + (speed / 140) * 3.5;

		posArray[i * 6 + 0] = x;
		posArray[i * 6 + 1] = y;
		posArray[i * 6 + 2] = z;
		posArray[i * 6 + 3] = x;
		posArray[i * 6 + 4] = y;
		posArray[i * 6 + 5] = z + streakLen;

		velZ[i] = speed;

		// White → blue gradient: outer particles more blue
		const normalizedR = radius / STREAK_FIELD_RADIUS;
		const brightness  = 0.6 + Math.random() * 0.4;
		const blueBoost   = 0.7 + normalizedR * 0.3;
		for (let v = 0; v < 2; v++) {
			colArray[i * 6 + v * 3 + 0] = brightness * (1 - normalizedR * 0.3);
			colArray[i * 6 + v * 3 + 1] = brightness * 0.85;
			colArray[i * 6 + v * 3 + 2] = brightness * blueBoost;
		}
	}

	const geo = new THREE.BufferGeometry();
	geo.setAttribute("position", new THREE.BufferAttribute(posArray, 3));
	geo.setAttribute("color",    new THREE.BufferAttribute(colArray, 3));

	const mat  = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 });
	const lines = new THREE.LineSegments(geo, mat);
	group.add(lines);
	scene.add(group);

	return {
		group,
		lines,
		posArray,
		velZ,
		dispose: () => {
			geo.dispose();
			mat.dispose();
			scene.remove(group);
		},
	};
};

const updateFTLSystem = (ftl: FTLSystem, delta: number, worldCamZ: number): void => {
	const pos  = ftl.posArray;
	const attr = ftl.lines.geometry.getAttribute("position") as THREE.BufferAttribute;
	const groupZ = ftl.group.position.z;

	for (let i = 0; i < STREAK_COUNT; i++) {
		const dz = ftl.velZ[i] * delta;
		pos[i * 6 + 2] += dz;
		pos[i * 6 + 5] += dz;

		// Wrap: when world-Z of start point passes camera, reset far back
		const worldZ = pos[i * 6 + 2] + groupZ;
		if (worldZ > worldCamZ + 15) {
			const newLocalZ  = pos[i * 6 + 2] - STREAK_FIELD_DEPTH;
			const streakLen  = pos[i * 6 + 5] - pos[i * 6 + 2];
			pos[i * 6 + 2]   = newLocalZ;
			pos[i * 6 + 5]   = newLocalZ + streakLen;
		}
	}

	attr.needsUpdate = true;
};

// ─── Gate entrance (approach area) ───────────────────────────────────────────

interface GateEntrance {
	group: THREE.Group;
	eventHorizon: THREE.Mesh;
	gateLight: THREE.PointLight;
	dispose: () => void;
}

const buildGateEntrance = (scene: THREE.Scene): GateEntrance => {
	const group    = new THREE.Group();
	const mats: THREE.Material[] = [];

	const metalMat = new THREE.MeshStandardMaterial({
		color: 0x2a2a3a,
		roughness: 0.3,
		metalness: 0.85,
		emissive: 0x111122,
		emissiveIntensity: 0.4,
	});
	mats.push(metalMat);

	// ── Stargate ring ────────────────────────────────────────────────────────
	const outerRing = new THREE.Mesh(
		new THREE.TorusGeometry(2.8, 0.28, 20, 80),
		metalMat,
	);
	outerRing.position.copy(GATE_CENTER);
	group.add(outerRing);

	// Inner spinning ring
	const innerRingMat = new THREE.MeshStandardMaterial({
		color: 0x1a1a30,
		roughness: 0.2,
		metalness: 0.92,
		emissive: COLOR_ANCIENT_GLOW,
		emissiveIntensity: 0.5,
	});
	mats.push(innerRingMat);
	const innerRing = new THREE.Mesh(
		new THREE.TorusGeometry(2.6, 0.14, 12, 60),
		innerRingMat,
	);
	innerRing.position.copy(GATE_CENTER);
	group.add(innerRing);

	// Segment bumps around outer ring (SGU aesthetic)
	const segMat = new THREE.MeshStandardMaterial({ color: 0x333348, roughness: 0.35, metalness: 0.8 });
	mats.push(segMat);
	for (let i = 0; i < 36; i++) {
		const angle = (i / 36) * Math.PI * 2;
		const seg   = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.1), segMat);
		seg.position.set(
			GATE_CENTER.x + Math.cos(angle) * 3.0,
			GATE_CENTER.y + Math.sin(angle) * 3.0,
			GATE_CENTER.z + 0.05,
		);
		seg.lookAt(
			GATE_CENTER.x + Math.cos(angle) * 5,
			GATE_CENTER.y + Math.sin(angle) * 5,
			GATE_CENTER.z + 0.05,
		);
		group.add(seg);
	}

	// ── Active event horizon ─────────────────────────────────────────────────
	const horizonMat = new THREE.MeshStandardMaterial({
		color: COLOR_GATE_HORIZON,
		emissive: COLOR_GATE_HORIZON,
		emissiveIntensity: 1.5,
		transparent: true,
		opacity: 0.88,
		side: THREE.DoubleSide,
		roughness: 0.05,
		metalness: 0,
	});
	mats.push(horizonMat);
	const eventHorizon = new THREE.Mesh(new THREE.CircleGeometry(2.55, 64), horizonMat);
	eventHorizon.position.set(GATE_CENTER.x, GATE_CENTER.y, GATE_CENTER.z + 0.05);
	group.add(eventHorizon);

	// ── Approach corridor walls / floor ──────────────────────────────────────
	const wallMat  = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.9, metalness: 0.1, side: THREE.DoubleSide });
	const floorMat = new THREE.MeshStandardMaterial({ color: 0x12121f, roughness: 0.9, metalness: 0.2 });
	mats.push(wallMat, floorMat);

	const floor = new THREE.Mesh(new THREE.BoxGeometry(12, 0.2, 35), floorMat);
	floor.position.set(0, -0.1, 10);
	group.add(floor);

	const ceiling = new THREE.Mesh(new THREE.BoxGeometry(12, 0.2, 35), wallMat);
	ceiling.position.set(0, 6, 10);
	group.add(ceiling);

	for (const side of [-1, 1]) {
		const wall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 6, 35), wallMat.clone());
		wall.position.set(side * 6, 3, 10);
		group.add(wall);
	}

	// Back wall behind gate
	const backWall = new THREE.Mesh(new THREE.BoxGeometry(12, 9, 0.3), wallMat.clone());
	backWall.position.set(0, 4.5, -8);
	group.add(backWall);

	// Structural arch columns flanking gate
	const archMat = new THREE.MeshStandardMaterial({ color: 0x15152a, roughness: 0.8, metalness: 0.3 });
	mats.push(archMat);
	for (const side of [-1, 1]) {
		const col = new THREE.Mesh(new THREE.BoxGeometry(0.9, 8, 0.7), archMat);
		col.position.set(side * 4.5, 4, -0.3);
		group.add(col);
	}
	const topBeam = new THREE.Mesh(new THREE.BoxGeometry(10, 0.7, 0.7), archMat);
	topBeam.position.set(0, 7.5, -0.3);
	group.add(topBeam);

	// Amber floor guide strips
	const stripMat = new THREE.MeshStandardMaterial({
		color: 0xddaa33, emissive: 0xddaa33, emissiveIntensity: 0.4, roughness: 0.6,
	});
	mats.push(stripMat);
	for (let z = 20; z >= -5; z -= 1.4) {
		for (const x of [-1.5, 1.5]) {
			const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.5), stripMat);
			strip.position.set(x, 0.01, z);
			group.add(strip);
		}
	}

	// Gate blue light
	const gateLight = new THREE.PointLight(COLOR_ANCIENT_GLOW, 300, 25, 1.5);
	gateLight.position.set(0, 3.2, 4);
	group.add(gateLight);

	// Back-of-gate light
	const backLight = new THREE.PointLight(0x3366cc, 150, 20, 1.5);
	backLight.position.set(0, 3.2, -3);
	group.add(backLight);

	scene.add(group);

	return {
		group,
		eventHorizon,
		gateLight,
		dispose: () => {
			scene.remove(group);
			for (const m of mats) m.dispose();
		},
	};
};

// ─── Arrival corridor (dark, violent, emergency lighting) ─────────────────────

interface ArrivalCorridor {
	group: THREE.Group;
	emergencyLights: THREE.PointLight[];
	sparkingPanels: THREE.Mesh[];
	crewNpcs: THREE.Mesh[];
	dispose: () => void;
}

const buildArrivalCorridor = (scene: THREE.Scene): ArrivalCorridor => {
	const group  = new THREE.Group();
	const mats: THREE.Material[] = [];

	const CORR_W   = 5;
	const CORR_H   = 4.2;
	const CORR_LEN = 36;

	const wallMat = new THREE.MeshStandardMaterial({
		color: COLOR_DARK_WALL, roughness: 0.95, metalness: 0.05, side: THREE.DoubleSide,
	});
	const floorMat = new THREE.MeshStandardMaterial({
		color: COLOR_FLOOR, roughness: 0.9, metalness: 0.2,
	});
	const ceilMat = new THREE.MeshStandardMaterial({
		color: 0x080810, roughness: 0.98, metalness: 0.02,
	});
	mats.push(wallMat, floorMat, ceilMat);

	// Floor / ceiling / walls
	const floor = new THREE.Mesh(new THREE.BoxGeometry(CORR_W, 0.2, CORR_LEN), floorMat);
	floor.position.set(0, -0.1, 0);
	group.add(floor);

	const ceiling = new THREE.Mesh(new THREE.BoxGeometry(CORR_W, 0.2, CORR_LEN), ceilMat);
	ceiling.position.set(0, CORR_H, 0);
	group.add(ceiling);

	for (const side of [-1, 1]) {
		const wall = new THREE.Mesh(new THREE.BoxGeometry(0.2, CORR_H, CORR_LEN), wallMat.clone());
		wall.position.set(side * (CORR_W / 2), CORR_H / 2, 0);
		mats.push(wall.material as THREE.Material);
		group.add(wall);
	}

	// Back wall at far end
	const backWall = new THREE.Mesh(new THREE.BoxGeometry(CORR_W, CORR_H, 0.2), wallMat.clone());
	backWall.position.set(0, CORR_H / 2, -CORR_LEN / 2);
	mats.push(backWall.material as THREE.Material);
	group.add(backWall);

	// Structural ribs across ceiling (Destiny aesthetic)
	const ribMat = new THREE.MeshStandardMaterial({ color: 0x141428, roughness: 0.7, metalness: 0.5 });
	mats.push(ribMat);
	for (let z = -14; z <= 14; z += 5) {
		const rib = new THREE.Mesh(new THREE.BoxGeometry(CORR_W + 0.1, 0.35, 0.3), ribMat);
		rib.position.set(0, CORR_H - 0.15, z);
		group.add(rib);
	}

	// ── Emergency lighting ────────────────────────────────────────────────────
	const emergencyMat = new THREE.MeshStandardMaterial({
		color: COLOR_EMERGENCY_RED, emissive: COLOR_EMERGENCY_RED, emissiveIntensity: 1.8,
	});
	mats.push(emergencyMat);

	for (let z = -12; z <= 12; z += 4) {
		for (const side of [-1, 1]) {
			const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.7), emergencyMat);
			strip.position.set(side * (CORR_W / 2 - 0.15), 0.28, z);
			group.add(strip);
		}
	}

	const emergencyLights: THREE.PointLight[] = [];
	for (let z = -10; z <= 10; z += 10) {
		const light = new THREE.PointLight(COLOR_EMERGENCY_RED, 55, 9, 1.5);
		light.position.set(0, 1.2, z);
		group.add(light);
		emergencyLights.push(light);
	}

	// ── Damaged / sparking panels ─────────────────────────────────────────────
	const damagedMat = new THREE.MeshStandardMaterial({
		color: 0x333344, emissive: 0x334466, emissiveIntensity: 0.3, roughness: 0.5, metalness: 0.7,
	});
	mats.push(damagedMat);
	const sparkingPanels: THREE.Mesh[] = [];

	const panelPositions = [
		[-1, 1],  [1, 3],  [-1, -2],
		[ 1, -5], [-1, 6], [ 1, -8],
	];
	for (const [side, z] of panelPositions) {
		const panel = new THREE.Mesh(
			new THREE.BoxGeometry(0.06, 0.7, 0.9),
			(damagedMat.clone() as THREE.MeshStandardMaterial),
		);
		panel.position.set(side * (CORR_W / 2 - 0.1), 1.5 + Math.random() * 1.0, z);
		mats.push(panel.material as THREE.Material);
		group.add(panel);
		sparkingPanels.push(panel);
	}

	// ── Crew NPCs scattered on floor ──────────────────────────────────────────
	const crewDefs = [
		{ name: "Young",  pos: new THREE.Vector3(-1.2, 0.3,  2.5), rotZ:  1.1, rotY: 0.3  },
		{ name: "Scott",  pos: new THREE.Vector3( 1.4, 0.3,  0.8), rotZ: -0.8, rotY: 1.2  },
		{ name: "Greer",  pos: new THREE.Vector3(-0.4, 0.3, -1.5), rotZ:  0.9, rotY: 2.1  },
		{ name: "Chloe",  pos: new THREE.Vector3( 0.9, 0.3,  3.5), rotZ: -1.2, rotY: 0.7  },
		{ name: "TJ",     pos: new THREE.Vector3(-1.7, 0.3,  1.2), rotZ:  1.0, rotY: 1.8  },
		{ name: "Eli",    pos: new THREE.Vector3( 0.2, 0.3, -2.5), rotZ: -0.7, rotY: 2.8  },
	];

	const crewBodyMat = new THREE.MeshStandardMaterial({ color: 0x22222e, roughness: 0.7, metalness: 0.1 });
	const crewHeadMat = new THREE.MeshStandardMaterial({ color: COLOR_SKIN, roughness: 0.75, metalness: 0 });
	mats.push(crewBodyMat, crewHeadMat);

	const crewNpcs: THREE.Mesh[] = [];
	for (const def of crewDefs) {
		const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.15, 8), crewBodyMat);
		body.position.copy(def.pos);
		body.rotation.z = def.rotZ;
		body.rotation.y = def.rotY;
		body.userData = { crewName: def.name };
		group.add(body);

		// Head
		const headOffset = new THREE.Vector3(0.62, 0, 0);
		headOffset.applyEuler(body.rotation);
		const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), crewHeadMat);
		head.position.copy(def.pos).add(headOffset);
		group.add(head);

		crewNpcs.push(body);
	}

	scene.add(group);

	return {
		group,
		emergencyLights,
		sparkingPanels,
		crewNpcs,
		dispose: () => {
			scene.remove(group);
			for (const m of mats) m.dispose();
		},
	};
};

// ─── Dr. Rush NPC ─────────────────────────────────────────────────────────────

// Scripted path through ship (world coordinates)
const RUSH_WAYPOINTS: THREE.Vector3[] = [
	new THREE.Vector3( 0,   0,   1),    // floor of arrival corridor
	new THREE.Vector3( 0,   0,  -5),    // corridor walk
	new THREE.Vector3( 0,   0, -12),    // junction
	new THREE.Vector3( 1.5, 0, -20),    // corridor B (slight offset)
	new THREE.Vector3( 0,   0, -30),    // linking tunnel
	RUSH_FINAL_WP.clone(),              // observation deck — window center
];

interface RushNpc {
	group: THREE.Group;
	innerRing: THREE.Mesh | null;
	waypointIndex: number;
	isStanding: boolean;
	standProgress: number;
	walkCycle: number;
	dispose: () => void;
}

const createRushNpc = (scene: THREE.Scene): RushNpc => {
	const group = new THREE.Group();
	const mats: THREE.Material[] = [];

	const bodyMat  = new THREE.MeshStandardMaterial({ color: 0x1a1a2a, roughness: 0.7, metalness: 0.1 });
	const greyMat  = new THREE.MeshStandardMaterial({ color: 0x777788, roughness: 0.8, metalness: 0.05 });
	const headMat  = new THREE.MeshStandardMaterial({ color: COLOR_SKIN, roughness: 0.75, metalness: 0 });
	const hairMat  = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, roughness: 0.95, metalness: 0 });
	mats.push(bodyMat, greyMat, headMat, hairMat);

	// Legs
	for (const side of [-1, 1]) {
		const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.85, 6), bodyMat);
		leg.position.set(side * 0.14, 0.43, 0);
		group.add(leg);
	}
	// Torso / jacket
	const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.65, 0.28), greyMat);
	torso.position.set(0, 1.05, 0);
	group.add(torso);
	// Dark underlayer
	const under = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.55, 0.3), bodyMat);
	under.position.set(0, 1.05, 0);
	group.add(under);
	// Arms
	for (const side of [-1, 1]) {
		const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.6, 6), greyMat);
		arm.position.set(side * 0.32, 1.0, 0);
		arm.rotation.z = side * (Math.PI / 10);
		group.add(arm);
	}
	// Neck
	const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.18, 6), headMat);
	neck.position.set(0, 1.46, 0);
	group.add(neck);
	// Head
	const head = new THREE.Mesh(new THREE.SphereGeometry(0.185, 10, 8), headMat);
	head.position.set(0, 1.7, 0);
	group.add(head);
	// Wild grey hair (Rush's signature dishevelled look)
	const hair = new THREE.Mesh(
		new THREE.SphereGeometry(0.21, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
		hairMat,
	);
	hair.position.set(0, 1.74, 0);
	group.add(hair);
	// Beard shadow
	const beardMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9, metalness: 0 });
	mats.push(beardMat);
	const beard = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), beardMat);
	beard.scale.set(1.5, 0.7, 0.8);
	beard.position.set(0, 1.6, 0.12);
	group.add(beard);

	// Rush starts lying on floor next to other crew
	group.position.set(1.2, -0.35, 1.5);
	group.rotation.z = Math.PI / 2;

	scene.add(group);

	return {
		group,
		innerRing: null,
		waypointIndex: 0,
		isStanding: false,
		standProgress: 0,
		walkCycle: 0,
		dispose: () => {
			scene.remove(group);
			for (const m of mats) m.dispose();
		},
	};
};

const updateRushNpc = (rush: RushNpc, delta: number, t: number): void => {
	// Phase A: Stand up (9.5s → 12.5s)
	if (t >= 9.5 && !rush.isStanding) {
		rush.standProgress = Math.min(1, rush.standProgress + delta * (1 / 3));
		rush.group.rotation.z = (Math.PI / 2) * (1 - rush.standProgress);
		rush.group.position.y  = -0.35 * (1 - rush.standProgress);
		if (rush.standProgress >= 1) {
			rush.isStanding       = true;
			rush.group.rotation.z = 0;
			rush.group.position.y = 0;
		}
	}

	// Phase B: Walk toward window (starts ~12.5s)
	if (t >= 12.5 && rush.isStanding) {
		const nextWp = RUSH_WAYPOINTS[rush.waypointIndex + 1];
		if (!nextWp) return;

		const pos = rush.group.position;
		const dx  = nextWp.x - pos.x;
		const dz  = nextWp.z - pos.z;
		const dist = Math.sqrt(dx * dx + dz * dz);

		if (dist < 0.3 && rush.waypointIndex < RUSH_WAYPOINTS.length - 2) {
			rush.waypointIndex++;
		} else if (dist > 0.05) {
			const spd = 1.7 * delta;
			pos.x += (dx / dist) * spd;
			pos.z += (dz / dist) * spd;

			// Face direction of travel
			rush.group.rotation.y = Math.atan2(dx, dz);

			// Subtle body bob while walking
			rush.walkCycle += delta * 4.2;
			rush.group.position.y = Math.abs(Math.sin(rush.walkCycle)) * 0.045;

			// Slight arm swing (rotate whole group slightly)
			rush.group.rotation.x = Math.sin(rush.walkCycle) * 0.04;
		}
	}
};

// ─── Linking tunnel (connects arrival corridor to obs deck) ───────────────────

const buildLinkingTunnel = (scene: THREE.Scene): { group: THREE.Group; dispose: () => void } => {
	const group = new THREE.Group();
	group.position.set(0, 0, -24);

	const mats: THREE.Material[] = [];
	const TUNNEL_W = 3.6;
	const TUNNEL_H = 3.8;
	const TUNNEL_L = 16;

	const wallMat = new THREE.MeshStandardMaterial({ color: 0x0a0a16, roughness: 0.96, metalness: 0.06, side: THREE.DoubleSide });
	const floorMat = new THREE.MeshStandardMaterial({ color: 0x080810, roughness: 0.9, metalness: 0.2 });
	mats.push(wallMat, floorMat);

	// Floor / ceiling
	const floor = new THREE.Mesh(new THREE.BoxGeometry(TUNNEL_W, 0.15, TUNNEL_L), floorMat);
	floor.position.set(0, -0.07, 0);
	group.add(floor);

	const ceiling = new THREE.Mesh(new THREE.BoxGeometry(TUNNEL_W, 0.15, TUNNEL_L), wallMat.clone());
	ceiling.position.set(0, TUNNEL_H, 0);
	mats.push(ceiling.material as THREE.Material);
	group.add(ceiling);

	for (const side of [-1, 1]) {
		const wall = new THREE.Mesh(new THREE.BoxGeometry(0.15, TUNNEL_H, TUNNEL_L), wallMat.clone());
		wall.position.set(side * (TUNNEL_W / 2), TUNNEL_H / 2, 0);
		mats.push(wall.material as THREE.Material);
		group.add(wall);
	}

	// Flickering tunnel light (low intensity — almost dark)
	const tunnelLight = new THREE.PointLight(0x2233aa, 35, 10, 2);
	tunnelLight.position.set(0, TUNNEL_H - 0.4, 0);
	group.add(tunnelLight);

	// Emergency floor strips
	const emergMat = new THREE.MeshStandardMaterial({
		color: COLOR_EMERGENCY_RED, emissive: COLOR_EMERGENCY_RED, emissiveIntensity: 0.9,
	});
	mats.push(emergMat);
	for (const side of [-1, 1]) {
		const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, TUNNEL_L - 0.5), emergMat);
		strip.position.set(side * (TUNNEL_W / 2 - 0.2), 0.03, 0);
		group.add(strip);
	}

	// Bent pipe / conduit along ceiling
	const pipeMat = new THREE.MeshStandardMaterial({ color: 0x111124, roughness: 0.6, metalness: 0.7 });
	mats.push(pipeMat);
	for (let z = -6; z <= 6; z += 3) {
		const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, TUNNEL_W * 0.9, 6), pipeMat);
		pipe.rotation.z = Math.PI / 2;
		pipe.position.set(0, TUNNEL_H - 0.25, z);
		group.add(pipe);
	}

	scene.add(group);
	return {
		group,
		dispose: () => {
			scene.remove(group);
			for (const m of mats) m.dispose();
		},
	};
};

// ─── Observation deck ─────────────────────────────────────────────────────────

interface ObservationDeck {
	group: THREE.Group;
	shipProw: THREE.Group;
	warpLight: THREE.PointLight;
	dispose: () => void;
}

const buildObservationDeck = (scene: THREE.Scene): ObservationDeck => {
	const group = new THREE.Group();
	// Group centered so window wall is at z = -7 (world z = -52)
	group.position.set(0, 0, -45);

	const mats: THREE.Material[] = [];
	const DECK_W = 18;
	const DECK_H = 7.5;
	const DECK_D = 14;

	const darkMat = new THREE.MeshStandardMaterial({ color: 0x080812, roughness: 0.95, metalness: 0.1, side: THREE.DoubleSide });
	const metalMat = new THREE.MeshStandardMaterial({ color: COLOR_ANCIENT_METAL, roughness: 0.45, metalness: 0.75 });
	mats.push(darkMat, metalMat);

	// Floor
	const floor = new THREE.Mesh(new THREE.BoxGeometry(DECK_W, 0.2, DECK_D), darkMat.clone() as THREE.Material);
	floor.position.set(0, -0.1, 0);
	mats.push(floor.material as THREE.Material);
	group.add(floor);

	// Ceiling
	const ceiling = new THREE.Mesh(new THREE.BoxGeometry(DECK_W, 0.2, DECK_D), darkMat.clone() as THREE.Material);
	ceiling.position.set(0, DECK_H, 0);
	mats.push(ceiling.material as THREE.Material);
	group.add(ceiling);

	// Side walls
	for (const side of [-1, 1]) {
		const wall = new THREE.Mesh(new THREE.BoxGeometry(0.2, DECK_H, DECK_D), darkMat.clone() as THREE.Material);
		wall.position.set(side * (DECK_W / 2), DECK_H / 2, 0);
		mats.push(wall.material as THREE.Material);
		group.add(wall);
	}

	// Back wall (entrance side)
	const backWall = new THREE.Mesh(new THREE.BoxGeometry(DECK_W, DECK_H, 0.2), darkMat.clone() as THREE.Material);
	backWall.position.set(0, DECK_H / 2, DECK_D / 2);
	mats.push(backWall.material as THREE.Material);
	group.add(backWall);

	// Door frame cut-out (visual only — door header/sides)
	const doorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a30, roughness: 0.5, metalness: 0.7 });
	mats.push(doorMat);
	// Door header
	const doorHeader = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.4, 0.3), doorMat);
	doorHeader.position.set(0, 2.8, DECK_D / 2);
	group.add(doorHeader);
	// Door sides
	for (const side of [-1, 1]) {
		const doorSide = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.8, 0.3), doorMat);
		doorSide.position.set(side * 1.45, 1.4, DECK_D / 2);
		group.add(doorSide);
	}

	// ── THE WINDOW — enormous curved forward observation window ───────────────
	//
	//  PlaneGeometry subdivided + gently curved for the "hull curve" feel.
	//  We use a wide plane with slight curvature via ShapeGeometry.
	const windowMat = new THREE.MeshStandardMaterial({
		color: 0x001833,
		emissive: 0x001122,
		emissiveIntensity: 0.15,
		transparent: true,
		opacity: 0.12,
		side: THREE.DoubleSide,
		roughness: 0.0,
		metalness: 0.0,
		depthWrite: false,
	});
	mats.push(windowMat);

	// Use a large plane as the glass pane (simple, clean)
	const windowGeo = new THREE.PlaneGeometry(DECK_W - 0.6, DECK_H - 0.6, 8, 4);
	const windowMesh = new THREE.Mesh(windowGeo, windowMat);
	windowMesh.position.set(0, DECK_H / 2, -DECK_D / 2 + 0.1);
	group.add(windowMesh);

	// Window frame — heavy structural border (Ancient construction)
	const frameMat = new THREE.MeshStandardMaterial({
		color: 0x16162a,
		roughness: 0.4,
		metalness: 0.85,
		emissive: 0x0a0a1c,
		emissiveIntensity: 0.5,
	});
	mats.push(frameMat);

	// Top + bottom bars
	for (const y of [DECK_H - 0.15, 0.15]) {
		const bar = new THREE.Mesh(new THREE.BoxGeometry(DECK_W, 0.35, 0.45), frameMat);
		bar.position.set(0, y, -DECK_D / 2 + 0.22);
		group.add(bar);
	}
	// Vertical dividers (4 columns across)
	for (let col = -2; col <= 2; col++) {
		const div = new THREE.Mesh(new THREE.BoxGeometry(0.28, DECK_H, 0.45), frameMat);
		div.position.set(col * (DECK_W / 4), DECK_H / 2, -DECK_D / 2 + 0.22);
		group.add(div);
	}
	// Corner pillars
	for (const side of [-1, 1]) {
		const col = new THREE.Mesh(new THREE.BoxGeometry(0.6, DECK_H, 0.5), frameMat);
		col.position.set(side * (DECK_W / 2 - 0.3), DECK_H / 2, -DECK_D / 2 + 0.25);
		group.add(col);
	}

	// Ancient glow strips along floor + ceiling edges
	const glowMat = new THREE.MeshStandardMaterial({
		color: COLOR_ANCIENT_GLOW, emissive: COLOR_ANCIENT_GLOW, emissiveIntensity: 0.5,
	});
	mats.push(glowMat);
	for (const y of [0.04, DECK_H - 0.04]) {
		const strip = new THREE.Mesh(new THREE.BoxGeometry(DECK_W - 0.3, 0.07, 0.07), glowMat);
		strip.position.set(0, y, -DECK_D / 2 + 0.5);
		group.add(strip);
	}

	// Decorative console / stand at center (near window for Rush to stand at)
	const consoleMat = new THREE.MeshStandardMaterial({ color: 0x111128, roughness: 0.5, metalness: 0.7 });
	mats.push(consoleMat);
	const stand = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.6), consoleMat);
	stand.position.set(0, 0.45, -DECK_D / 2 + 1.6);
	group.add(stand);

	const consoleSurface = new THREE.MeshStandardMaterial({
		color: 0x222240, emissive: 0x001133, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.5,
	});
	mats.push(consoleSurface);
	const consoleTop = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.55), consoleSurface);
	consoleTop.position.set(0, 0.93, -DECK_D / 2 + 1.6);
	group.add(consoleTop);

	// ── Warp light — blue FTL glow flooding in from window ────────────────────
	const warpLight = new THREE.PointLight(0x4488ff, 160, 45, 1.5);
	warpLight.position.set(0, DECK_H / 2, -DECK_D / 2);
	group.add(warpLight);

	// Blue ambient wash from below window
	const ambientStrip = new THREE.PointLight(0x3366dd, 90, 25, 1.8);
	ambientStrip.position.set(0, 0.5, -DECK_D / 2 + 1);
	group.add(ambientStrip);

	scene.add(group);

	// ── Ship prow — visible through window (in world space) ───────────────────
	//
	//  The Destiny's ancient hull section lit by the warp effect.

	const prowGroup = new THREE.Group();
	prowGroup.position.set(0, -3, -68);   // ahead through the window

	const prowMat = new THREE.MeshStandardMaterial({
		color: 0x0e0e20,
		roughness: 0.5,
		metalness: 0.8,
		emissive: 0x060614,
		emissiveIntensity: 0.6,
	});
	mats.push(prowMat);

	// Main elongated hull body
	const hull = new THREE.Mesh(new THREE.BoxGeometry(9, 2.5, 50), prowMat);
	hull.position.set(0, 0, -25);
	prowGroup.add(hull);

	// Hull ribbing (structural)
	for (let z = -10; z <= 10; z += 5) {
		const rib = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 0.5), prowMat);
		rib.position.set(0, 1.25, z);
		prowGroup.add(rib);
	}

	// Tapered prow cone
	const prowCone = new THREE.Mesh(new THREE.ConeGeometry(4.5, 14, 10), prowMat);
	prowCone.rotation.x = -Math.PI / 2;
	prowCone.position.set(0, 0, -55);
	prowGroup.add(prowCone);

	// Side nacelles
	for (const side of [-1, 1]) {
		const nacelle = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 30), prowMat);
		nacelle.position.set(side * 6.5, -0.5, -15);
		prowGroup.add(nacelle);

		// Engine glow ports
		const engineMat = new THREE.MeshStandardMaterial({
			color: 0x4466ff, emissive: 0x4466ff, emissiveIntensity: 1.4,
		});
		mats.push(engineMat);
		const engine = new THREE.Mesh(new THREE.CircleGeometry(0.55, 10), engineMat);
		engine.position.set(side * 6.5, -0.5, 2);
		engine.rotation.y = Math.PI;
		prowGroup.add(engine);

		// Engine light contribution
		const engLight = new THREE.PointLight(0x3344cc, 40, 15, 2);
		engLight.position.set(side * 6.5, -0.5, 2);
		prowGroup.add(engLight);
	}

	// FTL warp illumination on hull from the front (simulates light from ahead)
	const hullLight = new THREE.PointLight(0x6699ff, 60, 40, 1.5);
	hullLight.position.set(0, 5, 15);
	prowGroup.add(hullLight);

	scene.add(prowGroup);

	return {
		group,
		shipProw: prowGroup,
		warpLight,
		dispose: () => {
			scene.remove(group);
			scene.remove(prowGroup);
			for (const m of mats) m.dispose();
		},
	};
};

// ─── Cinematic UI overlays ────────────────────────────────────────────────────

interface CinematicUI {
	skipHint:    HTMLDivElement;
	hudOverlay:  HTMLDivElement;
	fadeOverlay: HTMLDivElement;
	questMarker: HTMLDivElement;
	dispose: () => void;
}

const createCinematicUI = (): CinematicUI => {
	// Skip hint (bottom-right)
	const skipHint = document.createElement("div");
	skipHint.id = "cinematic-skip";
	Object.assign(skipHint.style, {
		position: "fixed",
		bottom: "20px",
		right: "24px",
		color: "rgba(68, 136, 255, 0.55)",
		fontFamily: "'Courier New', monospace",
		fontSize: "13px",
		pointerEvents: "none",
		userSelect: "none",
		zIndex: "100",
		transition: "opacity 0.3s ease",
	});
	skipHint.textContent = "[Space]  Skip";
	document.body.appendChild(skipHint);

	// Full-screen flash / fade overlay
	const fadeOverlay = document.createElement("div");
	fadeOverlay.id = "cinematic-fade";
	Object.assign(fadeOverlay.style, {
		position: "fixed",
		inset: "0",
		background: "white",
		opacity: "0",
		pointerEvents: "none",
		zIndex: "50",
	});
	document.body.appendChild(fadeOverlay);

	// Game HUD — fades in at end of cinematic
	const hudOverlay = document.createElement("div");
	hudOverlay.id = "cinematic-hud";
	Object.assign(hudOverlay.style, {
		position: "fixed",
		inset: "0",
		opacity: "0",
		pointerEvents: "none",
		zIndex: "10",
		transition: "opacity 1.2s ease",
	});

	// Top label — ship ID / status
	const topBar = document.createElement("div");
	Object.assign(topBar.style, {
		position: "absolute",
		top: "14px",
		left: "50%",
		transform: "translateX(-50%)",
		color: "#4488ff",
		fontFamily: "'Courier New', monospace",
		fontSize: "13px",
		letterSpacing: "4px",
		textShadow: "0 0 12px #4488ff55",
		whiteSpace: "nowrap",
	});
	topBar.textContent = "DESTINY  ·  FTL TRANSIT  ·  DESTINATION UNKNOWN";
	hudOverlay.appendChild(topBar);

	// Divider line
	const topLine = document.createElement("div");
	Object.assign(topLine.style, {
		position: "absolute",
		top: "34px",
		left: "50%",
		transform: "translateX(-50%)",
		width: "380px",
		height: "1px",
		background: "rgba(68, 136, 255, 0.25)",
	});
	hudOverlay.appendChild(topLine);

	// Bottom control hints
	const bottomBar = document.createElement("div");
	Object.assign(bottomBar.style, {
		position: "absolute",
		bottom: "18px",
		left: "50%",
		transform: "translateX(-50%)",
		color: "rgba(68, 136, 255, 0.5)",
		fontFamily: "'Courier New', monospace",
		fontSize: "11px",
		letterSpacing: "2px",
		whiteSpace: "nowrap",
	});
	bottomBar.textContent = "WASD · MOVE     MOUSE · LOOK     E · INTERACT     ESC · MENU";
	hudOverlay.appendChild(bottomBar);

	document.body.appendChild(hudOverlay);

	// Quest marker (right-side panel, fades in last)
	const questMarker = document.createElement("div");
	questMarker.id = "cinematic-quest";
	Object.assign(questMarker.style, {
		position: "fixed",
		top: "50%",
		right: "28px",
		transform: "translateY(-50%)",
		color: "#ffaa44",
		fontFamily: "'Courier New', monospace",
		fontSize: "12px",
		lineHeight: "1.6",
		opacity: "0",
		pointerEvents: "none",
		zIndex: "10",
		textAlign: "right",
		textShadow: "0 0 8px rgba(255, 170, 68, 0.4)",
		transition: "opacity 1s ease",
		borderRight: "1px solid rgba(255, 170, 68, 0.35)",
		paddingRight: "12px",
	});
	questMarker.innerHTML =
		`<div style="letter-spacing:2px;margin-bottom:4px;">▸ NEW QUEST</div>` +
		`<div style="font-size:11px;opacity:0.85;">Air</div>` +
		`<div style="font-size:10px;opacity:0.6;margin-top:2px;">Fix the CO₂ scrubbers</div>`;
	document.body.appendChild(questMarker);

	return {
		skipHint,
		hudOverlay,
		fadeOverlay,
		questMarker,
		dispose: () => {
			skipHint.remove();
			hudOverlay.remove();
			fadeOverlay.remove();
			questMarker.remove();
		},
	};
};

// ─── Scene mount ──────────────────────────────────────────────────────────────

async function mount(context: GameSceneModuleContext): Promise<GameSceneLifecycle> {
	const { scene, camera, gotoScene, renderer } = context;

	// ── Renderer / scene setup ────────────────────────────────────────────────
	renderer.shadowMap.enabled = false;
	scene.background = new THREE.Color(0x010108);
	scene.fog = new THREE.Fog(0x010108, 20, 85);

	// Very faint overall ambient (emergency mode — almost nothing)
	const ambientLight = new THREE.AmbientLight(0x0d1535, 4.0);
	scene.add(ambientLight);

	// ── Build all geometry ────────────────────────────────────────────────────
	const gateEntrance    = buildGateEntrance(scene);
	const arrivalCorridor = buildArrivalCorridor(scene);
	const linkingTunnel   = buildLinkingTunnel(scene);
	const obsDeck         = buildObservationDeck(scene);
	const ftlSystem       = createFTLSystem(scene);
	const rushNpc         = createRushNpc(scene);

	// FTL only visible from obs deck onward
	ftlSystem.group.visible = false;

	// ── UI ────────────────────────────────────────────────────────────────────
	const ui = createCinematicUI();

	// ── Cinematic state ───────────────────────────────────────────────────────
	// Allow ?cinematicTime=N to jump to any beat (useful for screenshots)
	const urlParams  = new URLSearchParams(window.location.search);
	const startAt    = parseFloat(urlParams.get("cinematicTime") ?? "0");

	let elapsedTime  = isNaN(startAt) ? 0 : startAt;
	let disposed     = false;
	let skipping     = false;
	let skipProgress = 0;
	let transitioning = false;

	// Set initial camera
	camera.fov = 65;
	camera.near = 0.1;
	camera.far  = 600;
	camera.updateProjectionMatrix();
	camera.position.copy(BEATS[0].cameraFrom);
	camera.lookAt(GATE_CENTER);

	// If starting mid-cinematic, pre-set Rush position
	if (elapsedTime > 0) {
		rushNpc.isStanding = elapsedTime > 12;
		if (rushNpc.isStanding) {
			rushNpc.standProgress = 1;
			rushNpc.group.rotation.z = 0;
			rushNpc.group.position.y = 0;
		}
		// Fast-forward Rush along path
		let tempT = 12.5;
		while (tempT < elapsedTime) {
			updateRushNpc(rushNpc, 0.1, tempT);
			tempT += 0.1;
		}
	}

	// ── Helpers ───────────────────────────────────────────────────────────────

	const applyCameraForTime = (t: number): void => {
		// Find the last beat that has started
		let activeBeat: CinematicBeat = BEATS[0];
		for (const beat of BEATS) {
			if (t >= beat.startTime) activeBeat = beat;
			else break;
		}

		const raw      = Math.min(1, (t - activeBeat.startTime) / activeBeat.duration);
		const progress = easeFns[activeBeat.easing](raw);

		camera.position.lerpVectors(activeBeat.cameraFrom, activeBeat.cameraTo, progress);

		if (activeBeat.lookAt === "rush") {
			const target = rushNpc.group.position.clone();
			target.y += 1.65;
			camera.lookAt(target);
		} else if (activeBeat.lookAt === "player") {
			camera.lookAt(camera.position.clone().addScaledVector(camera.getWorldDirection(new THREE.Vector3()), 1));
		} else {
			camera.lookAt(activeBeat.lookAt);
		}
	};

	const finishCinematic = async (): Promise<void> => {
		if (disposed || transitioning) return;
		transitioning = true;
		await gotoScene("gate-room");
	};

	// ── Key handler ───────────────────────────────────────────────────────────
	const handleKeyDown = (e: KeyboardEvent): void => {
		if ((e.code === "Space" || e.code === "Escape") && !skipping) {
			skipping = true;
		}
	};
	window.addEventListener("keydown", handleKeyDown);

	// ── Update loop ───────────────────────────────────────────────────────────
	return {
		update(delta: number): void {
			if (disposed) return;

			// Skip sequence
			if (skipping) {
				skipProgress += delta / SKIP_FADE_DURATION;
				ui.fadeOverlay.style.background = "black";
				ui.fadeOverlay.style.opacity    = String(Math.min(1, skipProgress * 2));
				if (skipProgress >= 1) {
					skipping = false;
					void finishCinematic();
				}
				return;
			}

			elapsedTime += delta;
			const t = elapsedTime;

			// ── Visibility gating ───────────────────────────────────────────
			gateEntrance.group.visible    = t < 8;
			arrivalCorridor.group.visible = t >= 4.5 && t < 30;
			linkingTunnel.group.visible   = t >= 14 && t < 30;

			// FTL system becomes visible as we enter obs deck
			if (t >= 22.5 && !ftlSystem.group.visible) ftlSystem.group.visible = true;
			if (t >= 30   &&  ftlSystem.group.visible) {
				// Keep visible but stop updating for perf
			}

			// ── Beat 0-4: Event horizon animation ──────────────────────────
			if (t < 7) {
				const horizonMat = gateEntrance.eventHorizon.material as THREE.MeshStandardMaterial;
				// Ripple shimmer
				const ripple     = Math.sin(t * 6.5) * 0.03;
				const glow       = 1.2 + Math.sin(t * 2.8) * 0.2;
				horizonMat.emissiveIntensity = glow;
				gateEntrance.eventHorizon.scale.set(1 + ripple, 1 + ripple * 0.8, 1);

				// Gate light throb
				gateEntrance.gateLight.intensity = 280 + Math.sin(t * 3.5) * 40;

				// Inner ring spins faster as we approach
				const spinSpeed = 0.8 + (Math.min(t, 4) / 4) * 2.5;
				// (ring rotation applied via group — use userData for accumulation)
				gateEntrance.gateLight.userData.ringAngle =
					(gateEntrance.gateLight.userData.ringAngle ?? 0) + delta * spinSpeed;
			}

			// ── Beat 1-2: Wormhole entry flash (4.8s → 6.8s) ──────────────
			if (t >= 4.8 && t < 7.0) {
				const flashT = (t - 4.8) / 2.2;
				// Flash in then fade — peak at t=5.5
				const flashVal = Math.sin(flashT * Math.PI);
				ui.fadeOverlay.style.background = "white";
				ui.fadeOverlay.style.opacity    = String(Math.min(0.98, flashVal * 1.1));
			} else if (!skipping && (t < 4.8 || t >= 7.0) && t < HUD_FADE_IN_START) {
				ui.fadeOverlay.style.opacity = "0";
			}

			// ── Beat 2: Camera tumble on violent arrival (5.5s → 9s) ───────
			if (t >= 5.5 && t < 9.5) {
				const tumbleT   = (t - 5.5) / 4;
				const intensity = (1 - tumbleT) * 0.28;
				// Rock the camera with multi-frequency shake
				camera.rotation.z = Math.sin(t * 7.2) * intensity * 0.7;
				camera.rotation.x += Math.sin(t * 9.1) * intensity * 0.15 * delta * 60;
			} else if (t >= 9.5 && t < 12) {
				// Damp rotation back to zero
				camera.rotation.z *= Math.pow(0.85, delta * 60);
				camera.rotation.x *= Math.pow(0.92, delta * 60);
			}

			// ── Emergency light flicker (arrival through corridor) ──────────
			if (t >= 5.5 && t < 28) {
				for (const light of arrivalCorridor.emergencyLights) {
					const flicker = Math.sin(t * 11.3 + light.position.z) * 8;
					const dropout = Math.random() < 0.04 ? -18 : 0;
					light.intensity = Math.max(15, 55 + flicker + dropout);
				}
			}

			// ── Sparking panels — random white flash ────────────────────────
			if (t >= 5.5 && t < 25) {
				for (const panel of arrivalCorridor.sparkingPanels) {
					const mat = panel.material as THREE.MeshStandardMaterial;
					if (Math.random() < 0.025) {
						mat.emissive.set(0xffffff);
						mat.emissiveIntensity = 2.0 + Math.random() * 2;
					} else {
						mat.emissiveIntensity *= Math.pow(0.6, delta * 60);
						mat.emissive.set(0x334466);
					}
				}
			}

			// ── Rush NPC ───────────────────────────────────────────────────
			updateRushNpc(rushNpc, delta, t);

			// ── FTL system update ──────────────────────────────────────────
			if (ftlSystem.group.visible) {
				updateFTLSystem(ftlSystem, delta, camera.position.z);

				// Warp light pulse — gentle breathing rhythm
				const pulse = Math.sin(t * 1.8) * 18 + Math.sin(t * 3.7) * 8;
				obsDeck.warpLight.intensity = 150 + pulse;
			}

			// ── FOV tighten for obs deck reveal ────────────────────────────
			if (t >= 22 && t < 30) {
				const fovT = Math.min(1, (t - 22) / 8);
				camera.fov = 65 - easeFns["ease-out"](fovT) * 14; // 65 → 51
				camera.updateProjectionMatrix();
			}

			// ── Camera position via cinematic beats ─────────────────────────
			applyCameraForTime(t);

			// ── HUD fade in (30s → 34s) ─────────────────────────────────────
			if (t >= HUD_FADE_IN_START) {
				const hudT = Math.min(1, (t - HUD_FADE_IN_START) / HUD_FADE_IN_DURATION);
				ui.hudOverlay.style.opacity  = String(hudT);
				if (hudT > 0.5) {
					ui.questMarker.style.opacity = String((hudT - 0.5) * 2);
				}
			}

			// Skip hint fades at 29s
			if (t >= 29) {
				ui.skipHint.style.opacity = String(Math.max(0, 1 - (t - 29) / 2));
			}

			// ── End of cinematic ─────────────────────────────────────────────
			if (t >= CINEMATIC_TOTAL_DURATION) {
				void finishCinematic();
			}
		},

		dispose(): void {
			disposed = true;
			window.removeEventListener("keydown", handleKeyDown);
			gateEntrance.dispose();
			arrivalCorridor.dispose();
			linkingTunnel.dispose();
			obsDeck.dispose();
			ftlSystem.dispose();
			rushNpc.dispose();
			ui.dispose();
			scene.remove(ambientLight);
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
