import * as THREE from "three";
import {
	createColocatedRuntimeSceneSource,
	defineGameScene
} from "../../game/runtime-scene-sources";
import type { GameSceneModuleContext, GameSceneLifecycle } from "../../game/scene-types";
import { perfMetrics } from "../../game/app";

const assetUrlLoaders = import.meta.glob("./assets/**/*", {
	import: "default",
	query: "?url"
}) as Record<string, () => Promise<string>>;

// ─── Constants ───────────────────────────────────────────────────────────────

const ROOM_WIDTH = 26;
const ROOM_DEPTH = 40;
const ROOM_HEIGHT = 8;
const GATE_RADIUS = 2.8;
const GATE_TUBE = 0.22;
const GATE_CENTER = new THREE.Vector3(0, GATE_RADIUS + GATE_TUBE - 0.3, 0); // centered in room
const CHEVRON_COUNT = 9;

// SGU color palette
const COLOR_ANCIENT_METAL = 0x2a2a3a;
const COLOR_ANCIENT_GLOW = 0x4488ff;
const COLOR_CHEVRON_OFF = 0x111122;
const COLOR_CHEVRON_ON = 0x44aaff;
const COLOR_EVENT_HORIZON = 0x88bbff;
const COLOR_WALL = 0x1a1a2e;
const COLOR_CEILING = 0x141425;

// Wall transparency — track wall meshes for camera occlusion
const wallMeshes: THREE.Mesh[] = [];

// ─── Gate activation state ───────────────────────────────────────────────────

type GateState = "idle" | "dialing" | "kawoosh" | "active" | "shutdown";

type GateRuntime = {
	chevronMeshes: THREE.Mesh[];
	dialElapsed: number;
	eventHorizon: THREE.Mesh;
	innerRing: THREE.Mesh;
	kawooshElapsed: number;
	lockedChevrons: number;
	outerRing: THREE.Mesh;
	pointLights: THREE.PointLight[];
	state: GateState;
};

// ─── Room construction ───────────────────────────────────────────────────────

function createWallMaterial(): THREE.MeshStandardMaterial {
	return new THREE.MeshStandardMaterial({
		color: COLOR_WALL,
		roughness: 0.95,
		metalness: 0.05,
		side: THREE.DoubleSide,
		transparent: true,
		opacity: 1.0
	});
}

