// Terrain generation helpers
import { getCanopyHeight } from './Canopy';

export interface SimulationConfig {
    width: number;        // total width in cells
    height: number;       // total height in cells
    originLon: number;    // longitude
    originLat: number;    // latitude
    chunkSize: number;    // chunk dimension in cells
}

export interface Elevation {
    minH: number;
    maxH: number;
}

export class RealisticSimulationGenerator {
    config: SimulationConfig;

    constructor(config: SimulationConfig) {
        this.config = config;
        this.init();
    }

    // Smooth noise function
    smoothNoise(x: number, y: number): number {
        return (
            Math.sin(x / 90) * 0.5 +
            Math.cos(y / 70) * 0.5 +
            Math.sin((x + y) / 100) * 0.25
        );
    }

    // Determine availability
    generateAvailability(x: number, y: number): 0 | 1 {
        return 1;
    }

    // Determine owner
    generateOwner(x: number, y: number): number {
        const { width, height } = this.config;
        const totalOwners = 10;     // owners 1..10
        const freeLandChance = 0.15;
        const fieldSize = 20;

        const clusterX = Math.floor(x / fieldSize);
        const clusterY = Math.floor(y / fieldSize);

        const seed = (clusterX * 73856093) ^ (clusterY * 19349663);
        const rand = mulberry32(seed);

        if (rand() < freeLandChance) return 0;
        return Math.floor(rand() * totalOwners) + 1;
    }

    // Calculate elevation
    elevationData(globalX: number, globalY: number): Elevation {
        const { width, height } = this.config;
        const wave = Math.sin(globalX / 30) * 5 + Math.cos(globalY / 40) * 3;
        const hill = 20 * Math.exp(-((globalX - width / 2) ** 2 + (globalY - height / 2) ** 2) / 40000);
        const minH = 10 + wave + hill;
        const maxH = minH + getCanopyHeight(globalX, globalY);
        return { minH, maxH };
    }

    // Initialize sold map
    init(): void {
        const { width, height } = this.config;
        const soldMap: number[][] = Array.from({ length: height }, () => Array(width).fill(0));
        const soldProbability = 0.01;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (Math.random() < soldProbability) {
                    soldMap[y][x] = 1;

                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const nx = x + dx;
                            const ny = y + dy;
                            if (nx >= 0 && ny >= 0 && nx < width && ny < height && Math.random() < 0.6) {
                                soldMap[ny][nx] = 1;
                            }
                        }
                    }
                }
            }
        }
    }
}

// Deterministic PRNG
function mulberry32(a: number): () => number {
    return function () {
        let t = (a += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
