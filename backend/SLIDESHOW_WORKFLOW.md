# 🎬 Narrated Slideshow Generator - Workflow Guide

## Overview

This system creates **narrated slideshow videos** from scripts. Each scene becomes a static image with voiceover narration, creating a storytelling video similar to motion comics or animated storybooks.

## ✨ Key Features

- **AI-Generated Images** with character consistency using Stability AI
- **Text-to-Speech Narration** using Google Cloud TTS
- **Smart Duration Matching** - Each image displays for the duration of its narration
- **Optional Transitions** - Fade, dissolve, wipe effects between scenes
- **Background Music Support** - Add ambient music at adjustable volume

---

## 🔄 Workflow Steps

### Method 1: One-Click Workflow (Recommended)

```bash
POST /api/workflow/process
Body: { "script": "Your story script here..." }
```

This automatically:
1. Analyzes script for characters and settings
2. Segments into scenes
3. Generates consistent images (with seed)
4. Generates narration audio
5. Creates final slideshow video

**Response:**
```json
{
  "jobId": "1234567890",
  "status": "processing",
  "message": "Workflow started"
}
```

Monitor progress:
```bash
GET /api/jobs/:jobId
```

---

### Method 2: Step-by-Step Workflow

#### Step 1: Analyze Script
```bash
POST /api/script/analyze
Body: { "script": "Your story..." }
```

Returns:
- Characters (name, appearance, clothing, voice style)
- Setting (location, time, mood, art style)
- Narrative (genre, tone, pacing)

#### Step 2: Segment Scenes
```bash
POST /api/scenes/segment/:jobId
```

Breaks script into individual scenes with:
- Description
- Characters present
- Action/camera suggestion
- Estimated duration

#### Step 3: Generate Images
```bash
POST /api/images/generate/:jobId
```

Creates consistent images for each scene:
- Uses **consistency seed** (same seed for all scenes in a project)
- Applies **character descriptions** from analysis
- Uses **negative prompts** to avoid inconsistencies
- Adds **style keywords** for uniform look

**Key Improvement:** All images use the same seed = more consistent characters!

#### Step 4: Generate Narration
```bash
POST /api/audio/generate/:jobId
```

Creates voiceover for each scene:
- Uses scene dialogue or description
- Matches character voice style
- Duration automatically detected

#### Step 5: Create Slideshow
```bash
POST /api/videos/merge/:jobId
Body: {
  "useTransitions": false,  // true for xfade transitions
  "transition": "fade",      // fade, dissolve, wipeleft, etc.
  "backgroundMusic": "/path/to/music.mp3"  // optional
}
```

Creates final video:
- Each image shows for duration of its narration
- Optional transitions between images
- Optional background music

---

## 📊 Workflow Comparison

### Old Workflow (Animated Videos)
```
Script → Analysis → Scenes → Images → Animated Videos (pan/zoom) → Audio → Merge
```

### New Workflow (Narrated Slideshow) ⭐
```
Script → Analysis → Scenes → Images → Audio → Slideshow
```

**Benefits:**
- ✅ Faster (no pan/zoom video generation)
- ✅ Better sync (audio drives duration)
- ✅ More reliable (simpler pipeline)
- ✅ Better for storytelling (like audiobooks with pictures)

---

## 🎨 Image Consistency Features

### 1. Consistency Seed
Every project gets a **unique seed** based on jobId:
```javascript
const seed = generateConsistencySeed(jobId);
// All scenes use same seed → similar style
```

### 2. Enhanced Prompts
```
Scene description + Action + Characters (detailed) + Style + Quality keywords
```

Example:
```
"A girl standing in a park. Characters: Mai: long black hair, 
age 8, white dress, dark skin. Style: anime. Quality: consistent 
character design, same character throughout, detailed, professional 
illustration"
```

### 3. Negative Prompts
Automatically excludes:
- inconsistent character design
- different face/appearance
- bad anatomy, deformed
- blurry, low quality

### 4. Optimized API Parameters
- `cfg_scale: 8` - Better prompt adherence
- `steps: 40` - Higher quality
- `style_preset: "anime"` - Consistent style

---

## 🎬 Slideshow Options

### Simple Slideshow (Default - Recommended)
```javascript
createSimpleSlideshow(scenes, options)
```

- **Concat demuxer** - Fast and reliable
- No transitions
- Clean cuts between scenes
- Best for most use cases

### Slideshow with Transitions
```javascript
createNarratedSlideshow(scenes, {
  transition: "fade",           // fade, dissolve, wipeleft, wiperight, slideup, slidedown
  transitionDuration: 0.5,      // seconds
  backgroundMusic: "/path.mp3",
  musicVolume: 0.2              // 0-1
})
```

- **xfade transitions** - Smooth blending
- More processing time
- Cinematic feel

---

## 📝 Example Usage

### Complete Example

```javascript
// 1. Start workflow
const response = await fetch('http://localhost:3001/api/workflow/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    script: `
      Mai walked through the park at sunset. 
      The sky was painted orange and pink.
      
      She noticed a small puppy under a tree.
      "Hello little one," she said softly.
      
      The puppy wagged its tail happily.
      Mai smiled and pet the friendly dog.
    `
  })
});

const { jobId } = await response.json();

// 2. Poll for status
const checkStatus = async () => {
  const job = await fetch(`http://localhost:3001/api/jobs/${jobId}`).then(r => r.json());
  console.log(`Status: ${job.status} - ${job.progress}%`);
  
  if (job.status === 'completed') {
    console.log(`Video ready: ${job.finalVideoUrl}`);
    return job;
  } else if (job.status === 'failed') {
    throw new Error(job.error);
  } else {
    setTimeout(checkStatus, 3000);
  }
};