function buildRoom(scene: THREE.Scene): void {
	const ceilingMat = new THREE.MeshStandardMaterial({
		color: COLOR_CEILING,
		roughness: 0.98,
		metalness: 0.02,
		side: THREE.DoubleSide,
		transparent: true,
		opacity: 1.0
	});

	// Back wall (behind gate)
	const backWall = new THREE.Mesh(
		new THREE.BoxGeometry(ROOM_WIDTH, ROOM_HEIGHT, 0.5),
		createWallMaterial()
	);
	backWall.position.set(0, ROOM_HEIGHT / 2, -ROOM_DEPTH / 2);
	scene.add(backWall);
	wallMeshes.push(backWall);

	// Front wall
	const frontWall = new THREE.Mesh(
		new THREE.BoxGeometry(ROOM_WIDTH, ROOM_HEIGHT, 0.5),
		createWallMaterial()
	);
	frontWall.position.set(0, ROOM_HEIGHT / 2, ROOM_DEPTH / 2);
	scene.add(frontWall);
	wallMeshes.push(frontWall);

	// Left wall
	const leftWall = new THREE.Mesh(
		new THREE.BoxGeometry(0.5, ROOM_HEIGHT, ROOM_DEPTH),
		createWallMaterial()
	);
	leftWall.position.set(-ROOM_WIDTH / 2, ROOM_HEIGHT / 2, 0);
	scene.add(leftWall);
	wallMeshes.push(leftWall);

	// Right wall
	const rightWall = new THREE.Mesh(
		new THREE.BoxGeometry(0.5, ROOM_HEIGHT, ROOM_DEPTH),
		createWallMaterial()
	);
	rightWall.position.set(ROOM_WIDTH / 2, ROOM_HEIGHT / 2, 0);
	scene.add(rightWall);
	wallMeshes.push(rightWall);

	// Ceiling
	const ceiling = new THREE.Mesh(
		new THREE.BoxGeometry(ROOM_WIDTH, 0.5, ROOM_DEPTH),
		ceilingMat
	);
	ceiling.position.set(0, ROOM_HEIGHT, 0);
	scene.add(ceiling);
	wallMeshes.push(ceiling);

	// Structural arch supports on walls — heavy Ancient architecture
	const archMat = new THREE.MeshStandardMaterial({
		color: 0x15152a,
		roughness: 0.8,
		metalness: 0.2
	});
	for (let i = -2; i <= 2; i++) {
		if (i === 0) continue;
		// Left wall arches
		const leftArch = new THREE.Mesh(
			new THREE.BoxGeometry(0.4, ROOM_HEIGHT, 0.6),
			archMat
		);
		leftArch.position.set(-ROOM_WIDTH / 2 + 0.4, ROOM_HEIGHT / 2, i * 4);
		scene.add(leftArch);

		// Right wall arches
		const rightArch = new THREE.Mesh(
			new THREE.BoxGeometry(0.4, ROOM_HEIGHT, 0.6),
			archMat
		);
		rightArch.position.set(ROOM_WIDTH / 2 - 0.4, ROOM_HEIGHT / 2, i * 4);
		scene.add(rightArch);
	}

	// Back wall structural frame around gate area
	const frameMat = new THREE.MeshStandardMaterial({
		color: 0x1a1a30,
		roughness: 0.75,
		metalness: 0.25
	});
	// Top beam
	const topBeam = new THREE.Mesh(
		new THREE.BoxGeometry(10, 0.8, 0.6),
		frameMat
	);
	topBeam.position.set(0, ROOM_HEIGHT - 1, -ROOM_DEPTH / 2 + 0.5);
	scene.add(topBeam);
	// Side columns
	for (const xSign of [-1, 1]) {
		const column = new THREE.Mesh(
			new THREE.BoxGeometry(0.8, ROOM_HEIGHT, 0.6),
			frameMat
		);
		column.position.set(xSign * 4.5, ROOM_HEIGHT / 2, -ROOM_DEPTH / 2 + 0.5);
		scene.add(column);
	}

	// Amber floor guide strips — run the full room length, through the gate
	const stripMat = new THREE.MeshStandardMaterial({
		color: 0xddaa33,
		emissive: 0xddaa33,
		emissiveIntensity: 0.4,
		roughness: 0.6,
		metalness: 0.3
	});
	const stripStartZ = ROOM_DEPTH / 2 - 2;
	const stripEndZ = -ROOM_DEPTH / 2 + 2;
	const stripSpacing = 1.4;
	for (let z = stripStartZ; z >= stripEndZ; z -= stripSpacing) {
		for (const x of [-1.2, 1.2]) {
			const strip = new THREE.Mesh(
				new THREE.BoxGeometry(0.12, 0.02, 0.5),
				stripMat
			);
			strip.position.set(x, 0.01, z);
			scene.add(strip);
		}
	}
}

// ─── Stargate construction ───────────────────────────────────────────────────

/** Create a flat-profiled ring (rectangular cross-section) using LatheGeometry */
function createFlatRingGeometry(radius: number, width: number, depth: number, segments: number = 64): THREE.BufferGeometry {
	// Profile: a rectangle at distance `radius` from the Y axis, extruded around Y
	// LatheGeometry rotates a 2D profile around Y. Profile points are (x, y) = (radius, z-offset)
	const halfW = width / 2;
	const halfD = depth / 2;
	const outerR = radius + halfW;
	const innerR = radius - halfW;

	const points = [
		new THREE.Vector2(innerR, -halfD),
		new THREE.Vector2(outerR, -halfD),
		new THREE.Vector2(outerR, halfD),
		new THREE.Vector2(innerR, halfD),
	];

	const geo = new THREE.LatheGeometry(points, segments);
	// LatheGeometry produces a ring lying in the XZ plane — rotate so it faces forward (XY plane)
	geo.rotateX(Math.PI / 2);
	return geo;
}

