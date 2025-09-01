import fs from "fs";
import path from "path";
import zlib from "zlib";
import { RealisticSimulationGenerator } from "./modules/RealisticSimulationGenerator";

// === CONFIGURATION ===
const config = {
    width: 1000,
    height: 1000,
    originLon: -74.0,
    originLat: 40.7,
    chunkSize: 64, // chunk dimension in cells (chunkSize x chunkSize)
};

// Create simulator instance
const simulator = new RealisticSimulationGenerator(config);

// Output directory (outside config)
const outputDir = path.resolve(__dirname, "../output/data64");
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Total chunks in X and Y directions
const totalChunksX = Math.ceil(config.width / config.chunkSize);
const totalChunksY = Math.ceil(config.height / config.chunkSize);

// Helper: convert cell offset to longitude/latitude degrees (bottom-left corner)
function metersToLatDegrees(meters: number): number {
    const EARTH_RADIUS = 6378137;
    return (meters / EARTH_RADIUS) * (180 / Math.PI);
}

function metersToLonDegrees(meters: number, atLat: number): number {
    const EARTH_RADIUS = 6378137;
    return (meters / (EARTH_RADIUS * Math.cos((atLat * Math.PI) / 180))) * (180 / Math.PI);
}

function cellToLonLat(x: number, y: number, originLon: number, originLat: number): [number, number] {
    const lon = originLon + metersToLonDegrees(x, originLat);
    const lat = originLat + metersToLatDegrees(y);
    return [lon, lat];
}

// Store info for metadata
const chunksMetaLookup: Array<Array<{
    file: string;
    minH: number;
    maxH: number;
    availability_rate: number;
    occupancy_rate: number;
} | null>> = Array.from({ length: totalChunksY }, () =>
    Array(totalChunksX).fill(null)
);

// Process chunks
for (let row = 0; row < totalChunksY; row++) {
    for (let col = 0; col < totalChunksX; col++) {
        const chunkWidth = Math.min(config.chunkSize, config.width - col * config.chunkSize);
        const chunkHeight = Math.min(config.chunkSize, config.height - row * config.chunkSize);

        const baseX = col * config.chunkSize;
        const baseY = row * config.chunkSize;

        const [chunkLon, chunkLat] = cellToLonLat(baseX, baseY, config.originLon, config.originLat);

        const cells: Array<{
            a: number;
            o?: number;
            minH?: number;
            maxH?: number;
        }> = [];

        let minChunkHeight = Infinity;
        let maxChunkHeight = -Infinity;
        let availableCount = 0;
        let owned = 0;
        const totalCells = chunkWidth * chunkHeight;

        for (let y = 0; y < chunkHeight; y++) {
            for (let x = 0; x < chunkWidth; x++) {
                const globalX = baseX + x;
                const globalY = baseY + y;

                const available = simulator.generateAvailability(globalX, globalY);
                const cell: { a: number; o?: number; minH?: number; maxH?: number } = { a: available };

                if (available) {
                    availableCount++;
                    cell.o = simulator.generateOwner(globalX, globalY);
                    if (cell.o > 0) owned++;

                    const { minH, maxH } = simulator.elevationData(globalX, globalY);
                    cell.minH = Math.round(minH);
                    cell.maxH = Math.round(maxH);

                    if (cell.minH < minChunkHeight) minChunkHeight = cell.minH;
                    if (cell.maxH > maxChunkHeight) maxChunkHeight = cell.maxH;
                }

                cells.push(cell);
            }
        }

        const chunkObj = {
            lon: chunkLon,
            lat: chunkLat,
            width: chunkWidth,
            height: chunkHeight,
            cells,
        };

        const jsonString = JSON.stringify(chunkObj);
        const gzippedJSON = zlib.gzipSync(jsonString);

        console.log(`JSON Size: ${Buffer.byteLength(jsonString)} bytes`);
        console.log(`GZIP JSON Size: ${Buffer.byteLength(gzippedJSON)} bytes`);

        const filenameJSON = `g-r${row}c${col}.json.gz`;
        const filepathJSON = path.join(outputDir, filenameJSON);
        fs.writeFileSync(filepathJSON, gzippedJSON);

        console.log(`Saved chunk row=${row} col=${col}: ${filenameJSON} (${gzippedJSON.length} bytes compressed)`);

        chunksMetaLookup[row][col] = {
            file: filenameJSON,
            minH: minChunkHeight,
            maxH: maxChunkHeight,
            availability_rate: availableCount / totalCells,
            occupancy_rate: owned / (availableCount || 1), // avoid division by 0
        };
    }
}

// Overall bounding box
const [minLon, minLat] = cellToLonLat(0, 0, config.originLon, config.originLat);
const [maxLon, maxLat] = cellToLonLat(config.width, config.height, config.originLon, config.originLat);

const metadata = {
    originLon: config.originLon,
    originLat: config.originLat,
    width: config.width,
    height: config.height,
    chunkSize: config.chunkSize,
    totalChunksX,
    totalChunksY,
    boundingBox: [minLon, minLat, maxLon, maxLat],
    lookup: chunksMetaLookup,
};

const metadataPath = path.join(outputDir, "grid-metadata.json");
fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

console.log("Saved metadata:", metadataPath);
