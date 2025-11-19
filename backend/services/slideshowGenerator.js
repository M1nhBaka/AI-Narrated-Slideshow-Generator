// services/slideshowGenerator.js
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const ffprobePath = require("ffprobe-static").path;
const fs = require("fs").promises;
const path = require("path");

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const OUTPUT_DIR = path.join(__dirname, "../output/final");
const TEMP_DIR = path.join(__dirname, "../output/temp");

async function ensureDirectories() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(TEMP_DIR, { recursive: true });
}

/**
 * Get audio duration in seconds
 */
function getAudioDuration(audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) {
        console.warn(
          "Could not probe audio, using default duration:",
          err.message
        );
        resolve(5); // Default 5 seconds
      } else {
        const duration = metadata.format.duration || 5;
        resolve(duration);
      }
    });
  });
}

/**
 * Create slideshow video from images with narration
 * Each image displays for the duration of its audio narration
 *
 * @param {Array} scenes - Array of scene objects with imageUrl, audioUrl, dialogue
 * @param {Object} options - Additional options like transitions, backgroundMusic
 * @returns {String} - Path to final video file
 */
async function createNarratedSlideshow(scenes, options = {}) {
  try {
    await ensureDirectories();

    console.log(`Creating narrated slideshow with ${scenes.length} scenes...`);

    const {
      transition = "fade", // fade, dissolve, wipeleft, wiperight, slidedown, slideup
      transitionDuration = 0.5, // seconds
      backgroundMusic = null,
      musicVolume = 0.2,
    } = options;

    // Step 1: Get audio durations and prepare scene info
    const sceneInfo = [];
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const imagePath = path.join(__dirname, "..", scene.imageUrl);
      const audioPath = scene.audioUrl
        ? path.join(__dirname, "..", scene.audioUrl)
        : null;

      let duration = 5; // Default duration if no audio
      if (audioPath) {
        try {
          duration = await getAudioDuration(audioPath);
          console.log(`Scene ${i + 1} audio duration: ${duration}s`);
        } catch (error) {
          console.warn(
            `Could not get audio duration for scene ${i + 1}, using default`
          );
        }
      }

      const finalDuration = Math.max(3, duration);
      if (finalDuration > duration) {
        console.log(
          `  ⚠️  Scene ${
            i + 1
          }: Audio is ${duration}s but extending to ${finalDuration}s (minimum)`
        );
      }

      sceneInfo.push({
        index: i,
        imagePath,
        audioPath,
        duration: finalDuration,
        dialogue: scene.dialogue || scene.description || "",
      });
    }

    // Step 2: Create video clips from each image with its audio
    const videoClips = [];
    for (let i = 0; i < sceneInfo.length; i++) {
      const scene = sceneInfo[i];
      const clipPath = path.join(TEMP_DIR, `clip_${i}.mp4`);

      console.log(`Creating clip ${i + 1}/${sceneInfo.length}`);
      console.log(`  Duration: ${scene.duration}s`);
      console.log(
        `  Audio: ${scene.audioPath ? "✅ Has audio" : "❌ No audio"}`
      );

      await createImageVideoClip(
        scene.imagePath,
        scene.audioPath,
        clipPath,
        scene.duration
      );

      videoClips.push(clipPath);
    }

    // Step 3: Concatenate all clips with transitions
    const outputFilename = `slideshow_${Date.now()}.mp4`;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);

    console.log("Merging clips with transitions...");

    if (videoClips.length === 1) {
      // Single clip - just copy with re-encode
      await mergeSingleClip(
        videoClips[0],
        outputPath,
        backgroundMusic,
        musicVolume
      );
    } else {
      // Multiple clips - use xfade transitions
      await mergeClipsWithTransitions(
        videoClips,
        sceneInfo,
        outputPath,
        transition,
        transitionDuration,
        backgroundMusic,
        musicVolume
      );
    }

    // Cleanup temp files
    console.log("Cleaning up temporary files...");
    for (const clip of videoClips) {
      await fs.unlink(clip).catch(() => {});
    }

    console.log("Slideshow created successfully!");
    return `/output/final/${outputFilename}`;
  } catch (error) {
    console.error("Slideshow creation failed:", error);
    throw new Error(`Failed to create slideshow: ${error.message}`);
  }
}

/**
 * Create a video clip from a single image with audio
 */