function buildStargate(scene: THREE.Scene): GateRuntime {
	// Outer ring — flat band profile like the SGU gate
	const outerRingMat = new THREE.MeshStandardMaterial({
		color: COLOR_ANCIENT_METAL,
		roughness: 0.3,
		metalness: 0.85
	});
	const outerRing = new THREE.Mesh(
		createFlatRingGeometry(GATE_RADIUS, GATE_TUBE * 2.2, GATE_TUBE * 1.4),
		outerRingMat
	);
	outerRing.position.copy(GATE_CENTER);
	scene.add(outerRing);

	// Inner ring — slightly smaller flat band, spins during dialing
	const innerRingMat = new THREE.MeshStandardMaterial({
		color: 0x222235,
		roughness: 0.25,
		metalness: 0.9
	});
	const innerRing = new THREE.Mesh(
		createFlatRingGeometry(GATE_RADIUS - 0.05, GATE_TUBE * 1.4, GATE_TUBE * 1.0),
		innerRingMat
	);
	innerRing.position.copy(GATE_CENTER);
	scene.add(innerRing);

	// Ring segments — ornate bumps around the outer edge (SGU-style)
	const segmentMat = new THREE.MeshStandardMaterial({
		color: 0x333348,
		roughness: 0.35,
		metalness: 0.8
	});
	const SEGMENT_COUNT = 36;
	for (let i = 0; i < SEGMENT_COUNT; i++) {
		const angle = (i / SEGMENT_COUNT) * Math.PI * 2;
		const segment = new THREE.Mesh(
			new THREE.BoxGeometry(0.22, 0.12, 0.12),
			segmentMat
		);
		segment.position.set(
			GATE_CENTER.x + Math.cos(angle) * (GATE_RADIUS + 0.08),
			GATE_CENTER.y + Math.sin(angle) * (GATE_RADIUS + 0.08),
			GATE_CENTER.z + 0.08
		);
		segment.lookAt(
			GATE_CENTER.x + Math.cos(angle) * (GATE_RADIUS + 2),
			GATE_CENTER.y + Math.sin(angle) * (GATE_RADIUS + 2),
			GATE_CENTER.z + 0.08
		);
		scene.add(segment);
	}

	// Chevrons — 9 markers around the ring
	const chevronMeshes: THREE.Mesh[] = [];
	for (let i = 0; i < CHEVRON_COUNT; i++) {
		const angle = (i / CHEVRON_COUNT) * Math.PI * 2 - Math.PI / 2;
		const chevronGeo = new THREE.BoxGeometry(0.18, 0.3, 0.15);
		const chevronMat = new THREE.MeshStandardMaterial({
			color: COLOR_CHEVRON_OFF,
			roughness: 0.4,
			metalness: 0.7,
			emissive: COLOR_CHEVRON_OFF,
			emissiveIntensity: 0.1
		});
		const chevron = new THREE.Mesh(chevronGeo, chevronMat);
		chevron.position.set(
			GATE_CENTER.x + Math.cos(angle) * (GATE_RADIUS + 0.15),
			GATE_CENTER.y + Math.sin(angle) * (GATE_RADIUS + 0.15),
			GATE_CENTER.z + 0.15
		);
		chevron.lookAt(
			GATE_CENTER.x + Math.cos(angle) * (GATE_RADIUS + 2),
			GATE_CENTER.y + Math.sin(angle) * (GATE_RADIUS + 2),
			GATE_CENTER.z + 0.15
		);
		scene.add(chevron);
		chevronMeshes.push(chevron);
	}

	// Event horizon — the wormhole surface (hidden until active)
	const horizonMat = new THREE.MeshStandardMaterial({
		color: COLOR_EVENT_HORIZON,
		emissive: COLOR_EVENT_HORIZON,
		emissiveIntensity: 0.8,
		transparent: true,
		opacity: 0,
		side: THREE.DoubleSide,
		roughness: 0.1,
		metalness: 0.0
	});
	const eventHorizon = new THREE.Mesh(
		new THREE.CircleGeometry(GATE_RADIUS - GATE_TUBE - 0.05, 64),
		horizonMat
	);
	eventHorizon.position.copy(GATE_CENTER);
	eventHorizon.visible = false;
	scene.add(eventHorizon);

	return {
		chevronMeshes,
		dialElapsed: 0,
		eventHorizon,
		innerRing,
		kawooshElapsed: 0,
		lockedChevrons: 0,
		outerRing,
		pointLights: [],
		state: "idle"
	};
}

// ─── Atmospheric lighting ────────────────────────────────────────────────────

