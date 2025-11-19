// server.js - Main Express Server
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const dotenv = require("dotenv");
const path = require("path");

// Load env vars BEFORE importing any services that read them at import-time
dotenv.config();

// Import services
const scriptAnalyzer = require("./services/scriptAnalyzer");
const sceneSegmenter = require("./services/sceneSegmenter");
const imageGenerator = require("./services/imageGenerator");
const voiceGenerator = require("./services/voiceGenerator");
// const videoMerger = require("./services/videoMerger");
const slideshowGenerator = require("./services/slideshowGenerator");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));
app.use("/output", express.static("output"));

// In-memory job storage (use Redis in production)
const jobs = new Map();

// ============================================
// ROUTES
// ============================================

// 1. Upload and analyze script
app.post("/api/script/analyze", async (req, res) => {
  try {
    const { script } = req.body;

    if (!script) {
      return res.status(400).json({ error: "Script is required" });
    }

    console.log("Analyzing script...");
    const analysis = await scriptAnalyzer.analyzeScript(script);

    const jobId = Date.now().toString();
    jobs.set(jobId, {
      id: jobId,
      script,
      analysis,
      status: "analyzed",
      createdAt: new Date(),
    });

    res.json({
      jobId,
      analysis,
      status: "success",
    });
  } catch (error) {
    console.error("Script analysis error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Update analysis (character/setting edits)
app.put("/api/analysis/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const { analysis } = req.body;

    const job = jobs.get(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    job.analysis = analysis;
    job.updatedAt = new Date();
    jobs.set(jobId, job);

    res.json({ status: "success", analysis });
  } catch (error) {
    console.error("Update analysis error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Segment scenes
app.post("/api/scenes/segment/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = jobs.get(jobId);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    console.log("Segmenting scenes...");
    const scenes = await sceneSegmenter.segmentScenes(
      job.script,
      job.analysis.characters,
      job.analysis.setting
    );

    job.scenes = scenes;
    job.status = "scenes_created";
    jobs.set(jobId, job);

    res.json({
      status: "success",
      scenes,
    });
  } catch (error) {
    console.error("Scene segmentation error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3.5. Update scenes (after user edits)
app.put("/api/scenes/update/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const { scenes } = req.body;
    const job = jobs.get(jobId);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (!scenes || !Array.isArray(scenes)) {
      return res.status(400).json({ error: "Invalid scenes data" });
    }

    console.log(`Updating ${scenes.length} scenes for job ${jobId}`);
    job.scenes = scenes;
    jobs.set(jobId, job);

    res.json({
      status: "success",
      message: "Scenes updated successfully",
      scenes,
    });
  } catch (error) {
    console.error("Scene update error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Generate images for all scenes
app.post("/api/images/generate/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = jobs.get(jobId);

    if (!job || !job.scenes) {
      return res.status(404).json({ error: "Job or scenes not found" });
    }

    console.log(`Generating images for ${job.scenes.length} scenes...`);

    // Don't use consistency seed - let each scene have unique composition
    // Character appearance consistency is maintained through detailed prompts
    console.log(`Generating unique images for each scene (no seed lock)`);

    // Process scenes sequentially to avoid rate limits
    for (let i = 0; i < job.scenes.length; i++) {
      const scene = job.scenes[i];
      console.log(`Generating image for scene ${i + 1}/${job.scenes.length}`);

      const imageUrl = await imageGenerator.generateSceneImage(
        scene,
        job.analysis.characters,
        job.analysis.setting.artStyle,
        null // No consistency seed - allow variation
      );

      job.scenes[i].imageUrl = imageUrl;
      jobs.set(jobId, job);
    }

    job.status = "images_generated";
    jobs.set(jobId, job);

    res.json({
      status: "success",
      scenes: job.scenes,
    });
  } catch (error) {
    console.error("Image generation error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Generate videos from images
// app.post("/api/videos/generate/:jobId", async (req, res) => {
//   try {
//     const { jobId } = req.params;
//     const job = jobs.get(jobId);

//     if (!job || !job.scenes) {
//       return res.status(404).json({ error: "Job or scenes not found" });
//     }

//     console.log(
//       `[OPTIONAL] Generating animated videos for ${job.scenes.length} scenes...`
//     );
//     console.log(
//       "Note: This step is not required for slideshow. Use /api/videos/merge directly."
//     );

//     for (let i = 0; i < job.scenes.length; i++) {
//       const scene = job.scenes[i];

//       if (!scene.imageUrl) {
//         throw new Error(`Scene ${i + 1} has no image`);
//       }

//       console.log(`Generating video for scene ${i + 1}/${job.scenes.length}`);

//       const videoUrl = await videoGenerator.generateVideoFromImage(
//         scene.imageUrl,
//         scene.action
//       );

//       job.scenes[i].videoUrl = videoUrl;
//       jobs.set(jobId, job);
//     }

//     job.status = "videos_generated";
//     jobs.set(jobId, job);

//     res.json({
//       status: "success",
//       scenes: job.scenes,
//       message: "Videos generated. For slideshow, you can skip this step.",
//     });
//   } catch (error) {
//     console.error("Video generation error:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

// 6. Generate audio/voices
app.post("/api/audio/generate/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = jobs.get(jobId);

    if (!job || !job.scenes) {
      return res.status(404).json({ error: "Job or scenes not found" });
    }

    console.log(`Generating audio for ${job.scenes.length} scenes...`);

    for (let i = 0; i < job.scenes.length; i++) {
      const scene = job.scenes[i];

      // Extract dialogue from scene description
      const dialogue = scene.dialogue || scene.description;
      const character = job.analysis.characters.find((c) =>
        scene.characters.includes(c.name)
      );

      console.log(`Generating audio for scene ${i + 1}/${job.scenes.length}`);

      const audioUrl = await voiceGenerator.generateVoice(dialogue, character);

      job.scenes[i].audioUrl = audioUrl;
      jobs.set(jobId, job);
    }

    job.status = "audio_generated";
    jobs.set(jobId, job);

    res.json({
      status: "success",
      scenes: job.scenes,
    });
  } catch (error) {
    console.error("Audio generation error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 7. Create final slideshow video
app.post("/api/videos/merge/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const {
      backgroundMusic,
      transition = "fade",
      useTransitions = false,
    } = req.body;
    const job = jobs.get(jobId);

    if (!job || !job.scenes) {
      return res.status(404).json({ error: "Job or scenes not found" });
    }

    console.log("Creating narrated slideshow...");

    // Use simple slideshow (more reliable) or with transitions
    const finalVideoPath = useTransitions
      ? await slideshowGenerator.createNarratedSlideshow(job.scenes, {
          transition,
          transitionDuration: 0.5,
          backgroundMusic,
          musicVolume: 0.2,
        })
      : await slideshowGenerator.createSimpleSlideshow(job.scenes, {
          backgroundMusic,
          musicVolume: 0.2,
        });

    job.finalVideoUrl = finalVideoPath;
    job.status = "completed";
    job.completedAt = new Date();
    jobs.set(jobId, job);

    console.log("✅ Slideshow created:", finalVideoPath);

    res.json({
      status: "success",
      videoUrl: finalVideoPath,
      finalVideoUrl: finalVideoPath, // Also include for backward compatibility
      sceneCount: job.scenes.length,
    });
  } catch (error) {
    console.error("Slideshow creation error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 8. Get job status
app.get("/api/jobs/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  res.json(job);
});

// 9. Process entire workflow (one-click)
app.post("/api/workflow/process", async (req, res) => {
  try {
    const { script } = req.body;
    const jobId = Date.now().toString();

    // Initialize job
    jobs.set(jobId, {
      id: jobId,
      script,
      status: "processing",
      progress: 0,
      createdAt: new Date(),
    });

    // Start processing in background
    processWorkflow(jobId, script).catch((error) => {
      console.error("Workflow error:", error);
      const job = jobs.get(jobId);
      if (job) {
        job.status = "failed";
        job.error = error.message;
        jobs.set(jobId, job);
      }
    });

    res.json({
      jobId,
      status: "processing",
      message: "Workflow started",
    });
  } catch (error) {
    console.error("Workflow start error:", error);
    res.status(500).json({ error: error.message });
  }
});

// // Background workflow processor
// async function processWorkflow(jobId, script) {
//   const job = jobs.get(jobId);

//   try {
//     // Step 1: Analyze
//     job.progress = 10;
//     job.status = "analyzing";
//     jobs.set(jobId, job);

//     const analysis = await scriptAnalyzer.analyzeScript(script);
//     job.analysis = analysis;
//     jobs.set(jobId, job);

//     // Step 2: Segment scenes
//     job.progress = 20;
//     job.status = "segmenting";
//     jobs.set(jobId, job);

//     const scenes = await sceneSegmenter.segmentScenes(
//       script,
//       analysis.characters,
//       analysis.setting
//     );
//     job.scenes = scenes;
//     jobs.set(jobId, job);

//     // Step 3: Generate images
//     job.progress = 30;
//     job.status = "generating_images";
//     jobs.set(jobId, job);

//     // Don't use consistency seed - allow unique compositions per scene
//     console.log(`Generating diverse images for workflow job ${jobId}`);

//     for (let i = 0; i < scenes.length; i++) {
//       const imageUrl = await imageGenerator.generateSceneImage(
//         scenes[i],
//         analysis.characters,
//         analysis.setting.artStyle,
//         null // No seed - allow variation in composition and angles
//       );
//       job.scenes[i].imageUrl = imageUrl;
//       job.progress = 30 + ((i + 1) / scenes.length) * 20;
//       jobs.set(jobId, job);
//     }

//     // Step 4: Generate audio/narration
//     job.progress = 50;
//     job.status = "generating_audio";
//     jobs.set(jobId, job);

//     for (let i = 0; i < scenes.length; i++) {
//       const dialogue = scenes[i].dialogue || scenes[i].description;
//       const character = analysis.characters.find((c) =>
//         scenes[i].characters.includes(c.name)
//       );

//       const audioUrl = await voiceGenerator.generateVoice(dialogue, character);
//       job.scenes[i].audioUrl = audioUrl;
//       job.progress = 50 + ((i + 1) / scenes.length) * 30;
//       jobs.set(jobId, job);
//     }

//     // Step 5: Create slideshow video
//     job.progress = 80;
//     job.status = "creating_slideshow";
//     jobs.set(jobId, job);

//     const finalVideoPath = await slideshowGenerator.createSimpleSlideshow(
//       job.scenes,
//       { musicVolume: 0.2 }
//     );
//     job.finalVideoUrl = finalVideoPath;

//     job.progress = 100;
//     job.status = "completed";
//     job.completedAt = new Date();
//     jobs.set(jobId, job);
//   } catch (error) {
//     job.status = "failed";
//     job.error = error.message;
//     jobs.set(jobId, job);
//     throw error;
//   }
// }

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", jobs: jobs.size });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`\n Narrated Slideshow Generator API`);
  console.log(`==================================`);
  console.log(`\nWorkflow endpoints:`);
  console.log(`  1. POST /api/script/analyze - Analyze script`);
  console.log(`  2. POST /api/scenes/segment/:jobId - Segment into scenes`);
  console.log(`  3. POST /api/images/generate/:jobId - Generate images`);
  console.log(`  4. POST /api/audio/generate/:jobId - Generate narration`);
  console.log(`  5. POST /api/videos/merge/:jobId - Create slideshow`);
  console.log(`\nOptional:`);
  console.log(
    `  POST /api/videos/generate/:jobId - Generate animated clips (not needed for slideshow)`
  );
  console.log(`\nOne-click:`);
  console.log(`  POST /api/workflow/process - Complete workflow`);
  console.log(`\nStatus:`);
  console.log(`  GET  /api/jobs/:jobId - Check job status`);
  console.log(`\ Ready to create narrated slideshows!\n`);
});

module.exports = app;
