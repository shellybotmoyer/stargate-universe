/**
 * VRM Character Manager — orchestrates VRM character loading, LOD, spring
 * bones, expressions, and per-frame updates for all active characters.
 *
 * This is the top-level system that the game shell and player controller
 * interact with. It manages both the player VRM and crew NPC VRMs.
 *
 * @see design/gdd/vrm-model-integration.md
 */
import type { VRM } from "@pixiv/three-vrm";
import { VRMFirstPerson } from "@pixiv/three-vrm-core";
import {
	CapsuleGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
	PerspectiveCamera,
	Vector3,
	type Object3D,
} from "three";

import { emit } from "../event-bus";
import { getVrmConfig, type VrmConfig } from "./vrm-config";
import { VrmExpressionController } from "./vrm-expression-controller";
import { loadVrm, type VrmLoadResult } from "./vrm-loader";

// ─── Types ──────────────────────────────────────────────────────────────────

export type LodTier = "near" | "mid" | "far";

export type VrmCharacterOptions = {
	/** Unique character ID (e.g., "eli-wallace", "nicholas-rush"). */
	readonly id: string;
	/** Path to the `.vrm` file. */
	readonly vrmUrl: string;
	/** Whether this is the player character. */
	readonly isPlayer?: boolean;
	/** Loading priority (0 = highest, player default). */
	readonly priority?: number;
};

export type VrmCharacterInstance = {
	readonly id: string;
	readonly vrmUrl: string;
	readonly isPlayer: boolean;
	readonly root: Group;
	vrm: VRM | undefined;
	expressionController: VrmExpressionController | undefined;
	lodTier: LodTier;
	springBonesActive: boolean;
	firstPersonSetup: boolean;
	loading: boolean;
	failed: boolean;
	/** Capsule fallback mesh, shown until VRM loads (or on failure). */
	readonly fallbackMesh: Mesh;
};

// ─── Manager ────────────────────────────────────────────────────────────────

const characters = new Map<string, VrmCharacterInstance>();
const scratchPos = new Vector3();
const scratchCharPos = new Vector3();

/** The camera used for LOD distance calculations. */
let activeCamera: PerspectiveCamera | undefined;

/** Whether adaptive quality is currently active (low FPS detected). */
let adaptiveQualityActive = false;

/**
 * Set the camera used for LOD distance calculations.
 * Must be called before `update()` to enable LOD.
 */
export function setActiveCamera(camera: PerspectiveCamera): void {
	activeCamera = camera;
}

/**
 * Register and begin loading a VRM character.
 * Returns the character's root Group immediately (may show fallback capsule
 * until the VRM finishes loading).
 */
export function addCharacter(options: VrmCharacterOptions): VrmCharacterInstance {
	const existing = characters.get(options.id);

	if (existing) {
		return existing;
	}

	const root = new Group();
	root.name = `vrm-character-${options.id}`;

	const fallbackMesh = createFallbackCapsule();
	root.add(fallbackMesh);

	const instance: VrmCharacterInstance = {
		id: options.id,
		vrmUrl: options.vrmUrl,
		isPlayer: options.isPlayer ?? false,
		root,
		vrm: undefined,
		expressionController: undefined,
		lodTier: "near",
		springBonesActive: true,
		firstPersonSetup: false,
		loading: true,
		failed: false,
		fallbackMesh,
	};

	characters.set(options.id, instance);

	// Begin async load
	loadVrm(options.vrmUrl, options.priority ?? (options.isPlayer ? 0 : 1))
		.then((result) => onVrmLoaded(instance, result))
		.catch((error) => onVrmFailed(instance, error));

	return instance;
}

/**
 * Remove a character and dispose its VRM resources.
 */
export function removeCharacter(id: string): void {
	const instance = characters.get(id);

	if (!instance) return;

	if (instance.vrm) {
		instance.root.remove(instance.vrm.scene);
	}

	instance.root.remove(instance.fallbackMesh);
	disposeFallbackCapsule(instance.fallbackMesh);
	characters.delete(id);
}

/**
 * Get a character instance by ID.
 */
export function getCharacter(id: string): VrmCharacterInstance | undefined {
	return characters.get(id);
}

/**
 * Get all active character instances.
 */
export function getAllCharacters(): ReadonlyMap<string, VrmCharacterInstance> {
	return characters;
}

/**
 * Update all VRM characters: LOD evaluation, spring bones, expressions.
 * Call once per frame from the game loop.
 *
 * @param delta Frame delta in seconds
 * @param fps   Current FPS (for adaptive quality)
 */
export function update(delta: number, fps: number): void {
	const config = getVrmConfig();

	// Adaptive quality check
	adaptiveQualityActive = fps > 0 && fps < config.quality.adaptiveThresholdFps;

	for (const [, instance] of characters) {
		if (!instance.vrm) continue;

		updateLod(instance, config);
		updateSpringBones(instance, delta, config);
		updateExpressions(instance, delta);
		updateVrm(instance, delta);
	}
}

/**
 * Set first-person mode on the player character.
 * Hides head mesh via VRM first-person layers.
 *
 * @param isFirstPerson Whether the camera is in FPS mode
 * @param camera        The active camera to configure layers on
 */
