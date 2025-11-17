// services/videoGenerator.js
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");

ffmpeg.setFfmpegPath(ffmpegPath);

const VIDEOS_DIR = path.join(__dirname, "../output/videos");

async function ensureDir() {
  await fsp.mkdir(VIDEOS_DIR, { recursive: true });
}

/**
 * Create a short motion clip (pan/zoom) from a source image.
 * This substitutes for a true video-gen API to keep MVP fully runnable.
 */
async function generateVideoFromImage(imageUrl, action = "") {
  await ensureDir();

  const srcPath = path.join(__dirname, "..", imageUrl);
  const filename = `scene_${Date.now()}.mp4`;
  const outPath = path.join(VIDEOS_DIR, filename);

  // Choose motion preset based on action text
  const motion = /track|walk|run|pan/i.test(action)
    ? "zoompan=z='min(zoom+0.0015,1.2)':d=125:s=1920x1080,framerate=30:interp_start=0:interp_end=255:scene=100"
    : "zoompan=z='min(zoom+0.001,1.15)':d=150:s=1920x1080,framerate=30";

  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(srcPath)
      .loop(5)
      .videoFilters([motion])
      .outputOptions([
        "-c:v libx264",
        "-preset veryfast",
        "-crf 23",
        "-pix_fmt yuv420p",
        "-movflags +faststart",
      ])
      .duration(5)
      .save(outPath)
      .on("end", resolve)
      .on("error", reject);
  });

  return `/output/videos/${filename}`;
}

module.exports = { generateVideoFromImage };
