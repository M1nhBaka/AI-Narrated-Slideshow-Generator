// services/sceneSegmenter.js
// Simple baseline scene segmentation without external APIs.

/**
 * Segment a script into scenes using simple heuristics.
 * - Splits on double newlines or lines starting with "Scene".
 * - Extracts rough characters present by matching provided character names.
 * - Generates a minimal structure expected by downstream steps.
 */
async function segmentScenes(scriptText, characters = [], setting = {}) {
  const characterNames = (characters || []).map((c) => c.name);

  const rawBlocks = String(scriptText)
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n|^\s*Scene[^\n]*\n/gi)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  if (rawBlocks.length === 0) {
    return [
      {
        index: 0,
        title: "Scene 1",
        description: scriptText.trim().slice(0, 500),
        action: "pan and slight zoom",
        duration: 4,
        characters: extractCharacters(scriptText, characterNames),
        setting: setting.location || "",
      },
    ];
  }

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