await checkStatus();
```

---

## 🔧 Configuration

### Environment Variables

```env
# Required
STABILITY_API_KEY=sk-...        # Stability AI for images
GOOGLE_API_KEY=AIza...          # Google TTS for narration

# Optional
PORT=3001                        # Server port
PUBLIC_BASE_URL=http://localhost:3001
```

### Customization

#### Change Image Style
In `imageGenerator.js`:
```javascript
style_preset: "anime"  // Options: anime, photographic, comic-book, 
                       // digital-art, 3d-model, cinematic
```

#### Adjust Audio Duration Padding
In `slideshowGenerator.js`:
```javascript
duration: Math.max(3, audioDuration)  // Minimum 3 seconds per scene
```

#### Change Voice
In `voiceGenerator.js`:
```javascript
const voiceMap = {
  male: { languageCode: "en-US", name: "en-US-Neural2-D" },
  female: { languageCode: "en-US", name: "en-US-Neural2-C" },
  // Add more voices...
};
```

---

## 🎯 API Response Examples

### Job Status Response
```json
{
  "id": "1234567890",
  "status": "generating_images",
  "progress": 45,
  "script": "...",
  "analysis": {
    "characters": [...],
    "setting": {...}
  },
  "scenes": [
    {
      "index": 0,
      "title": "Scene 1",
      "description": "...",
      "imageUrl": "/output/images/scene_0_123.png",
      "audioUrl": "/output/audio/scene_123.mp3",
      "duration": 5.2
    }
  ],
  "finalVideoUrl": "/output/final/slideshow_123.mp4"
}
```

### Workflow Status Values
- `processing` - Just started
- `analyzing` - Analyzing script
- `segmenting` - Segmenting scenes
- `generating_images` - Creating images
- `generating_audio` - Creating narration
- `creating_slideshow` - Building final video
- `completed` - ✅ Done!
- `failed` - ❌ Error occurred

---

## 🚀 Quick Start

1. **Install dependencies:**
```bash
cd backend
npm install
```

2. **Set environment variables:**
```bash
cp .env.example .env
# Edit .env with your API keys
```

3. **Start server:**
```bash
npm start
```

4. **Test with sample script:**
```bash
curl -X POST http://localhost:3001/api/workflow/process \
  -H "Content-Type: application/json" \
  -d '{"script": "A girl walked in the park. She was happy."}'
```

5. **Check status:**
```bash
curl http://localhost:3001/api/jobs/YOUR_JOB_ID
```

6. **Watch your video:**
```
http://localhost:3001/output/final/slideshow_XXXXX.mp4
```

---

## 🎨 Tips for Best Results

### Script Writing
- ✅ **Be descriptive** - "Mai, a young girl with long black hair..."
- ✅ **Describe settings** - "in a sunny park with green trees..."
- ✅ **Keep scenes focused** - One main action per scene
- ✅ **Add dialogue** - Direct speech makes better narration
- ❌ **Avoid** - Very long paragraphs (split into scenes)

### Character Consistency
- ✅ **Define appearance early** - First mention should be detailed
- ✅ **Be specific** - "red jacket" not just "jacket"
- ✅ **Consistent naming** - Always use same character name
- ✅ **Same project seed** - Don't split one story across multiple jobs

### Image Quality
- ✅ Use specific art style in script analysis
- ✅ Mention key visual details for each scene
- ✅ Keep character count low (1-3 per scene)
- ❌ Avoid complex actions (hard to depict in single image)

---

## 🐛 Troubleshooting

### Images are inconsistent
- Check that all scenes in same project (same jobId = same seed)
- Review character descriptions in analysis step
- Try adjusting `cfg_scale` (higher = more prompt adherence)
- Consider using `style_preset: "anime"` for cartoon consistency

### Audio sync issues
- Audio duration auto-detected from files
- Minimum duration is 3 seconds per scene
- Check that audio files were generated correctly

### Slideshow creation fails
- Try `useTransitions: false` (simple slideshow)
- Check that images and audio exist
- Verify FFmpeg is installed
- Check temp directory permissions

---

## 📚 Technical Details

### Architecture
```
Client → Express API → Services → External APIs → FFmpeg → Final Video
                      ↓
                  - Script Analyzer (Gemini)
                  - Image Generator (Stability AI)
                  - Voice Generator (Google TTS)
                  - Slideshow Generator (FFmpeg)
```

### File Structure
```
backend/
├── services/
│   ├── slideshowGenerator.js  ⭐ NEW - Creates narrated slideshows
│   ├── imageGenerator.js      ✨ IMPROVED - Character consistency
│   ├── scriptAnalyzer.js
│   ├── sceneSegmenter.js
│   ├── voiceGenerator.js
│   ├── videoGenerator.js      (optional - for animated clips)
│   └── videoMerger.js         (optional - for animated workflow)
├── output/
│   ├── images/
│   ├── audio/
│   ├── temp/
│   └── final/
└── server.js                   ✨ IMPROVED - New workflow
```

---

## 🎉 That's It!

You now have a complete **AI-powered narrated slideshow generator**! 

Create beautiful storytelling videos from simple text scripts. Perfect for:
- 📖 Children's stories
- 🎓 Educational content
- 📱 Social media storytelling
- 🎨 Motion comics
- 📚 Audiobook visualizations

**Enjoy creating! 🚀✨**