export function setFirstPersonMode(isFirstPerson: boolean, camera: PerspectiveCamera): void {
	for (const [, instance] of characters) {
		if (!instance.isPlayer || !instance.vrm) continue;

		// Set up first-person layers if not done yet
		if (!instance.firstPersonSetup && instance.vrm.firstPerson) {
			instance.vrm.firstPerson.setup();
			instance.firstPersonSetup = true;
		}

		if (!instance.vrm.firstPerson) continue;

		const fpLayer = instance.vrm.firstPerson.firstPersonOnlyLayer;
		const tpLayer = instance.vrm.firstPerson.thirdPersonOnlyLayer;

		if (isFirstPerson) {
			camera.layers.enable(fpLayer);
			camera.layers.disable(tpLayer);
		} else {
			camera.layers.disable(fpLayer);
			camera.layers.enable(tpLayer);
		}
	}
}

/**
 * Dispose all characters and reset state.
 */
export function dispose(): void {
	for (const [id] of characters) {
		removeCharacter(id);
	}

	characters.clear();
	activeCamera = undefined;
	adaptiveQualityActive = false;
}

// ─── Internal: Load Handlers ────────────────────────────────────────────────

function onVrmLoaded(instance: VrmCharacterInstance, result: VrmLoadResult): void {
	instance.vrm = result.vrm;
	instance.loading = false;
	instance.expressionController = new VrmExpressionController(result.vrm);

	// Add VRM scene to the character root
	instance.root.add(result.vrm.scene);

	// Hide fallback capsule
	instance.fallbackMesh.visible = false;

	// Emit load event
	emit("character:model:loaded", { characterId: instance.id });

	console.info(`[VrmCharacterManager] Loaded VRM for "${instance.id}" from ${result.url}`);
}

function onVrmFailed(instance: VrmCharacterInstance, error: unknown): void {
	instance.loading = false;
	instance.failed = true;

	// Keep fallback capsule visible
	instance.fallbackMesh.visible = true;

	console.error(
		`[VrmCharacterManager] Failed to load VRM for "${instance.id}". ` +
		`Falling back to capsule.`,
		error
	);
}

// ─── Internal: Per-Frame Updates ────────────────────────────────────────────

function updateLod(instance: VrmCharacterInstance, config: VrmConfig): void {
	if (!activeCamera) {
		instance.lodTier = "near";
		return;
	}

	activeCamera.getWorldPosition(scratchPos);
	instance.root.getWorldPosition(scratchCharPos);
	const distance = scratchPos.distanceTo(scratchCharPos);

	const lodConfig = config.lod;

	if (distance < lodConfig.nearDistance) {
		instance.lodTier = "near";
	} else if (distance < lodConfig.midDistance) {
		instance.lodTier = "mid";
	} else {
		instance.lodTier = "far";
	}

	// Player always stays at near LOD (camera is on them)
	if (instance.isPlayer) {
		instance.lodTier = "near";
	}

	// Adaptive quality override
	if (adaptiveQualityActive && !instance.isPlayer) {
		if (instance.lodTier === "near") {
			instance.lodTier = "mid";
		}
	}
}

function updateSpringBones(instance: VrmCharacterInstance, _delta: number, config: VrmConfig): void {
	const shouldBeActive =
		config.springBone.enabled &&
		instance.lodTier === "near" &&
		!adaptiveQualityActive;

	instance.springBonesActive = shouldBeActive;
}

function updateExpressions(instance: VrmCharacterInstance, delta: number): void {
	if (!instance.expressionController) return;

	const isActive = instance.lodTier === "near";
	instance.expressionController.setEnabled(isActive);

	if (isActive) {
		instance.expressionController.update(delta);
	}
}

function updateVrm(instance: VrmCharacterInstance, delta: number): void {
	if (!instance.vrm) return;

	const config = getVrmConfig();

	// Clamp delta for spring bone stability (prevents explosion after alt-tab)
	const clampedDelta = Math.min(delta, config.springBone.maxDeltaSeconds);

	// VRM.update() steps spring bones, constraints, materials, and expressions
	// If spring bones should be frozen, we skip the update (they hold position)
	if (instance.springBonesActive) {
		instance.vrm.update(clampedDelta);
	} else {
		// Update expressions and materials only (skip spring bones)
		instance.vrm.expressionManager?.update();
	}
}

// ─── Internal: Fallback Capsule ─────────────────────────────────────────────

function createFallbackCapsule(): Mesh {
	const mesh = new Mesh(
		new CapsuleGeometry(0.3, 1.0, 4, 12),
		new MeshStandardMaterial({
			color: "#7dd3fc",
			emissive: "#0f4c81",
			emissiveIntensity: 0.12,
			roughness: 0.62,
		})
	);

	mesh.castShadow = true;
	mesh.receiveShadow = true;
	mesh.name = "vrm-fallback-capsule";
	return mesh;
}

function disposeFallbackCapsule(mesh: Mesh): void {
	mesh.geometry.dispose();
	(mesh.material as MeshStandardMaterial).dispose();
}
