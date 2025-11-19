// services/imageGenerator.js
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const axios = require("axios");

// API Keys & Config
const STABILITY_API_KEY = process.env.STABILITY_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const IMAGE_PROVIDER = process.env.IMAGE_PROVIDER || "stability"; // "stability" or "pollinations"
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "";

const IMAGES_DIR = path.join(__dirname, "../output/images");

async function ensureDir() {
  await fsp.mkdir(IMAGES_DIR, { recursive: true });
}

/**
 * Build a detailed character reference
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
  const sceneCharacters = (scene.characters || [])
    .map((n) => (characters || []).find((x) => x.name === n))
    .filter(Boolean);

  const characterDesc = sceneCharacters
    .map((c) => {
      const traits = [c.appearance, c.clothing, c.age ? `age ${c.age}` : null]
        .filter(Boolean)
        .join(", ");
      return `${c.name}: ${traits}`;
    })
    .join(". ");

  const style = artStyle || "anime style, soft pastel colors";
  const desc = scene.description || scene.title || "a scene";

  const consistencyKeywords = [
    "consistent character design",
    "same character throughout",
    "model sheet style",
  ].join(", ");

  const qualityKeywords = "detailed, professional illustration, high quality";

  const parts = [
    desc,
    characterDesc && `Characters: ${characterDesc}`,
    `Art style: ${style}`,
    consistencyKeywords,
    qualityKeywords,
  ].filter(Boolean);

  return parts.join(". ");
}

/**
 * Build negative prompt
 */
function buildNegativePrompt() {
  return [
    "inconsistent character design",
    "different face",
    "bad anatomy",
    "disfigured",
    "blurry",
    "low quality",
    "watermark",
  ].join(", ");
}

/**
 * Generate image using Pollinations AI (Free alternative)
 */
async function generateWithPollinations(prompt, filename, outPath) {
  console.log("Using Pollinations AI (free) for prompt:", prompt + "...");

  // Pollinations.ai - Free text-to-image API
  const encodedPrompt = encodeURIComponent(prompt);
  const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&model=flux`;

  try {
    const response = await axios.get(pollinationsUrl, {
      responseType: "arraybuffer",
      timeout: 60000,
    });

    await fsp.writeFile(outPath, Buffer.from(response.data));
    console.log("Image generated successfully with Pollinations");
  } catch (error) {
    console.error("Pollinations error:", error.message);
    throw error;
  }
}

/**
 * Generate image using Stability AI (SDXL)
 */
async function generateWithStability(
  prompt,
  negativePrompt,
  filename,
  outPath,
  consistencySeed
) {
  if (!STABILITY_API_KEY) {
    throw new Error("Missing STABILITY_API_KEY env var");
  }

  console.log("Using Stability AI for prompt:", prompt.slice(0, 100) + "...");
  console.log("Using consistency seed:", consistencySeed || "random");

  const requestBody = {
    text_prompts: [
      { text: prompt, weight: 1 },
      { text: negativePrompt, weight: -1 },
    ],
    width: 1024,
    height: 1024,
    samples: 1,
    cfg_scale: 8,
    steps: 40,
    style_preset: "anime",
  };

  if (consistencySeed !== null) {
    requestBody.seed = consistencySeed;
  }

  const response = await axios.post(
    "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image",
    requestBody,
    {
      headers: {
        Authorization: `Bearer ${STABILITY_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 90000,
    }
  );

  const artifact = response.data?.artifacts?.[0];
  if (!artifact || !artifact.base64) {
    throw new Error("Stability returned no valid artifacts");
  }

  const buffer = Buffer.from(artifact.base64, "base64");
  await fsp.writeFile(outPath, buffer);
  console.log("Image generated successfully with Stability AI");
}

/**
 * Main function to generate image (switches between providers)
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

  console.log(`\n🎨 Generating image with provider: ${IMAGE_PROVIDER}`);

  try {
    // Switch between providers
    if (IMAGE_PROVIDER === "pollinations") {
      await generateWithPollinations(prompt, filename, outPath);
    } else if (IMAGE_PROVIDER === "stability") {
      await generateWithStability(
        prompt,
        negativePrompt,
        filename,
        outPath,
        consistencySeed
      );
    } else {
      throw new Error(`Unknown IMAGE_PROVIDER: ${IMAGE_PROVIDER}`);
    }
  } catch (error) {
    // Fallback to placeholder on any error
    const errorMsg = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message;
    console.error(`${IMAGE_PROVIDER} image failed:`, errorMsg);
    console.warn("⚠️  Using placeholder image instead");

    const label = encodeURIComponent(
      (scene.title || scene.description || "Scene").slice(0, 40)
    );
    const phUrl = `https://placehold.co/1024x1024/png?text=${label}`;
    const resp = await axios.get(phUrl, { responseType: "arraybuffer" });
    await fsp.writeFile(outPath, Buffer.from(resp.data));
  }

  return `/output/images/${filename}`;
}

/**
 * Generate a consistent seed based on job/project ID
 */
function generateConsistencySeed(jobId) {
  let hash = 0;
  const str = String(jobId);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash) % 4294967295;
}

module.exports = {
  generateSceneImage,
  generateConsistencySeed,
  buildCharacterReference,
};