function buildLighting(scene: THREE.Scene, debugObjects: THREE.Object3D[]): THREE.PointLight[] {
	// PERFORMANCE: keep point lights to a minimum (< 8).
	// Use emissive materials for accent glow instead of point lights.
	const lights: THREE.PointLight[] = [];
	const gateZ = GATE_CENTER.z;

	// 1. Single overhead directional-style light for general visibility
	const overheadLight = new THREE.PointLight(0xffeedd, 1.2, 40, 1.5);
	overheadLight.position.set(0, 7.5, 2);
	scene.add(overheadLight);
	lights.push(overheadLight);

	// 2. Gate front — blue Ancient glow
	const gateFrontLight = new THREE.PointLight(COLOR_ANCIENT_GLOW, 3, 15, 1.5);
	gateFrontLight.position.set(0, 2, gateZ + 2);
	scene.add(gateFrontLight);
	lights.push(gateFrontLight);

	// 3. Gate back — backlight the ring
	const gateBackLight = new THREE.PointLight(COLOR_ANCIENT_GLOW, 2.5, 12, 1.5);
	gateBackLight.position.set(0, 3.5, gateZ - 3);
	scene.add(gateBackLight);
	lights.push(gateBackLight);

	// 4. Gate top — highlights the upper ring
	const gateTopLight = new THREE.PointLight(COLOR_ANCIENT_GLOW, 1.5, 10, 2);
	gateTopLight.position.set(0, 7, gateZ);
	scene.add(gateTopLight);
	lights.push(gateTopLight);

	// 5-6. Warm amber side lights (just 2, not 10)
	const COLOR_WARM_ACCENT = 0xffaa44;
	const leftSide = new THREE.PointLight(COLOR_WARM_ACCENT, 1.0, 18, 1.5);
	leftSide.position.set(-ROOM_WIDTH / 2 + 2, 3, 0);
	scene.add(leftSide);
	lights.push(leftSide);

	const rightSide = new THREE.PointLight(COLOR_WARM_ACCENT, 1.0, 18, 1.5);
	rightSide.position.set(ROOM_WIDTH / 2 - 2, 3, 0);
	scene.add(rightSide);
	lights.push(rightSide);

	// 7-10. Floor spotlights aimed at gate faces — 2 front, 2 back
	// Each pair flanks the gate left/right, angled inward to hit the flat ring surface
	const gateY = GATE_CENTER.y; // center height of gate ring
	// Aim at the RING SURFACE (at the ring radius), not through the hole
	// Target the near-side ring face at ~45° up from floor to mid-ring
	const ringTargetY = gateY;  // mid-ring height
	const spotPositions = [
		// Front-left: aim at front face of ring, left side of ring
		{ pos: [-2.5, 0.1, gateZ + 3.5], target: [-GATE_RADIUS * 0.5, ringTargetY, gateZ + 0.15], zDir: -1 },
		// Front-right: aim at front face of ring, right side of ring
		{ pos: [2.5, 0.1, gateZ + 3.5], target: [GATE_RADIUS * 0.5, ringTargetY, gateZ + 0.15], zDir: -1 },
		// Back-left: aim at back face of ring, left side
		{ pos: [-2.5, 0.1, gateZ - 3.5], target: [-GATE_RADIUS * 0.5, ringTargetY, gateZ - 0.15], zDir: 1 },
		// Back-right: aim at back face of ring, right side
		{ pos: [2.5, 0.1, gateZ - 3.5], target: [GATE_RADIUS * 0.5, ringTargetY, gateZ - 0.15], zDir: 1 },
	];

	const housingMat = new THREE.MeshStandardMaterial({
		color: 0x222233,
		roughness: 0.6,
		metalness: 0.4
	});
	const lensMat = new THREE.MeshStandardMaterial({
		color: 0xccddff,
		emissive: 0xbbddff,
		emissiveIntensity: 1.5
	});

	for (const sp of spotPositions) {
		const spot = new THREE.SpotLight(0xbbddff, 30, 20, Math.PI / 5, 0.5, 1.0);
		spot.position.set(sp.pos[0], sp.pos[1], sp.pos[2]);
		spot.target.position.set(sp.target[0], sp.target[1], sp.target[2]);
		scene.add(spot);
		scene.add(spot.target);

		// Debug: spotlight cone helper (hidden by default)
		const helper = new THREE.SpotLightHelper(spot, 0xffff00);
		helper.visible = false;
		scene.add(helper);
		requestAnimationFrame(() => helper.update());
		debugObjects.push(helper);

		// Group housing + lens together so we can rotate as one unit
		const fixtureGroup = new THREE.Group();
		fixtureGroup.position.set(sp.pos[0], 0.18, sp.pos[2]);

		// Rotate fixture to aim at the gate — tilt up on X axis
		const dx = sp.target[0] - sp.pos[0];
		const dy = sp.target[1] - sp.pos[1];
		const dz = sp.target[2] - sp.pos[2];
		const horizontalDist = Math.sqrt(dx * dx + dz * dz);
		const tiltAngle = Math.atan2(dy, horizontalDist);
		// Rotate around X, sign depends on front vs back
		fixtureGroup.rotation.x = sp.zDir * -tiltAngle;

		// Housing box
		const housing = new THREE.Mesh(
			new THREE.BoxGeometry(0.5, 0.35, 0.6),
			housingMat
		);
		fixtureGroup.add(housing);

		// Glowing lens on the gate-facing end
		const lens = new THREE.Mesh(
			new THREE.BoxGeometry(0.35, 0.25, 0.05),
			lensMat
		);
		lens.position.set(0, 0, sp.zDir * 0.33);
		fixtureGroup.add(lens);

		scene.add(fixtureGroup);
	}

	// Use EMISSIVE MATERIALS instead of point lights for accent strips
	const stripMat = new THREE.MeshStandardMaterial({
		color: COLOR_ANCIENT_GLOW,
		emissive: COLOR_ANCIENT_GLOW,
		emissiveIntensity: 0.5
	});

	// Floor strips along walls
	for (const xSign of [-1, 1]) {
		const strip = new THREE.Mesh(
			new THREE.BoxGeometry(0.06, 0.12, ROOM_DEPTH - 2),
			stripMat
		);
		strip.position.set(xSign * (ROOM_WIDTH / 2 - 0.3), 0.1, 0);
		scene.add(strip);
	}

	// Emissive panels behind gate (cheaper than point lights)
	const backGlowMat = new THREE.MeshStandardMaterial({
		color: 0x2244aa,
		emissive: 0x2244aa,
		emissiveIntensity: 0.6
	});
	for (const xSign of [-1, 1]) {
		const panel = new THREE.Mesh(
			new THREE.BoxGeometry(0.1, 4, 2),
			backGlowMat
		);
		panel.position.set(xSign * 3, 2.5, gateZ - 2);
		scene.add(panel);
	}

	return lights;
}

