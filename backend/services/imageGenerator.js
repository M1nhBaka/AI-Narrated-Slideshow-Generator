// services/imageGenerator.js
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const axios = require("axios");
const STABILITY_API_KEY = process.env.STABILITY_API_KEY;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || ""; // e.g. http://localhost:3001

const IMAGES_DIR = path.join(__dirname, "../output/images");

async function ensureDir() {
  await fsp.mkdir(IMAGES_DIR, { recursive: true });
}

/**
 * Build a detailed character reference that stays consistent across scenes
 */
function buildCharacterReference(characters) {
  if (!characters || characters.length === 0) return "";

  return characters
    .map((c) => {
      const details = [
        c.appearance,
        c.clothing,
        c.age ? `age ${c.age}` : null,
        c.gender,
      ]
        .filter(Boolean)
        .join(", ");
      return `${c.name} (${details})`;
    })
    .join("; ");
}

/**
 * Build improved prompt with consistency features
 */
function buildPrompt(scene, characters, artStyle) {
  // 1. Get characters in this scene with full details
  const sceneCharacters = (scene.characters || [])
    .map((n) => (characters || []).find((x) => x.name === n))
    .filter(Boolean);

  // 2. Build detailed character descriptions for consistency
  const characterDesc = sceneCharacters
    .map((c) => {
      const traits = [c.appearance, c.clothing, c.age ? `age ${c.age}` : null]
        .filter(Boolean)
        .join(", ");
      return `${c.name}: ${traits}`;
    })
    .join("; ");

  // 3. Build main scene description
  const sceneDesc = scene.description || "";
  const action = scene.action ? `${scene.action}` : "";

  // 4. Add consistency and style keywords
  const styleDesc = artStyle || "high quality digital art";
  const consistencyKeywords = [
    "consistent character design",
    "same character throughout",
    "model sheet style",
    "character consistency",
  ].join(", ");

  // 5. Construct final prompt with proper structure
  const promptParts = [
    sceneDesc,
    action ? `Action: ${action}` : "",
    characterDesc ? `Characters: ${characterDesc}` : "",
    `Style: ${styleDesc}`,
    `Quality: ${consistencyKeywords}, detailed, professional illustration`,
  ].filter(Boolean);

  return promptParts.join(". ");
}

/**
 * Build negative prompt to avoid inconsistencies
 */
function buildNegativePrompt() {
  return [
    "inconsistent character design",
    "different face",
    "different appearance",
    "multiple versions",
    "bad anatomy",
    "deformed",
    "disfigured",
    "poorly drawn",
    "extra limbs",
    "blurry",
    "low quality",
    "watermark",
  ].join(", ");
}

/**
 * Generate image for a scene using Stability AI (SDXL)
 * Returns a public-ish relative URL under /output/images
 */
async function generateSceneImage(
  scene,
  characters = [],
  artStyle = "",
  consistencySeed = null
) {
  await ensureDir();

  const prompt = buildPrompt(scene, characters, artStyle);
  const negativePrompt = buildNegativePrompt();
  const filename = `scene_${scene.index ?? Date.now()}_${Date.now()}.png`;
  const outPath = path.join(IMAGES_DIR, filename);

  try {
    if (!STABILITY_API_KEY) {
      throw new Error("Missing STABILITY_API_KEY env var");
    }

    console.log(
      "Calling Stability AI for prompt:",
      prompt.slice(0, 100) + "..."
    );
    console.log("Using consistency seed:", consistencySeed || "random");

    // Build request body with consistency features
    const requestBody = {
      text_prompts: [
        { text: prompt, weight: 1 },
        { text: negativePrompt, weight: -1 }, // Negative prompt to avoid inconsistencies
      ],
      width: 1024,
      height: 1024,
      samples: 1,
      cfg_scale: 8, // Slightly higher for better prompt adherence
      steps: 40, // More steps for better quality
      style_preset: "anime", // You can change to "anime", "comic-book", etc.
    };

    // Add seed for consistency if provided (same seed = similar style)
    if (consistencySeed !== null) {
      requestBody.seed = consistencySeed;
    }

    // SDXL text-to-image endpoint (returns base64 in artifacts)
    const response = await axios.post(
      "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image",
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${STABILITY_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 90000, // Increased timeout for more steps
      }
    );

    console.log("Stability response status:", response.status);
    console.log("Stability response keys:", Object.keys(response.data || {}));

    const artifact = response.data?.artifacts?.[0];
    if (!artifact) {
      console.error(
        "No artifacts in response:",
        JSON.stringify(response.data, null, 2)
      );
      throw new Error("Stability returned no artifacts");
    }
    if (!artifact.base64) {
      console.error("Artifact missing base64:", artifact);
      throw new Error("Stability artifact missing base64");
    }

    const buffer = Buffer.from(artifact.base64, "base64");
    await fsp.writeFile(outPath, buffer);
    console.log("Image saved successfully:", filename);
  } catch (error) {
    // Fallback to placeholder when API errors
    const errorMsg = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message;
    console.error("Stability image failed:", errorMsg);
    console.warn("Using placeholder image instead");

    const label = encodeURIComponent(
      (scene.title || scene.description || "Scene").slice(0, 40)
    );
    const phUrl = `https://placehold.co/1024x1024/png?text=${label}`;
    const resp = await axios.get(phUrl, { responseType: "arraybuffer" });
    await fsp.writeFile(outPath, Buffer.from(resp.data));
  }

  // Return relative URL - frontend will prepend API base URL if needed
  // The backend serves static files at /output/images/... so frontend can load directly
  return `/output/images/${filename}`;
}

/**
 * Generate a consistent seed based on job/project ID
 * This ensures all images in same project use same seed for consistency
 */
function generateConsistencySeed(jobId) {
  // Convert jobId to a numeric seed (0 to 4294967295)
  let hash = 0;
  const str = String(jobId);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % 4294967295;
}

module.exports = {
  generateSceneImage,
  generateConsistencySeed,
  buildCharacterReference,
};
