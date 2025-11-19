// services/scriptAnalyzer.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

/**
 * Analyze script and extract characters, setting, and style
 */
async function analyzeScript(scriptText) {
  try {
    const prompt = `Analyze this animation script and extract detailed information. For each character, you MUST create detailed visual descriptions even if not explicitly stated in the script. Use context clues and common storytelling tropes to infer appearance.

Script:
${scriptText}

Please provide a JSON response with:
1. characters: Array of characters with:
   - id: unique number
   - name: character name
   - description: brief role/description
   - age: approximate age (infer if not stated, e.g., "young girl" = 6-10, "explorer" = 25-40)
   - gender: male/female/other (infer from name/context if needed)
   - appearance: REQUIRED - physical appearance details (hair color, hair style, eye color, facial features, body type, height, distinctive marks). Example: "long brown hair, bright blue eyes, fair skin, petite build, freckles on cheeks"
   - clothing: REQUIRED - what they wear based on their role/setting. Example: "pink adventure dress with boots" or "explorer's outfit with leather jacket and hat"
   - personality: personality traits inferred from story/role
   - voiceStyle: voice characteristics based on age/gender (e.g., "cheerful young girl voice", "deep weathered male voice", "warm motherly voice")

IMPORTANT: 
- appearance and clothing fields CANNOT be empty
- If script doesn't describe them, CREATE realistic descriptions based on the character's role, age, and story context
- Be specific and vivid (colors, styles, distinctive features)

2. setting: Object with:
   - location: where the story takes place
   - time: time of day/year
   - mood: overall mood/atmosphere
   - artStyle: suggested animation style (e.g., "Pixar style", "anime", "Studio Ghibli style", "Disney 2D")
   - colors: color palette description
   - environment: environmental details

3. narrative: Object with:
   - genre: story genre
   - tone: story tone
   - pacing: fast/medium/slow
   - targetAudience: who this is for

Return ONLY valid JSON, no additional text.`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
    });
    const geminiPrompt = `${prompt}\n\nReturn ONLY valid JSON.`;
    const result = await model.generateContent(geminiPrompt);
    let text = result.response.text().trim();

    // Strip markdown code blocks if present (```json ... ``` or ``` ... ```)
    text = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    // Try to extract JSON if text contains it inline
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    }

    const analysis = JSON.parse(text);

    // Ensure all required fields exist
    if (!analysis.characters) analysis.characters = [];
    if (!analysis.setting) analysis.setting = {};
    if (!analysis.narrative) analysis.narrative = {};

    // Assign IDs if missing
    analysis.characters = analysis.characters.map((char, idx) => ({
      id: char.id || idx + 1,
      name: char.name || `Character ${idx + 1}`,
      description: char.description || "",
      age: char.age || "unknown",
      gender: char.gender || "unknown",
      appearance: char.appearance || "",
      clothing: char.clothing || "",
      personality: char.personality || "",
      voiceStyle: char.voiceStyle || "neutral voice",
    }));

    console.log("Script analysis complete:", {
      characters: analysis.characters.length,
      setting: analysis.setting.location,
    });

    return analysis;
  } catch (error) {
    console.error("Script analysis error:", error);
    const message = String(error?.message || "");
    // Graceful fallback on quota/429 so UI can continue for demo purposes
    // if (message.includes("429") || /quota|rate limit/i.test(message)) {
    //   const trimmed = String(scriptText || "").trim();
    //   const firstSentence = trimmed.split(/\.|\n/)[0] || "Scene in a park";
    //   const fallback = {
    //     characters: [],
    //     setting: {
    //       location: /công viên|park/i.test(trimmed) ? "Park" : "Scene location",
    //       time: /hoàng hôn|sunset/i.test(trimmed) ? "Sunset" : "Day",
    //       mood: "Warm",
    //       artStyle: "Cartoon",
    //       colors: "Pastel",
    //     },
    //     narrative: {
    //       genre: "Family",
    //       tone: "Light",
    //       pacing: "medium",
    //       targetAudience: "general",
    //     },
    //   };
    //   // naive name extraction (capitalized words up to 2 tokens)
    //   const nameMatches =
    //     trimmed.match(/\b([A-ZĐ][\p{L}']+(?:\s+[A-Z][\p{L}']+)*)/gu) || [];
    //   const names = Array.from(new Set(nameMatches)).slice(0, 3);
    //   fallback.characters = names.map((n, i) => ({
    //     id: i + 1,
    //     name: n,
    //     description: `${n} from script context`,
    //     age: "unknown",
    //     gender: "unknown",
    //     appearance: "",
    //     clothing: "",
    //     personality: "",
    //     voiceStyle: "neutral voice",
    //   }));
    //   console.warn("Using fallback analysis due to quota/429");
    //   return fallback;
    // }
    throw new Error(`Failed to analyze script: ${error.message}`);
  }
}

/**
 * Refine character descriptions with additional details
 */
async function refineCharacterDescription(character, context) {
  try {
    const prompt = `Given this character and story context, create a detailed visual description suitable for AI image generation.

Character: ${character.name}
Current Description: ${character.description}
Appearance: ${character.appearance}
Clothing: ${character.clothing}

Story Context: ${context}

Provide a detailed, vivid description that includes:
- Physical features (face, body, hair, eyes)
- Clothing details (style, colors, accessories)
- Distinctive characteristics
- Expression and demeanor

Keep it concise (2-3 sentences) but visually rich.`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
    });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error("Character refinement error:", error);
    return character.description; // Fallback to original
  }
}

module.exports = {
  analyzeScript,
  refineCharacterDescription,
};
