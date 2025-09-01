import { getCanopyHeight } from "./Canopy";

interface Config {
    width: number;
    height: number;
}

interface ElevationData {
    minH: number;
    maxH: number;
}

export class SimulationGenerator {
    private config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    /** Checkerboard availability on 10x10 blocks */
    generateAvailability(x: number, y: number): number {
        return ((Math.floor(x / 10) + Math.floor(y / 10)) % 2) === 0 ? 1 : 0;
    }

    // Determine owner
    generateOwner(x: number, y: number): number {
        return 0;
    }

    /** Compute min/max elevation using waves, hill, and canopy height */
    elevationData(globalX: number, globalY: number): ElevationData {
        const { width, height } = this.config;
        const wave = Math.sin(globalX / 30) * 5 + Math.cos(globalY / 40) * 3;
        const hill =
            20 *
            Math.exp(
                -((globalX - width / 2) ** 2 + (globalY - height / 2) ** 2) / 40000
            );
        const minH = 10 + wave + hill;
        const maxH = minH + getCanopyHeight(globalX, globalY);

        return { minH, maxH };
    }
}