async function createImageVideoClip(
  imagePath,
  audioPath,
  outputPath,
  duration
) {
  return new Promise((resolve, reject) => {
    let command = ffmpeg();

    // Input image (loop it)
    command = command
      .input(imagePath)
      .loop(duration)
      .inputOptions(["-framerate 30"]);

    // If audio exists, add it
    if (audioPath) {
      command = command.input(audioPath);
    }

    // Output options
    const outputOptions = [
      "-c:v libx264",
      "-preset veryfast",
      "-crf 23",
      "-pix_fmt yuv420p",
      "-vf",
      "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black",
    ];

    if (audioPath) {
      // Use audio duration, don't cut it short
      outputOptions.push("-c:a aac", "-b:a 128k", "-t", duration.toString());
    } else {
      // Add silent audio track
      command = command
        .input("anullsrc=channel_layout=stereo:sample_rate=44100")
        .inputFormat("lavfi");
      outputOptions.push("-c:a aac", "-b:a 128k", "-t", duration.toString());
    }

    command
      .outputOptions(outputOptions)
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });
}

/**
 * Merge single clip (with optional background music)
 */
async function mergeSingleClip(
  clipPath,
  outputPath,
  backgroundMusic,
  musicVolume
) {
  return new Promise((resolve, reject) => {
    let command = ffmpeg().input(clipPath);

    if (backgroundMusic) {
      const musicPath = path.join(__dirname, "..", backgroundMusic);
      command = command
        .input(musicPath)
        .complexFilter([
          `[1:a]volume=${musicVolume}[music]`,
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
        "-pix_fmt yuv420p",
        "-movflags +faststart",
      ])
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });
}

/**
 * Merge multiple clips with xfade transitions
 */
async function mergeClipsWithTransitions(
  videoClips,
  sceneInfo,
  outputPath,
  transition,
  transitionDuration,
  backgroundMusic,
  musicVolume
) {
  return new Promise((resolve, reject) => {
    const command = ffmpeg();

    // Add all video inputs
    videoClips.forEach((clip) => {
      command.input(clip);
    });

    // Build xfade filter chain for video transitions
    const videoFilters = [];
    const audioFilters = [];

    // Calculate transition offsets
    let offset = 0;
    const offsets = [];
    for (let i = 0; i < sceneInfo.length; i++) {
      offsets.push(offset);
      offset +=
        sceneInfo[i].duration -
        (i < sceneInfo.length - 1 ? transitionDuration : 0);
    }

    // Build video transition chain
    let currentVideo = "[0:v]";
    for (let i = 1; i < videoClips.length; i++) {
      const nextVideo = `[${i}:v]`;
      const outputLabel = i === videoClips.length - 1 ? "[vout]" : `[v${i}]`;
      const transitionOffset = offsets[i] - transitionDuration;

      videoFilters.push(
        `${currentVideo}${nextVideo}xfade=transition=${transition}:duration=${transitionDuration}:offset=${transitionOffset}${outputLabel}`
      );

      currentVideo = outputLabel;
    }

    // Build audio mix chain
    const audioInputs = videoClips.map((_, i) => `[${i}:a]`).join("");
    audioFilters.push(
      `${audioInputs}concat=n=${videoClips.length}:v=0:a=1[aout]`
    );

    // Combine filters
    const complexFilter = [...videoFilters, ...audioFilters];

    command.complexFilter(complexFilter);

    // Map outputs
    const outputMappings = ["-map", "[vout]", "-map", "[aout]"];

    // Add background music if specified
    if (backgroundMusic) {
      const musicPath = path.join(__dirname, "..", backgroundMusic);
      // This is simplified - for proper music mixing with transitions,
      // we'd need more complex filtering
      console.log(
        "Background music with transitions not fully implemented yet"
      );
    }

    command
      .outputOptions([
        ...outputMappings,
        "-c:v libx264",
        "-preset medium",
        "-crf 23",
        "-c:a aac",
        "-b:a 128k",
        "-pix_fmt yuv420p",
        "-movflags +faststart",
      ])
      .output(outputPath)
      .on("start", (commandLine) => {
        console.log("FFmpeg command:", commandLine);
      })
      .on("progress", (progress) => {
        if (progress.percent) {
          console.log(`Processing: ${progress.percent.toFixed(1)}% done`);
        }
      })
      .on("end", resolve)
      .on("error", reject)
      .run();
  });
}

/**
 * Build FFmpeg drawtext filters for subtitles (no SRT file needed)
 */
async function buildDrawtextFilters(scenes) {
  let currentTime = 0;
  const filters = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const audioPath = scene.audioUrl
      ? path.join(__dirname, "..", scene.audioUrl)
      : null;

    let duration = 5;
    if (audioPath) {
      try {
        duration = await getAudioDuration(audioPath);
      } catch (error) {
        console.warn(`Could not get audio duration for scene ${i + 1}`);
      }
    }
    duration = Math.max(3, duration);

    // Truncate or wrap long text
    let text = scene.dialogue || scene.description || `Scene ${i + 1}`;

    // Split long text into max 100 characters per line
    if (text.length > 100) {
      const words = text.split(" ");
      const lines = [];
      let currentLine = "";

      for (const word of words) {
        if ((currentLine + " " + word).length > 100 && currentLine.length > 0) {
          lines.push(currentLine.trim());
          currentLine = word;
        } else {
          currentLine = currentLine ? currentLine + " " + word : word;
        }
      }
      if (currentLine) lines.push(currentLine.trim());

      // Take only first 2 lines
      text = lines.slice(0, 2).join("\n");
    }

    text = text
      .replace(/'/g, "'\\\\\\''") // Escape single quotes for FFmpeg
      .replace(/:/g, "\\:"); // Escape colons

    const startTime = currentTime;
    const endTime = currentTime + duration;

    // Create drawtext filter for this subtitle with text wrapping
    filters.push(
      `drawtext=text='${text}':fontcolor=white:fontsize=28:` +
        `borderw=3:bordercolor=black:x=(w-text_w)/2:y=h-120:` +
        `enable='between(t,${startTime},${endTime})'`
    );

    currentTime += duration;
  }

  // Chain all filters together
  return filters.join(",");
}

/**
 * Simple concatenation without transitions (faster, more reliable)
 * Now with subtitle support!
 */
async function createSimpleSlideshow(scenes, options = {}) {
  try {
    await ensureDirectories();

    console.log(`Creating simple slideshow with ${scenes.length} scenes...`);

    // Create individual clips
    const videoClips = [];
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const imagePath = path.join(__dirname, "..", scene.imageUrl);
      const audioPath = scene.audioUrl
        ? path.join(__dirname, "..", scene.audioUrl)
        : null;

      let duration = 5;
      if (audioPath) {
        try {
          duration = await getAudioDuration(audioPath);
        } catch (error) {
          console.warn(`Could not get audio duration for scene ${i + 1}`);
        }
      }
      duration = Math.max(3, duration);

      const clipPath = path.join(TEMP_DIR, `clip_${i}.mp4`);
      await createImageVideoClip(imagePath, audioPath, clipPath, duration);
      videoClips.push(clipPath);
    }

    // Create concat file
    const concatFilePath = path.join(TEMP_DIR, `concat_${Date.now()}.txt`);
    const concatContent = videoClips.map((clip) => `file '${clip}'`).join("\n");
    await fs.writeFile(concatFilePath, concatContent);

    // Concatenate videos first (without subtitles)
    const outputFilename = `slideshow_${Date.now()}.mp4`;
    const tempOutputPath = path.join(TEMP_DIR, `temp_${outputFilename}`);
    const finalOutputPath = path.join(OUTPUT_DIR, outputFilename);

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(concatFilePath)
        .inputOptions(["-f concat", "-safe 0"])
        .outputOptions([
          "-c:v libx264",
          "-preset medium",
          "-crf 23",
          "-c:a aac",
          "-b:a 128k",
          "-pix_fmt yuv420p",
          "-movflags +faststart",
        ])
        .output(tempOutputPath)
        .on("start", (cmd) => console.log("FFmpeg concat:", cmd))
        .on("progress", (p) => {
          if (p.percent) console.log(`Concat: ${p.percent.toFixed(1)}%`);
        })
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    // Build drawtext filter for subtitles (avoids SRT path issues on Windows)
    console.log("🔥 Adding subtitles to video...");
    const drawtextFilters = await buildDrawtextFilters(scenes);

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(tempOutputPath)
        .outputOptions([
          "-vf",
          drawtextFilters,
          "-c:a copy",
          "-pix_fmt yuv420p",
        ])
        .output(finalOutputPath)
        .on("start", (cmd) => console.log("FFmpeg subtitle burn:", cmd))
        .on("progress", (p) => {
          if (p.percent) console.log(`Subtitles: ${p.percent.toFixed(1)}%`);
        })
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    // Cleanup
    for (const clip of videoClips) {
      await fs.unlink(clip).catch(() => {});
    }
    await fs.unlink(concatFilePath).catch(() => {});
    await fs.unlink(tempOutputPath).catch(() => {});

    console.log("✅ Simple slideshow with subtitles created successfully!");
    return `/output/final/${outputFilename}`;
  } catch (error) {
    console.error("Simple slideshow creation failed:", error);
    throw new Error(`Failed to create simple slideshow: ${error.message}`);
  }
}

module.exports = {
  createNarratedSlideshow,
  createSimpleSlideshow,
  getAudioDuration,
};
