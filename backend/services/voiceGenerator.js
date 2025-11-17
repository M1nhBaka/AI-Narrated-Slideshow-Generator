// services/voiceGenerator.js
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const axios = require("axios");

// Support both ElevenLabs and Google TTS
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const TTS_PROVIDER = process.env.TTS_PROVIDER || "elevenlabs"; // 'elevenlabs' or 'google'

const AUDIO_DIR = path.join(__dirname, "../output/audio");

async function ensureDir() {
  await fsp.mkdir(AUDIO_DIR, { recursive: true });
}

function buildTtsInput(text, character) {
  const voiceStyle = character?.voiceStyle || "neutral";
  return `${text}`.trim() || "";
}

/**
 * Generate voice audio using ElevenLabs or Google TTS
 */
async function generateVoice(text, character) {
  await ensureDir();
  const ttsInput = buildTtsInput(text, character);
  const filename = `scene_${Date.now()}.mp3`;
  const outPath = path.join(AUDIO_DIR, filename);

  // Validation
  if (!ttsInput || ttsInput.trim().length === 0) {
    console.warn("⚠️  No text to synthesize, creating silent audio");
    await fsp.writeFile(outPath, Buffer.alloc(0));
    return `/output/audio/${filename}`;
  }

  console.log(
    `🎤 Generating voice (${TTS_PROVIDER}): "${ttsInput.substring(0, 50)}${
      ttsInput.length > 50 ? "..." : ""
    }"`
  );

  try {
    if (TTS_PROVIDER === "elevenlabs") {
      return await generateWithElevenLabs(
        ttsInput,
        character,
        outPath,
        filename
      );
    } else {
      return await generateWithGoogle(ttsInput, character, outPath, filename);
    }
  } catch (error) {
    console.error(`❌ ${TTS_PROVIDER} TTS Error:`, error.message);
    if (error.response) {
      console.error("  Status:", error.response.status);
      console.error("  Data:", JSON.stringify(error.response.data, null, 2));
    }

    // Create silent audio placeholder
    console.warn("⚠️  Creating silent audio placeholder...");
    await fsp.writeFile(outPath, Buffer.alloc(0));
    return `/output/audio/${filename}`;
  }
}

/**
 * Generate voice using ElevenLabs API
 */
async function generateWithElevenLabs(text, character, outPath, filename) {
  if (!ELEVENLABS_API_KEY) {
    throw new Error("ELEVENLABS_API_KEY is not set in environment variables!");
  }

  // ElevenLabs voice IDs (you can customize these)
  const voiceMap = {
    male: "pNInz6obpgDQGcFmaJgB", // Adam - Deep male voice
    female: "EXAVITQu4vr4xnSDxMaL", // Bella - Soft female voice
    neutral: "21m00Tcm4TlvDq8ikWAM", // Rachel - Calm neutral voice
    // More voices: https://api.elevenlabs.io/v1/voices
  };

  const voiceStyle = (character?.voiceStyle || "neutral").toLowerCase();
  const voiceId = voiceMap[voiceStyle] || voiceMap.neutral;

  console.log(`  Using ElevenLabs voice: ${voiceStyle} (${voiceId})`);

  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      text: text,
      model_id: "eleven_multilingual_v2", // Free tier: v2 models only
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    },
    {
      headers: {
        Accept: "audio/mpeg",
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      responseType: "arraybuffer",
    }
  );

  await fsp.writeFile(outPath, Buffer.from(response.data));

  const fileSize = response.data.byteLength;
  console.log(`✅ Voice generated: ${filename} (${fileSize} bytes)`);

  return `/output/audio/${filename}`;
}

module.exports = { generateVoice };