// ─── HUD overlay (safe DOM creation) ─────────────────────────────────────────

function createHUD(): HTMLDivElement {
	const hud = document.createElement("div");
	hud.id = "gate-hud";

	const container = document.createElement("div");
	Object.assign(container.style, {
		position: "fixed",
		bottom: "40px",
		left: "50%",
		transform: "translateX(-50%)",
		color: "#4488ff",
		fontFamily: "'Courier New', monospace",
		fontSize: "16px",
		textAlign: "center",
		textShadow: "0 0 10px #4488ff44",
		pointerEvents: "none",
		userSelect: "none"
	});

	const statusEl = document.createElement("div");
	statusEl.id = "gate-status";
	statusEl.textContent = "Press G to dial the Stargate";

	const chevronsEl = document.createElement("div");
	chevronsEl.id = "gate-chevrons";
	Object.assign(chevronsEl.style, {
		marginTop: "8px",
		fontSize: "20px",
		letterSpacing: "4px"
	});

	container.appendChild(statusEl);
	container.appendChild(chevronsEl);
	hud.appendChild(container);
	document.body.appendChild(hud);
	return hud;
}

function updateHUD(gate: GateRuntime): void {
	const status = document.getElementById("gate-status");
	const chevrons = document.getElementById("gate-chevrons");
	if (!status || !chevrons) return;

	let chevronDisplay = "";
	for (let i = 0; i < CHEVRON_COUNT; i++) {
		chevronDisplay += i < gate.lockedChevrons ? "\u25C6" : "\u25C7";
	}
	chevrons.textContent = chevronDisplay;

	switch (gate.state) {
		case "idle":
			status.textContent = "Press G to dial the Stargate";
			break;
		case "dialing":
			status.textContent = `Dialing... Chevron ${gate.lockedChevrons} of ${CHEVRON_COUNT}`;
			break;
		case "kawoosh":
			status.textContent = "Chevron 9 locked!";
			break;
		case "active":
			status.textContent = "Wormhole established \u2014 Press G to shut down";
			break;
		case "shutdown":
			status.textContent = "Wormhole disengaged";
			break;
	}
}

// ─── Gate activation logic ───────────────────────────────────────────────────

const DIAL_TIME_PER_CHEVRON = 0.6;
const KAWOOSH_DURATION = 1.2;
const SHUTDOWN_DURATION = 0.8;

function updateGate(gate: GateRuntime, delta: number): void {
	switch (gate.state) {
		case "dialing":
			updateDialing(gate, delta);
			break;
		case "kawoosh":
			updateKawoosh(gate, delta);
			break;
		case "active":
			updateActiveWormhole(gate, delta);
			break;
		case "shutdown":
			updateShutdown(gate, delta);
			break;
	}
	updateHUD(gate);
}

function startDial(gate: GateRuntime): void {
	if (gate.state !== "idle") return;
	gate.state = "dialing";
	gate.dialElapsed = 0;
	gate.lockedChevrons = 0;
}

function shutdownGate(gate: GateRuntime): void {
	if (gate.state !== "active") return;
	gate.state = "shutdown";
	gate.kawooshElapsed = 0;
}

function updateDialing(gate: GateRuntime, delta: number): void {
	gate.dialElapsed += delta;

	// Spin the inner ring (SGU-style continuous rotation)
	gate.innerRing.rotation.z += delta * 3.0;

	// Lock chevrons at intervals
	const targetChevrons = Math.min(
		Math.floor(gate.dialElapsed / DIAL_TIME_PER_CHEVRON) + 1,
		CHEVRON_COUNT
	);

	while (gate.lockedChevrons < targetChevrons) {
		lockChevron(gate, gate.lockedChevrons);
		gate.lockedChevrons++;
	}

	// Inner ring glow increases during dial
	const mat = gate.innerRing.material as THREE.MeshStandardMaterial;
	mat.emissive = new THREE.Color(COLOR_ANCIENT_GLOW);
	mat.emissiveIntensity = 0.3 + (gate.lockedChevrons / CHEVRON_COUNT) * 0.5;

	// All chevrons locked — start kawoosh
	if (gate.lockedChevrons >= CHEVRON_COUNT) {
		gate.state = "kawoosh";
		gate.kawooshElapsed = 0;
		gate.eventHorizon.visible = true;
		(gate.eventHorizon.material as THREE.MeshStandardMaterial).opacity = 0;
	}
}

