import { createNoise2D } from "simplex-noise";
import alea from "alea";

// Canopy height parameters (in meters)
const MIN_HEIGHT = 15; // understory and small trees
const MAX_HEIGHT = 70; // emergent trees
const VARIATION = 0.3; // amount of local randomness

// Create a seeded noise generator for repeatability
const noise2D = createNoise2D(alea("amazon-canopy"));

/**
 * Returns a simulated canopy height (in meters) for a given (x, y) in meters.
 * Nearby points will produce similar heights.
 * @param x - X coordinate in meters
 * @param y - Y coordinate in meters
 */
export function getCanopyHeight(x: number, y: number): number {
    // Large scale variation: patchy clusters of taller trees (~200m patch size)
    const largeScale = noise2D(x / 100, y / 100);

    // Small scale variation: individual tree-to-tree differences
    const smallScale = noise2D(x / 10, y / 10) * VARIATION;

    // Map noise [-1, 1] → [0, 1]
    const normalized = (largeScale * (1 - VARIATION) + smallScale + 1) / 2;

    // Scale to canopy height range
    return MIN_HEIGHT + normalized * (MAX_HEIGHT - MIN_HEIGHT);
}
