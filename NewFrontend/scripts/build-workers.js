import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Get current file directory (ES modules don't have __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const workerSrc = path.resolve(
  __dirname,
  "../src/features/auth/workers/AuthSharedWorker.ts"
);
const publicDir = path.resolve(__dirname, "../public");
const workerDest = path.resolve(publicDir, "AuthSharedWorker.js");

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Run esbuild to bundle the worker
try {
  console.log("Building AuthSharedWorker...");
  execSync(
    `npx esbuild ${workerSrc} --bundle --outfile=${workerDest} --format=iife --target=es2015`
  );
  console.log(`SharedWorker built successfully: ${workerDest}`);
} catch (error) {
  console.error("Error building SharedWorker:", error);
  process.exit(1);
}