function lockChevron(gate: GateRuntime, index: number): void {
	const chevron = gate.chevronMeshes[index];
	const mat = chevron.material as THREE.MeshStandardMaterial;
	mat.color.set(COLOR_CHEVRON_ON);
	mat.emissive.set(COLOR_CHEVRON_ON);
	mat.emissiveIntensity = 1.2;
}

function updateKawoosh(gate: GateRuntime, delta: number): void {
	gate.kawooshElapsed += delta;
	const progress = gate.kawooshElapsed / KAWOOSH_DURATION;
	const horizonMat = gate.eventHorizon.material as THREE.MeshStandardMaterial;

	if (progress < 0.3) {
		// Phase 1: Burst outward (kawoosh!)
		const burstProgress = progress / 0.3;
		const scale = 0.1 + burstProgress * 1.4;
		gate.eventHorizon.scale.set(scale, scale, 1);
		horizonMat.opacity = burstProgress * 0.95;
		horizonMat.emissiveIntensity = 1.5 + burstProgress * 3.0;
	} else if (progress < 0.6) {
		// Phase 2: Retract to stable size
		const retractProgress = (progress - 0.3) / 0.3;
		const scale = 1.5 - retractProgress * 0.5;
		gate.eventHorizon.scale.set(scale, scale, 1);
		horizonMat.emissiveIntensity = 4.5 - retractProgress * 3.5;
	} else {
		// Phase 3: Settle
		gate.eventHorizon.scale.set(1, 1, 1);
		horizonMat.opacity = 0.8;
		horizonMat.emissiveIntensity = 1.0;
	}

	// Stop inner ring spinning gradually
	gate.innerRing.rotation.z += delta * (3.0 * (1 - progress));

	if (gate.kawooshElapsed >= KAWOOSH_DURATION) {
		gate.state = "active";
		gate.dialElapsed = 0;
		gate.eventHorizon.scale.set(1, 1, 1);
		horizonMat.opacity = 0.8;
		horizonMat.emissiveIntensity = 1.0;
	}
}

function updateActiveWormhole(gate: GateRuntime, delta: number): void {
	gate.dialElapsed += delta;
	const horizonMat = gate.eventHorizon.material as THREE.MeshStandardMaterial;

	// Gentle ripple/pulse effect
	const pulse = Math.sin(gate.dialElapsed * 2.0) * 0.05;
	horizonMat.opacity = 0.75 + pulse;
	horizonMat.emissiveIntensity = 0.8 + pulse * 2;

	// Subtle rotation on the event horizon for visual interest
	gate.eventHorizon.rotation.z += delta * 0.2;

	// Modulate blue lights for wormhole ambient glow
	for (const light of gate.pointLights) {
		if (light.color.getHex() === COLOR_ANCIENT_GLOW) {
			light.intensity = 2 + Math.sin(gate.dialElapsed * 1.5) * 0.5;
		}
	}
}

function updateShutdown(gate: GateRuntime, delta: number): void {
	gate.kawooshElapsed += delta;
	const progress = Math.min(gate.kawooshElapsed / SHUTDOWN_DURATION, 1);
	const horizonMat = gate.eventHorizon.material as THREE.MeshStandardMaterial;

	// Shrink and fade
	const scale = 1 - progress;
	gate.eventHorizon.scale.set(scale, scale, 1);
	horizonMat.opacity = 0.8 * (1 - progress);
	horizonMat.emissiveIntensity = 1.0 * (1 - progress);

	if (progress >= 1) {
		gate.state = "idle";
		gate.eventHorizon.visible = false;
		gate.lockedChevrons = 0;
		gate.dialElapsed = 0;

		// Reset chevrons
		for (const chevron of gate.chevronMeshes) {
			const mat = chevron.material as THREE.MeshStandardMaterial;
			mat.color.set(COLOR_CHEVRON_OFF);
			mat.emissive.set(COLOR_CHEVRON_OFF);
			mat.emissiveIntensity = 0.1;
		}

		// Reset inner ring
		const innerMat = gate.innerRing.material as THREE.MeshStandardMaterial;
		innerMat.emissiveIntensity = 0;

		// Reset lights
		for (const light of gate.pointLights) {
			if (light.color.getHex() === COLOR_ANCIENT_GLOW) {
				light.intensity = 2;
			}
		}
	}
}

