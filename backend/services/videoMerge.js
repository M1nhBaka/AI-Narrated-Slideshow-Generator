// services/videoMerger.js
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const fs = require("fs").promises;
const path = require("path");

ffmpeg.setFfmpegPath(ffmpegPath);

const OUTPUT_DIR = path.join(__dirname, "../output/final");
const TEMP_DIR = path.join(__dirname, "../output/temp");

async function ensureDirectories() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(TEMP_DIR, { recursive: true });
}

/**
 * Merge multiple video clips into one final video
 */
async function mergeVideos(scenes, backgroundMusic = null, options = {}) {
  try {
    await ensureDirectories();

    console.log(`Merging ${scenes.length} scenes into final video...`);

    // Prepare file list for concatenation
    const videoListPath = path.join(TEMP_DIR, `concat_${Date.now()}.txt`);

    // Create intermediate videos with audio
    const processedScenes = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const videoPath = path.join(__dirname, "..", scene.videoUrl);
      const audioPath = scene.audioUrl
        ? path.join(__dirname, "..", scene.audioUrl)
        : null;

      // Ensure every clip has an audio stream
      if (audioPath) {
        const outputPath = path.join(TEMP_DIR, `scene_${i}_with_audio.mp4`);
        await mergeVideoWithAudio(
          videoPath,
          audioPath,
          outputPath,
          scene.duration
        );
        processedScenes.push(outputPath);
      } else {
        // add silent audio track so downstream filters can always reference audio
        const outputPath = path.join(TEMP_DIR, `scene_${i}_silent_audio.mp4`);
        await addSilentAudio(videoPath, outputPath, scene.duration);
        processedScenes.push(outputPath);
      }
    }

    // Create concat file
    const concatList = processedScenes.map((p) => `file '${p}'`).join("\n");
    await fs.writeFile(videoListPath, concatList);

    // Output path
    const outputFilename = `final_video_${Date.now()}.mp4`;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);

    return new Promise((resolve, reject) => {
      let command = ffmpeg();

      if (processedScenes.length === 1) {
        // Single scene: just re-encode to final settings
        command = command.input(processedScenes[0]);
      } else {
        // Multiple scenes: use concat demuxer (no transitions)
        command = command
          .input(videoListPath)
          .inputOptions(["-f concat", "-safe 0"]);
      }

      // Optional background music (simple mix for single scene only)
      if (backgroundMusic && processedScenes.length === 1) {
        const musicPath = path.join(__dirname, "..", backgroundMusic);
        command = command
          .input(musicPath)
          .complexFilter([
            "[1:a]volume=0.3[music]",
            "[0:a][music]amix=inputs=2:duration=shortest[a]",
          ])
          .outputOptions(["-map 0:v", "-map [a]"]);
      }

      command
        .outputOptions([
          "-c:v libx264",
          "-preset medium",
          "-crf 23",
          "-c:a aac",
          "-b:a 128k",
          "-ar 44100",
          "-pix_fmt yuv420p",
          "-movflags +faststart",
        ])
        .output(outputPath)
        .on("start", (commandLine) => {
          console.log("FFmpeg command:", commandLine);
        })
        .on("progress", (progress) => {
          console.log(
            `Processing: ${
              progress.percent ? progress.percent.toFixed(2) : 0
            }% done`
          );
        })
        .on("end", async () => {
          console.log("Video merge completed successfully");
          await cleanupTempFiles(processedScenes, videoListPath);
          resolve(`/output/final/${outputFilename}`);
        })
        .on("error", (error) => {
          console.error("FFmpeg merge error:", error);
          reject(error);
        })
        .run();
    });
  } catch (error) {
    console.error("Video merge failed:", error);
    throw new Error(`Failed to merge videos: ${error.message}`);
  }
}

/**
 * Merge single video with audio
 */
async function mergeVideoWithAudio(videoPath, audioPath, outputPath, duration) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions([
        "-c:v copy",
        "-c:a aac",
        "-b:a 128k",
        "-shortest",
        "-t",
        duration.toString(),
      ])
      .output(outputPath)
      .on("end", () => {
        console.log(`Merged video with audio: ${path.basename(outputPath)}`);
        resolve(outputPath);
      })
      .on("error", reject)
      .run();
  });
}

/**
 * Add a silent audio track to a video so it always has an audio stream
 */
async function addSilentAudio(videoPath, outputPath, duration) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .inputOptions([])
      .input("anullsrc=channel_layout=stereo:sample_rate=44100")
      .inputFormat("lavfi")
      .outputOptions([
        "-c:v copy",
        "-shortest",
        "-t",
        duration.toString(),
        "-c:a aac",
        "-b:a 128k",
      ])
      .output(outputPath)
      .on("end", () => {
        console.log(`Added silent audio: ${path.basename(outputPath)}`);
        resolve(outputPath);
      })
      .on("error", reject)
      .run();
  });
}

/**
 * Add subtitles to video
 */
async function addSubtitles(videoPath, subtitles, outputPath) {
  // Create SRT file
  const srtContent = subtitles
    .map((sub, idx) => {
      const start = formatTime(sub.startTime);
      const end = formatTime(sub.endTime);
      return `${idx + 1}\n${start} --> ${end}\n${sub.text}\n`;
    })
    .join("\n");

  const srtPath = path.join(TEMP_DIR, `subtitles_${Date.now()}.srt`);
  await fs.writeFile(srtPath, srtContent);

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .outputOptions([
        `-vf subtitles=${srtPath}:force_style='FontName=Arial,FontSize=24,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,Outline=2'`,
        "-c:a copy",
      ])
      .output(outputPath)
      .on("end", async () => {
        await fs.unlink(srtPath).catch(console.error);
        resolve(outputPath);
      })
      .on("error", reject)
      .run();
  });
}

/**
 * Format time for SRT format
 */
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

/**
 * Add background music to video
 */
async function addBackgroundMusic(
  videoPath,
  musicPath,
  outputPath,
  volume = 0.3
) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(musicPath)
      .complexFilter([
        "[1:a]volume=" + volume + "[music]",
        "[0:a][music]amix=inputs=2:duration=shortest[a]",
      ])
      .outputOptions([
        "-c:v copy",
        "-map 0:v",
        "-map [a]",
        "-c:a aac",
        "-b:a 192k",
      ])
      .output(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", reject)
      .run();
  });
}

/**
 * Cleanup temporary files
 */
async function cleanupTempFiles(files, ...additionalFiles) {
  const allFiles = [...files, ...additionalFiles].filter(Boolean);

  for (const file of allFiles) {
    try {
      await fs.unlink(file);
      console.log(`Cleaned up: ${file}`);
    } catch (error) {
      console.warn(`Failed to cleanup ${file}:`, error.message);
    }
  }
}

/**
 * Get video metadata
 */
function getVideoMetadata(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata);
    });
  });
}

module.exports = {
  mergeVideos,
  mergeVideoWithAudio,
  addSubtitles,
  addBackgroundMusic,
  getVideoMetadata,
};
