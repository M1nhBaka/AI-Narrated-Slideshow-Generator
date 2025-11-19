// services/sceneSegmenter.js
// AI-powered scene segmentation with intelligent splitting

const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

/**
 * Segment a script into scenes using AI
 * - Uses Gemini to intelligently split story into visual scenes
 * - Each scene represents a distinct moment/action
 */
async function segmentScenes(scriptText, characters = [], setting = {}) {
  const characterNames = (characters || []).map((c) => c.name);

  // Try simple split first
  let rawBlocks = String(scriptText)
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n|^\s*Scene[^\n]*\n/gi)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  // If only 1 block (no breaks), use AI to intelligently segment
  if (rawBlocks.length <= 1) {
    console.log("📖 No scene breaks found, using AI to segment story...");
    try {
      rawBlocks = await aiSegmentScript(scriptText, characters);
    } catch (error) {
      console.error("AI segmentation failed:", error.message);
      // Fallback: split by sentences if too long
      if (scriptText.length > 300) {
        rawBlocks = splitBySentences(scriptText);
      } else {
        rawBlocks = [scriptText];
      }
    }
  }

  // Build scene objects
  return rawBlocks.map((block, i) => ({
    index: i,
    title: `Scene ${i + 1}`,
    description: block.slice(0, 600),
    action: inferAction(block),
    duration: inferDuration(block),
    characters: extractCharacters(block, characterNames),
    setting: setting.location || "",
  }));
}

/**
 * Use AI to intelligently segment script into visual scenes
 */
async function aiSegmentScript(scriptText, characters) {
  const characterInfo = characters.map((c) => c.name).join(", ");

  const prompt = `You are a film director. Split this story into distinct visual SCENES for animation/slideshow.

Story:
${scriptText}

Characters: ${characterInfo || "Unknown"}

Rules:
- Each scene should be ONE clear visual moment (one location, one action)
- Split when location changes, action changes, or significant time passes
- Each scene should be 1-3 sentences maximum
- Return scenes as a JSON array of strings

Example format:
["Scene 1 description here", "Scene 2 description here", ...]

Return ONLY the JSON array, no other text.`;

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
  const result = await model.generateContent(prompt);
  let text = result.response.text().trim();

  // Clean up markdown
  text = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    text = jsonMatch[0];
  }

  const scenes = JSON.parse(text);
  if (Array.isArray(scenes) && scenes.length > 0) {
    console.log(`✅ AI segmented into ${scenes.length} scenes`);
    return scenes;
  }

  throw new Error("Invalid AI response");
}

/**
 * Improved: Split text by sentences with smart scene detection
 * Looks for natural breaks in storytelling
 */
function splitBySentences(text) {
  // Split into sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const scenes = [];
  let currentScene = "";
  let sentenceCount = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    currentScene += sentence + " ";
    sentenceCount++;

    // Detect natural scene breaks
    const hasLocationChange =
      /\b(arrived|entered|reached|went to|moved to|traveled to|inside|outside)\b/i.test(
        sentence
      );
    const hasTimeChange =
      /\b(later|meanwhile|next|then|suddenly|after|when)\b/i.test(sentence);
    const hasActionChange =
      /\b(found|discovered|saw|met|began|started|escaped|ran)\b/i.test(
        sentence
      );

    const shouldBreak =
      hasLocationChange ||
      hasTimeChange ||
      hasActionChange ||
      sentenceCount >= 3 ||
      currentScene.length > 250 ||
      i === sentences.length - 1;

    if (shouldBreak && currentScene.trim().length > 0) {
      scenes.push(currentScene.trim());
      currentScene = "";
      sentenceCount = 0;
    }
  }

  // Ensure at least 1 scene
  if (scenes.length === 0 && text.length > 0) {
    scenes.push(text.trim());
  }

  console.log(`📝 Split into ${scenes.length} scenes using sentence detection`);
  return scenes.filter((s) => s.length > 0);
}

function extractCharacters(text, knownNames) {
  const present = new Set();
  for (const name of knownNames) {
    const re = new RegExp(`(^|\\b)${escapeRegExp(name)}(\\b|:)`, "i");
    if (re.test(text)) present.add(name);
  }
  return Array.from(present);
}

function inferAction(text) {
  if (/\b(runs?|chases?|fight|explosion)\b/i.test(text))
    return "dynamic action shot";
  if (/\b(whisper|talks?|dialogue|conversation)\b/i.test(text))
    return "two-shot conversation";
  if (/\b(walks?|travels?|journey)\b/i.test(text)) return "tracking shot";
  return "static shot with gentle camera movement";
}

function inferDuration(text) {
  const words = text.split(/\s+/).filter(Boolean).length;
  // Roughly 150 wpm spoken => ~2.5 wps; bound between 3s and 10s
  return Math.max(3, Math.min(10, Math.round(words / 12)));
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = { segmentScenes };