// ─── Camera wall transparency (throttled for performance) ────────────────────

const WALL_FADE_SPEED = 8.0;
const WALL_MIN_OPACITY = 0.15;
const WALL_CHECK_INTERVAL = 3; // check every Nth frame
const raycaster = new THREE.Raycaster();
let wallCheckFrame = 0;
let lastOccludingWalls = new Set<THREE.Object3D>();

function updateWallTransparency(camera: THREE.PerspectiveCamera, playerPos: THREE.Vector3, delta: number): void {
	wallCheckFrame++;

	// Only raycast every few frames — use cached result otherwise
	if (wallCheckFrame % WALL_CHECK_INTERVAL === 0) {
		const cameraPos = camera.position;
		const direction = scratchWallDir.subVectors(playerPos, cameraPos).normalize();
		const distance = cameraPos.distanceTo(playerPos);

		raycaster.set(cameraPos, direction);
		raycaster.far = distance;
		const hits = raycaster.intersectObjects(wallMeshes, false);
		lastOccludingWalls = new Set(hits.map(h => h.object));
	}

	// Smooth opacity transitions run every frame
	for (const wall of wallMeshes) {
		const mat = wall.material as THREE.MeshStandardMaterial;
		const targetOpacity = lastOccludingWalls.has(wall) ? WALL_MIN_OPACITY : 1.0;
		mat.opacity += (targetOpacity - mat.opacity) * Math.min(1, delta * WALL_FADE_SPEED);
		mat.depthWrite = mat.opacity > 0.9;
	}
}

const scratchWallDir = new THREE.Vector3();

// ─── Debug overlay ───────────────────────────────────────────────────────────

function createDebugOverlay(): { element: HTMLDivElement; update: () => void } {
	const el = document.createElement("div");
	el.id = "debug-overlay";
	Object.assign(el.style, {
		position: "fixed",
		top: "8px",
		left: "8px",
		color: "#44ff88",
		fontFamily: "'Courier New', monospace",
		fontSize: "12px",
		lineHeight: "1.6",
		background: "rgba(0, 0, 0, 0.6)",
		padding: "8px 12px",
		borderRadius: "4px",
		pointerEvents: "none",
		userSelect: "none",
		zIndex: "999",
		minWidth: "200px"
	});
	document.body.appendChild(el);

	let frameCount = 0;
	const update = () => {
		frameCount++;
		if (frameCount % 10 !== 0) return; // update text every 10 frames

		const m = perfMetrics;
		const fpsColor = m.fps >= 50 ? "#44ff88" : m.fps >= 30 ? "#ffaa44" : "#ff4444";

		el.textContent = [
			`FPS: ${m.fps}`,
			`Frame: ${m.frameMs.toFixed(1)}ms`,
			`Physics: ${m.physicsMs.toFixed(1)}ms (${m.physicsHz}Hz, ${m.physicsSteps} steps)`,
			`Render: ${m.renderMs.toFixed(1)}ms`,
			`Draw calls: ${m.drawCalls}`,
			`Triangles: ${m.triangles.toLocaleString()}`,
		].join("\n");
		el.style.whiteSpace = "pre";
		el.style.color = fpsColor;
	};

	return { element: el, update };
}

// ─── Escape menu ─────────────────────────────────────────────────────────────

type EscapeMenu = {
	element: HTMLDivElement;
	visible: boolean;
	show: () => void;
	hide: () => void;
	dispose: () => void;
};

