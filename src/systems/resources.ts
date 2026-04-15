/**
 * Resource & Inventory System — tracks all resources in the ship-wide pool.
 *
 * Simple key-value store for MVP. No carry limits, no weight.
 * @see design/gdd/resource-inventory.md
 */
import { emit } from "./event-bus";

export const RESOURCE_TYPES = ["ship-parts", "water", "food", "lime"] as const;
export type ResourceType = typeof RESOURCE_TYPES[number];

const resources = new Map<ResourceType, number>();

/** Initialize with starting amounts */
export function initResources(): void {
	resources.set("ship-parts", 10);
	resources.set("water", 50);
	resources.set("food", 40);
	resources.set("lime", 20);
}

/** Get current amount of a resource */
export function getResource(type: ResourceType): number {
	return resources.get(type) ?? 0;
}

/** Get all resources as a record */
export function getAllResources(): Record<ResourceType, number> {
	const result = {} as Record<ResourceType, number>;
	for (const type of RESOURCE_TYPES) {
		result[type] = resources.get(type) ?? 0;
	}
	return result;
}

/** Add resources to the pool. Returns new total. */
export function addResource(type: ResourceType, amount: number): number {
	const current = resources.get(type) ?? 0;
	const newAmount = current + amount;
	resources.set(type, newAmount);

	emit("resource:collected", { type, amount, source: "pickup" });
	return newAmount;
}

/** Consume resources. Returns true if successful, false if insufficient. */
export function consumeResource(type: ResourceType, amount: number): boolean {
	const current = resources.get(type) ?? 0;
	if (current < amount) return false;

	const newAmount = current - amount;
	resources.set(type, newAmount);

	emit("resource:consumed", { type, amount, consumer: "repair" });

	if (newAmount === 0) {
		emit("resource:depleted", { type });
	}

	return true;
}

/** Check if we have enough of a resource */
export function hasResource(type: ResourceType, amount: number): boolean {
	return (resources.get(type) ?? 0) >= amount;
}

/** Serialization */
export const saveId = "resources";

export function serialize(): Record<string, unknown> {
	const data: Record<string, number> = {};
	for (const [key, val] of resources) {
		data[key] = val;
	}
	return { version: 1, resources: data };
}

export function deserialize(data: Record<string, unknown>): void {
	const saved = data.resources as Record<string, number> | undefined;
	if (!saved) return;
	for (const type of RESOURCE_TYPES) {
		if (type in saved) {
			resources.set(type, saved[type]);
		}
	}
}
