import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

const MAX_TOTAL_CLIENT_BYTES = 1_500_000;
const MAX_ROOT_CHUNK_BYTES = 550_000;
const MAX_SKILLS_CHUNK_BYTES = 450_000;
const assetDirectory = join(process.cwd(), ".output/public/assets");

const startedAt = performance.now();
const build = spawnSync("bun", ["run", "build:dev"], { stdio: "inherit" });
if (build.error || build.status !== 0) {
  process.exitCode = build.status ?? 1;
  throw build.error ?? new Error(`build:dev exited with ${build.status}`);
}

const assets = readdirSync(assetDirectory)
  .filter((name) => /\.(js|css)$/.test(name))
  .map((name) => ({ name, bytes: statSync(join(assetDirectory, name)).size }))
  .sort((left, right) => right.bytes - left.bytes);
const totalBytes = assets.reduce((sum, asset) => sum + asset.bytes, 0);
const rootChunk = assets.find((asset) => asset.name.startsWith("index-"));
const skillsChunk = assets.find((asset) => asset.name.startsWith("skills-"));
const jsAssets = assets.filter((asset) => asset.name.endsWith(".js"));
const rechartsChunks = jsAssets.filter((asset) => {
  const content = readFileSync(join(assetDirectory, asset.name), "utf8");
  return /recharts|RadarChart|PolarGrid/.test(content);
});

const sharedRechartsViolations = rechartsChunks
  .filter((asset) => !asset.name.startsWith("skills-"))
  .map((asset) => asset.name);
const violations = [
  totalBytes > MAX_TOTAL_CLIENT_BYTES
    ? `client assets exceed ${MAX_TOTAL_CLIENT_BYTES} bytes`
    : null,
  !rootChunk
    ? "root client chunk is missing"
    : rootChunk.bytes > MAX_ROOT_CHUNK_BYTES
      ? `root chunk exceeds ${MAX_ROOT_CHUNK_BYTES} bytes`
      : null,
  !skillsChunk
    ? "Skills client chunk is missing"
    : skillsChunk.bytes > MAX_SKILLS_CHUNK_BYTES
      ? `Skills chunk exceeds ${MAX_SKILLS_CHUNK_BYTES} bytes`
      : null,
  rechartsChunks.length !== 1
    ? `expected one Recharts chunk, found ${rechartsChunks.length}`
    : null,
  sharedRechartsViolations.length > 0
    ? `Recharts leaked into shared chunks: ${sharedRechartsViolations.join(", ")}`
    : null,
].filter((value): value is string => value != null);

const report = {
  generatedAt: new Date().toISOString(),
  buildDurationMs: Math.round(performance.now() - startedAt),
  clientAssetCount: assets.length,
  clientAssetBytes: totalBytes,
  rootChunk,
  skillsChunk,
  rechartsChunks: rechartsChunks.map((asset) => asset.name),
  largestAssets: assets.slice(0, 10),
  budgets: {
    maxTotalClientBytes: MAX_TOTAL_CLIENT_BYTES,
    maxRootChunkBytes: MAX_ROOT_CHUNK_BYTES,
    maxSkillsChunkBytes: MAX_SKILLS_CHUNK_BYTES,
  },
  violations,
};

console.log(JSON.stringify(report, null, 2));
if (process.env.BUILD_HEALTH_OUTPUT) {
  writeFileSync(process.env.BUILD_HEALTH_OUTPUT, `${JSON.stringify(report, null, 2)}\n`);
}
if (violations.length > 0) process.exitCode = 1;
