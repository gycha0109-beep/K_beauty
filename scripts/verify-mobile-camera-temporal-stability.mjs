import { readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const frameDir = resolve(process.argv[2] || "");
const outputPath = resolve(
  process.argv[3] || "apps/mobile/.mobile-native-artifacts/camera-temporal-stability.json"
);
const frameNames = readdirSync(frameDir)
  .filter((name) => /^frame-\d+\.png$/.test(name))
  .sort();

if (frameNames.length < 20) {
  console.error(`MOBILE_CAMERA_TEMPORAL_STABILITY=FAIL insufficient_frames=${frameNames.length}`);
  process.exit(1);
}

const metrics = [];
for (const name of frameNames) {
  const input = resolve(frameDir, name);
  const metadata = await sharp(input).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;

  if (width < 100 || height < 100) {
    console.error(`MOBILE_CAMERA_TEMPORAL_STABILITY=FAIL invalid_frame=${name}`);
    process.exit(1);
  }

  const left = Math.floor(width * 0.2);
  const top = Math.floor(height * 0.2);
  const roiWidth = Math.max(1, Math.floor(width * 0.6));
  const roiHeight = Math.max(1, Math.floor(height * 0.55));
  const { data } = await sharp(input)
    .extract({ left, top, width: roiWidth, height: roiHeight })
    .resize(64, 96, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let sum = 0;
  let white = 0;
  for (const value of data) {
    sum += value;
    if (value >= 245) white += 1;
  }

  metrics.push({
    frame: name,
    meanLuma: sum / data.length,
    whiteRatio: white / data.length
  });
}

const sortedLuma = metrics.map((entry) => entry.meanLuma).sort((a, b) => a - b);
const medianLuma = sortedLuma[Math.floor(sortedLuma.length / 2)];
const flashes = metrics.filter(
  (entry) =>
    entry.meanLuma >= 245 &&
    entry.whiteRatio >= 0.9 &&
    entry.meanLuma - medianLuma >= 30
);

const report = {
  frameCount: metrics.length,
  medianLuma: Number(medianLuma.toFixed(3)),
  maxMeanLuma: Number(Math.max(...metrics.map((entry) => entry.meanLuma)).toFixed(3)),
  maxWhiteRatio: Number(Math.max(...metrics.map((entry) => entry.whiteRatio)).toFixed(5)),
  flashFrames: flashes.map((entry) => entry.frame),
  verdict: flashes.length === 0 ? "PASS" : "FAIL"
};

writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n");

if (flashes.length > 0) {
  console.error(
    `MOBILE_CAMERA_TEMPORAL_STABILITY=FAIL flash_frames=${flashes.map((entry) => entry.frame).join(",")}`
  );
  process.exit(1);
}

console.log(
  `MOBILE_CAMERA_TEMPORAL_STABILITY=PASS frames=${metrics.length} median_luma=${report.medianLuma}`
);