function createEscapeMenu(domElement: HTMLCanvasElement): EscapeMenu {
	const overlay = document.createElement("div");
	overlay.id = "escape-menu";
	Object.assign(overlay.style, {
		position: "fixed",
		inset: "0",
		background: "rgba(0, 0, 0, 0.85)",
		display: "none",
		alignItems: "center",
		justifyContent: "center",
		flexDirection: "column",
		gap: "16px",
		zIndex: "1000",
		fontFamily: "'Courier New', monospace"
	});

	const title = document.createElement("div");
	Object.assign(title.style, {
		color: "#4488ff",
		fontSize: "28px",
		fontWeight: "bold",
		textShadow: "0 0 20px #4488ff66",
		marginBottom: "24px"
	});
	title.textContent = "STARGATE UNIVERSE";
	overlay.appendChild(title);

	const buttonStyle = {
		background: "rgba(68, 136, 255, 0.1)",
		border: "1px solid #4488ff44",
		color: "#88bbff",
		padding: "12px 32px",
		fontSize: "16px",
		fontFamily: "'Courier New', monospace",
		cursor: "pointer",
		minWidth: "220px",
		textAlign: "center"
	};

	const resumeBtn = document.createElement("button");
	Object.assign(resumeBtn.style, buttonStyle);
	resumeBtn.textContent = "Resume";
	resumeBtn.addEventListener("click", () => {
		menu.hide();
		void domElement.requestPointerLock();
	});
	overlay.appendChild(resumeBtn);

	const fullscreenBtn = document.createElement("button");
	Object.assign(fullscreenBtn.style, buttonStyle);
	fullscreenBtn.textContent = "Toggle Fullscreen";
	fullscreenBtn.addEventListener("click", () => {
		if (document.fullscreenElement) {
			void document.exitFullscreen();
			fullscreenBtn.textContent = "Enter Fullscreen";
		} else {
			void document.documentElement.requestFullscreen();
			fullscreenBtn.textContent = "Exit Fullscreen";
		}
	});
	overlay.appendChild(fullscreenBtn);

	const hintEl = document.createElement("div");
	Object.assign(hintEl.style, {
		color: "#4488ff66",
		fontSize: "12px",
		marginTop: "24px"
	});
	hintEl.textContent = "Click anywhere or press Resume to continue";
	overlay.appendChild(hintEl);

	document.body.appendChild(overlay);

	const menu: EscapeMenu = {
		element: overlay,
		visible: false,
		show() {
			menu.visible = true;
			overlay.style.display = "flex";
			fullscreenBtn.textContent = document.fullscreenElement
				? "Exit Fullscreen" : "Enter Fullscreen";
		},
		hide() {
			menu.visible = false;
			overlay.style.display = "none";
		},
		dispose() {
			overlay.remove();
		}
	};

	return menu;
}

// ─── Fullscreen + pointer lock integration ───────────────────────────────────

function setupFullscreen(domElement: HTMLCanvasElement, menu: EscapeMenu): () => void {
	const handlePointerLockChange = () => {
		if (document.pointerLockElement === domElement) {
			// Pointer lock acquired — go fullscreen if not already
			if (!document.fullscreenElement) {
				void document.documentElement.requestFullscreen().catch(() => {
					// Fullscreen may fail (user gesture required) — that's okay
				});
			}
			menu.hide();
		} else {
			// Pointer lock lost (ESC pressed) — show escape menu
			menu.show();
		}
	};

	document.addEventListener("pointerlockchange", handlePointerLockChange);

	return () => {
		document.removeEventListener("pointerlockchange", handlePointerLockChange);
	};
}

// ─── Scene mount ─────────────────────────────────────────────────────────────

async function mount(context: GameSceneModuleContext): Promise<GameSceneLifecycle> {
	const { scene, camera, player, renderer } = context;

	wallMeshes.length = 0;
	const debugObjects: THREE.Object3D[] = [];
	let debugMode = false;

	buildRoom(scene);
	const gate = buildStargate(scene);
	const lights = buildLighting(scene, debugObjects);
	gate.pointLights = lights;
	const hud = createHUD();
	const debug = createDebugOverlay();
	debug.element.style.display = "none"; // hidden by default
	const menu = createEscapeMenu(renderer.domElement);
	const cleanupFullscreen = setupFullscreen(renderer.domElement, menu);

	// Disable shadows — huge perf cost for a prototype
	renderer.shadowMap.enabled = false;

	const toggleDebug = () => {
		debugMode = !debugMode;
		debug.element.style.display = debugMode ? "block" : "none";
		for (const obj of debugObjects) {
			obj.visible = debugMode;
		}
	};

	// Track backtick presses for // toggle (two rapid Backquote presses)
	let lastBackquoteTime = 0;

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.code === "Backquote") {
			const now = performance.now();
			if (now - lastBackquoteTime < 400) {
				toggleDebug();
				lastBackquoteTime = 0;
			} else {
				lastBackquoteTime = now;
			}
			return;
		}
		if (e.code === "KeyG" && !menu.visible) {
			if (gate.state === "idle") {
				startDial(gate);
			} else if (gate.state === "active") {
				shutdownGate(gate);
			}
		}
	};
	window.addEventListener("keydown", handleKeyDown);

	return {
		update(delta: number) {
			updateGate(gate, delta);

			if (player) {
				updateWallTransparency(camera, player.object.position, delta);
			}

			debug.update();
		},
		dispose() {
			window.removeEventListener("keydown", handleKeyDown);
			cleanupFullscreen();
			hud.remove();
			debug.element.remove();
			menu.dispose();
			wallMeshes.length = 0;
		}
	};
}

// ─── Scene definition ────────────────────────────────────────────────────────

export const gateRoomScene = defineGameScene({
	id: "gate-room",
	source: createColocatedRuntimeSceneSource({
		assetUrlLoaders,
		manifestLoader: () => import("./scene.runtime.json?raw").then((module) => module.default)
	}),
	title: "Gate Room",
	mount
});
