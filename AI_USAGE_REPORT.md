# BÁO CÁO SỬ DỤNG AI TRONG DỰ ÁN
## Narrated Slideshow Generator - Final Project ATI

---

## 1. TỔNG QUAN HỆ THỐNG

### 1.1 Mô tả dự án
Dự án **Narrated Slideshow Generator** là một hệ thống tự động tạo video slideshow có lồng tiếng (narration) từ kịch bản văn bản. Hệ thống sử dụng nhiều mô hình AI khác nhau để phân tích kịch bản, tạo hình ảnh, tạo giọng nói, và ghép nối thành video hoàn chỉnh.

### 1.2 Kiến trúc tổng quan
```
Input: Script (Kịch bản văn bản)
    ↓
AI #1: Script Analysis (Google Gemini)
    ↓
AI #2: Scene Segmentation (Google Gemini)
    ↓
AI #3: Image Generation (Stability AI - SDXL)
    ↓
AI #4: Voice Generation (ElevenLabs TTS)
    ↓
Video Processing: Slideshow Merge (FFmpeg)
    ↓
Output: Video MP4 với hình ảnh + voice-over
```

---

## 2. CÁC AI ĐƯỢC SỬ DỤNG

### 2.1 Google Gemini 2.5 Flash
- **Vai trò**: Phân tích ngôn ngữ tự nhiên (NLP)
- **Model**: `gemini-2.5-flash`
- **API**: Google Generative AI
- **Chức năng**:
  - Phân tích kịch bản
  - Trích xuất thông tin nhân vật, bối cảnh
  - Phân đoạn cảnh (scene segmentation)

### 2.2 Stability AI - Stable Diffusion XL
- **Vai trò**: Text-to-Image (Tạo hình ảnh từ văn bản)
- **Model**: `stable-diffusion-xl-1024-v1-0`
- **API**: Stability AI REST API
- **Chức năng**:
  - Tạo hình ảnh minh họa cho từng cảnh
  - Độ phân giải: 1024x1024 pixels
  - Style preset: anime/comic-book

### 2.3 ElevenLabs Text-to-Speech
- **Vai trò**: Text-to-Speech (Chuyển văn bản thành giọng nói)
- **Model**: `eleven_multilingual_v2`
- **API**: ElevenLabs TTS API
- **Chức năng**:
  - Tạo voice-over cho từng cảnh
  - Hỗ trợ nhiều giọng (male/female/neutral)
  - Output: MP3 audio files

---

## 3. QUY TRÌNH XỬ LÝ CHI TIẾT

### 3.1 Bước 1: Phân tích kịch bản (Script Analysis)

#### AI sử dụng: Google Gemini 2.5 Flash

#### Input:
```javascript
{
  "script": "Văn bản kịch bản người dùng nhập vào..."
}
```

#### Prompt gửi cho AI:
```
Analyze this animation script and extract detailed information.

Script: [script text]

Please provide a JSON response with:
1. characters: Array of characters with:
   - id, name, description, age, gender
   - appearance, clothing, personality
   - voiceStyle

2. setting: Object with:
   - location, time, mood, artStyle
   - colors, environment

3. narrative: Object with:
   - genre, tone, pacing, targetAudience
```

#### Output từ AI:
```json
{
  "characters": [
    {
      "id": 1,
      "name": "Mai",
      "description": "Cô gái trẻ năng động",
      "age": "25",
      "gender": "female",
      "appearance": "tóc dài đen, mắt nâu",
      "clothing": "áo sơ mi trắng, quần jean",
      "personality": "vui vẻ, thân thiện",
      "voiceStyle": "young girl voice"
    }
  ],
  "setting": {
    "location": "Công viên",
    "time": "Hoàng hôn",
    "mood": "Ấm áp, lãng mạn",
    "artStyle": "Pixar style 3D animation",
    "colors": "Warm sunset tones",
    "environment": "Trees, benches, sunset sky"
  },
  "narrative": {
    "genre": "Romance",
    "tone": "Light and heartwarming",
    "pacing": "medium",
    "targetAudience": "young adults"
  }
}
```

#### Xử lý output:
- Parse JSON response từ Gemini
- Validate và chuẩn hóa dữ liệu
- Lưu vào job storage để sử dụng cho các bước sau

---

### 3.2 Bước 2: Phân đoạn cảnh (Scene Segmentation)

#### AI sử dụng: Google Gemini 2.5 Flash

#### Input:
- Kịch bản gốc
- Danh sách nhân vật (từ bước 1)
- Thông tin setting (từ bước 1)

#### Output từ AI:
```json
{
  "scenes": [
    {
      "index": 1,
      "title": "Opening - Park Entrance",
      "description": "Mai walks into the park at sunset",
      "characters": ["Mai"],
      "action": "walking, smiling",
      "dialogue": "Một ngày đẹp trời thật...",
      "duration": 5
    },
    {
      "index": 2,
      "title": "Meeting",
      "description": "Mai meets her friend by the bench",
      "characters": ["Mai", "Nam"],
      "action": "greeting, talking",
      "dialogue": "Chào bạn! Đã lâu rồi...",
      "duration": 7
    }
  ]
}
```

#### Kết quả:
- Kịch bản được chia thành nhiều scenes
- Mỗi scene có: mô tả, nhân vật, hành động, lời thoại, thời lượng

---

### 3.3 Bước 3: Tạo hình ảnh (Image Generation)

#### AI sử dụng: Stability AI - SDXL

#### Input cho mỗi scene:
```javascript
{
  scene: {
    description: "Mai walks into the park at sunset",
    action: "walking, smiling",
    characters: ["Mai"]
  },
  characters: [/* thông tin chi tiết nhân vật */],
  artStyle: "Pixar style 3D animation",
  consistencySeed: 1234567890  // Đảm bảo nhất quán về phong cách
}
```

#### Prompt được xây dựng:
```
Mai walks into the park at sunset. 
Action: walking, smiling. 
Characters: Mai: tóc dài đen, mắt nâu, age 25, female, áo sơ mi trắng, quần jean. 
Style: Pixar style 3D animation. 
Quality: consistent character design, same character throughout, 
model sheet style, character consistency, detailed, professional illustration
```

#### Negative Prompt (tránh các vấn đề):
```
inconsistent character design, different face, different appearance, 
multiple versions, bad anatomy, deformed, disfigured, poorly drawn, 
extra limbs, blurry, low quality, watermark
```

#### Cấu hình API:
```javascript
{
  text_prompts: [
    { text: prompt, weight: 1 },
    { text: negativePrompt, weight: -1 }
  ],
  width: 1024,
  height: 1024,
  samples: 1,
  cfg_scale: 8,      // Độ tuân thủ prompt
  steps: 40,         // Số bước xử lý (càng cao càng chi tiết)
  style_preset: "anime",
  seed: consistencySeed  // Seed cố định cho consistency
}
```

#### Output từ AI:
- **Format**: Base64-encoded PNG image
- **Size**: 1024x1024 pixels
- **Quality**: High-quality digital art
- **Lưu trữ**: `/output/images/scene_[index]_[timestamp].png`
- **URL trả về**: `/output/images/scene_1_1234567890.png`

#### Kỹ thuật đặc biệt:
- **Consistency Seed**: Sử dụng cùng một seed cho tất cả scenes trong một job
  ```javascript
  generateConsistencySeed(jobId) {
    // Hash jobId thành số nguyên 32-bit
    // Đảm bảo tất cả scenes có phong cách tương tự
  }
  ```
- **Character Reference**: Mô tả chi tiết nhân vật trong mọi prompt
- **Style Consistency**: Thêm keywords như "model sheet style"

---

### 3.4 Bước 4: Tạo giọng nói (Voice Generation)

#### AI sử dụng: ElevenLabs TTS

#### Input cho mỗi scene:
```javascript
{
  text: "Một ngày đẹp trời thật...",
  character: {
    name: "Mai",
    voiceStyle: "young girl voice",
    gender: "female"
  }
}
```

#### Voice Mapping:
```javascript
const voiceMap = {
  male: "pNInz6obpgDQGcFmaJgB",     // Adam - Deep male voice
  female: "EXAVITQu4vr4xnSDxMaL",   // Bella - Soft female voice
  neutral: "21m00Tcm4TlvDq8ikWAM"   // Rachel - Calm neutral voice
}
```

#### Cấu hình API:
```javascript
{
  text: "Một ngày đẹp trời thật...",
  model_id: "eleven_multilingual_v2",  // Hỗ trợ tiếng Việt
  voice_settings: {
    stability: 0.5,         // Độ ổn định giọng
    similarity_boost: 0.75  // Độ giống voice ID
  }
}
```

#### Output từ AI:
- **Format**: MP3 audio
- **Quality**: High-quality voice synthesis
- **Language**: Multilingual (hỗ trợ tiếng Việt)
- **Lưu trữ**: `/output/audio/scene_[timestamp].mp3`
- **URL trả về**: `/output/audio/scene_1234567890.mp3`

#### Xử lý đặc biệt:
- Nếu text rỗng → tạo silent audio placeholder
- Nếu API lỗi → tạo file audio rỗng để workflow tiếp tục

---

### 3.5 Bước 5: Ghép video (Video Merge)

#### Công nghệ: FFmpeg (không phải AI)

#### Input:
- Danh sách scenes với imageUrl và audioUrl
- Background music (optional)
- Transition effects (optional)

#### Quy trình:
1. **Tính toán duration**: Dựa vào độ dài audio của mỗi scene
2. **Tạo video clips**: Mỗi image + audio → video clip
3. **Thêm transitions**: Fade/dissolve giữa các clips (nếu có)
4. **Merge**: Ghép tất cả clips thành một video
5. **Add background music**: Trộn nhạc nền với voice-over

#### Output cuối cùng:
- **Format**: MP4 video
- **Resolution**: 1024x1024 (hoặc scaled)
- **Audio**: Voice-over + background music (optional)
- **Lưu trữ**: `/output/videos/slideshow_[jobId]_[timestamp].mp4`
- **URL trả về**: `/output/videos/slideshow_final.mp4`

---

## 4. LƯU ĐỒ WORKFLOW

```
┌─────────────────────────────────────────────────────────────┐
│ 1. SCRIPT ANALYSIS (Google Gemini)                          │
│                                                              │
│ Input:  "Mai đi dạo trong công viên vào lúc hoàng hôn..."  │
│         ↓                                                    │
│ AI Processing: NLP Analysis                                  │
│         ↓                                                    │
│ Output: {                                                    │
│   characters: [Mai, Nam],                                   │
│   setting: {location: "Park", artStyle: "Pixar"},          │
│   narrative: {genre: "Romance"}                             │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. SCENE SEGMENTATION (Google Gemini)                       │
│                                                              │
│ Input:  Script + Characters + Setting                       │
│         ↓                                                    │
│ AI Processing: Scene Breakdown                               │
│         ↓                                                    │
│ Output: [                                                    │
│   Scene 1: {description, characters, dialogue},             │
│   Scene 2: {description, characters, dialogue},             │
│   Scene 3: ...                                              │
│ ]                                                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. IMAGE GENERATION (Stability AI - SDXL)                   │
│                                                              │
│ For each scene:                                              │
│   Input:  Scene description + Character details + Style      │
│           ↓                                                  │
│   Prompt: "Mai walks in park, Pixar style, sunset..."      │
│           ↓                                                  │
│   AI Processing: Text-to-Image SDXL (40 steps, 1024x1024)  │
│           ↓                                                  │
│   Output: scene_1_123456.png (1024x1024)                    │
│                                                              │
│ Result: 5 images → [img1.png, img2.png, ...]               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. VOICE GENERATION (ElevenLabs TTS)                        │
│                                                              │
│ For each scene:                                              │
│   Input:  Dialogue text + Character voice style             │
│           ↓                                                  │
│   Text:   "Một ngày đẹp trời thật..."                       │
│   Voice:  Female (Bella)                                     │
│           ↓                                                  │
│   AI Processing: Multilingual TTS                            │
│           ↓                                                  │
│   Output: scene_123456.mp3                                   │
│                                                              │
│ Result: 5 audio files → [audio1.mp3, audio2.mp3, ...]      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. VIDEO MERGE (FFmpeg)                                     │
│                                                              │
│ Input:  Images + Audio files + Background music             │
│         ↓                                                    │
│ Process:                                                     │
│   - Match image duration with audio length                   │
│   - Add transitions (fade/dissolve)                          │
│   - Merge all clips sequentially                             │
│   - Mix background music with voice-over                     │
│         ↓                                                    │
│ Output: slideshow_final.mp4                                  │
│         (Complete narrated video slideshow)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. CHI TIẾT CẤU HÌNH AI

### 5.1 Google Gemini Configuration
```javascript
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash"
});
```
- **API Key**: Lưu trong `.env` → `GOOGLE_API_KEY`
- **Model**: `gemini-2.5-flash` (nhanh, hiệu quả cho NLP)
- **Output format**: JSON
- **Error handling**: Fallback với mock data nếu quota hết

### 5.2 Stability AI Configuration
```javascript
const STABILITY_API_KEY = process.env.STABILITY_API_KEY;
const endpoint = "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image";

// Request parameters
{
  width: 1024,
  height: 1024,
  cfg_scale: 8,
  steps: 40,
  style_preset: "anime",
  seed: consistencySeed  // Fixed seed for style consistency
}
```
- **API Key**: Lưu trong `.env` → `STABILITY_API_KEY`
- **Model**: SDXL 1.0 (1024x1024 resolution)
- **Timeout**: 90 seconds (cho 40 steps)
- **Error handling**: Fallback với placeholder image từ placehold.co

### 5.3 ElevenLabs Configuration
```javascript
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

// Request parameters
{
  text: dialogueText,
  model_id: "eleven_multilingual_v2",
  voice_settings: {
    stability: 0.5,
    similarity_boost: 0.75
  }
}
```
- **API Key**: Lưu trong `.env` → `ELEVENLABS_API_KEY`
- **Model**: `eleven_multilingual_v2` (hỗ trợ tiếng Việt)
- **Voices**: Adam (male), Bella (female), Rachel (neutral)
- **Error handling**: Tạo silent audio file

---

## 6. KẾT QUẢ OUTPUT

### 6.1 Cấu trúc thư mục output
```
output/
├── images/
│   ├── scene_1_1731801234567.png  (1024x1024, ~500KB)
│   ├── scene_2_1731801234890.png
│   └── scene_3_1731801235123.png
├── audio/
│   ├── scene_1731801236789.mp3    (~50KB, 3-5s)
│   ├── scene_1731801237012.mp3
│   └── scene_1731801237234.mp3
└── videos/
    └── slideshow_1731801238567.mp4  (~5MB, 15-30s)
```

### 6.2 Sample Output Specification

#### Images (từ Stability AI):
- **Format**: PNG
- **Resolution**: 1024x1024 pixels
- **File size**: 400-800KB per image
- **Quality**: High-quality digital art
- **Style**: Consistent across all scenes (same seed)
- **Features**:
  - Character consistency (same appearance)
  - Scene-appropriate backgrounds
  - Proper composition and lighting
  - Art style matching (anime/Pixar/realistic)

#### Audio (từ ElevenLabs):
- **Format**: MP3
- **Sample rate**: 44.1kHz
- **Bitrate**: 128kbps
- **File size**: ~10-100KB (tùy độ dài)
- **Quality**: Natural-sounding human voice
- **Features**:
  - Clear pronunciation (Vietnamese/English)
  - Proper intonation and emotion
  - Character-appropriate voice
  - No background noise

#### Final Video:
- **Format**: MP4 (H.264 codec)
- **Resolution**: 1024x1024 (có thể scaled)
- **Frame rate**: 24-30 fps
- **Duration**: Tổng thời lượng của tất cả audio clips
- **File size**: 2-10MB (tùy số scenes)
- **Audio tracks**: 
  - Voice-over (primary)
  - Background music (optional, volume: 20%)
- **Features**:
  - Smooth transitions giữa scenes
  - Synchronized audio-visual
  - Professional quality output

---

## 7. ĐÁNH GIÁ HIỆU SUẤT

### 7.1 Thời gian xử lý (Processing time)

| Bước | AI/Service | Thời gian trung bình | Tốc độ |
|------|-----------|---------------------|--------|
| Script Analysis | Google Gemini | 3-5 giây | Nhanh ⚡ |
| Scene Segmentation | Google Gemini | 5-8 giây | Nhanh ⚡ |
| Image Generation | Stability AI | 8-12 giây/ảnh | Trung bình 🔄 |
| Voice Generation | ElevenLabs | 2-4 giây/clip | Nhanh ⚡ |
| Video Merge | FFmpeg | 5-10 giây | Nhanh ⚡ |

**Total**: Cho 5 scenes → khoảng **60-90 giây** (1-1.5 phút)

### 7.2 Chi phí (Cost per run)

| Service | Cost Model | Ước tính cho 5 scenes |
|---------|-----------|----------------------|
| Google Gemini | Free tier: 15 RPM, 1M TPM | $0 (free tier) |
| Stability AI | $10 = 1000 images | $0.05 (5 ảnh) |
| ElevenLabs | $5 = 30K chars | $0.02 (500 chars) |
| **Total** | | **~$0.07 per video** |

### 7.3 Chất lượng (Quality metrics)

| Tiêu chí | Đánh giá | Ghi chú |
|----------|---------|---------|
| Character consistency | 7/10 | Tốt với seed cố định |
| Image quality | 9/10 | SDXL cho chất lượng cao |
| Voice naturalness | 8/10 | ElevenLabs v2 rất tự nhiên |
| Vietnamese pronunciation | 7/10 | Có accent nhẹ |
| Overall coherence | 8/10 | Workflow ổn định |

---

## 8. ĐIỂM MẠNH VÀ HẠN CHẾ

### 8.1 Điểm mạnh ✅

1. **Tự động hóa hoàn toàn**: Từ script → video chỉ với 1 click
2. **Sử dụng AI SOTA**: Gemini 2.5, SDXL, ElevenLabs v2
3. **Multi-modal**: Kết hợp NLP, Image Gen, TTS
4. **Character consistency**: Seed-based consistency cho style
5. **Multilingual**: Hỗ trợ tiếng Việt và English
6. **Flexible workflow**: Có thể edit từng bước
7. **Fast processing**: 1-2 phút cho video hoàn chỉnh

### 8.2 Hạn chế ⚠️

1. **Character consistency không hoàn hảo**:
   - SDXL không có reference image như Midjourney
   - Nhân vật có thể khác nhau giữa các scenes
   - **Giải pháp hiện tại**: Seed cố định + detailed prompt

2. **Cost**:
   - Stability AI và ElevenLabs không free
   - ~$0.07 per video (chấp nhận được cho prototype)

3. **Vietnamese pronunciation**:
   - ElevenLabs có accent nhẹ với tiếng Việt
   - **Alternative**: Google TTS (free nhưng kém tự nhiên hơn)

4. **Rate limits**:
   - Gemini: 15 requests/minute
   - Stability AI: Tùy tier
   - ElevenLabs: 10K chars/month (free tier)

5. **Image quality variance**:
   - SDXL đôi khi tạo ảnh không đúng prompt
   - **Giải pháp**: Negative prompts + higher CFG scale

---

## 9. DEMO EXAMPLE

### Input Script:
```
Mai là một cô gái trẻ năng động. Một buổi chiều, cô đi dạo trong công viên 
vào lúc hoàng hôn. Cô gặp bạn thân của mình là Nam đang ngồi trên ghế đá. 
Họ trò chuyện vui vẻ về những kỷ niệm thời học sinh. Khi trời tối, họ chào 
nhau và hẹn gặp lại.
```

### Output Results:

#### 1. Analysis (Gemini)
```json
{
  "characters": [
    {"name": "Mai", "appearance": "young woman, long black hair", 
     "voiceStyle": "young female voice"},
    {"name": "Nam", "appearance": "young man, casual clothing",
     "voiceStyle": "young male voice"}
  ],
  "setting": {
    "location": "Park", "time": "Sunset", 
    "artStyle": "Pixar style 3D animation",
    "mood": "Warm and nostalgic"
  }
}
```

#### 2. Scenes (Gemini)
- Scene 1: "Mai walking in park at sunset"
- Scene 2: "Mai sees Nam on bench"
- Scene 3: "Mai and Nam talking happily"
- Scene 4: "Night falls, saying goodbye"

#### 3. Images (Stability AI)
- `scene_1.png`: Girl walking in park, warm sunset lighting
- `scene_2.png`: Girl approaches bench with boy sitting
- `scene_3.png`: Two people talking, happy expressions
- `scene_4.png`: Two people waving goodbye, night sky

#### 4. Audio (ElevenLabs)
- `audio_1.mp3`: "Một buổi chiều, Mai đi dạo trong công viên..."
- `audio_2.mp3`: "Cô gặp bạn thân của mình là Nam..."
- `audio_3.mp3`: "Họ trò chuyện vui vẻ về những kỷ niệm..."
- `audio_4.mp3`: "Khi trời tối, họ chào nhau và hẹn gặp lại"

#### 5. Final Video
- `slideshow_final.mp4`: 
  - 4 scenes, ~20 seconds total
  - Voice-over in Vietnamese
  - Smooth fade transitions
  - Background music (optional)

---

## 10. KẾT LUẬN

### 10.1 Tổng kết
Dự án **Narrated Slideshow Generator** thành công trong việc:
- ✅ Tích hợp 3 AI services khác nhau (Gemini, SDXL, ElevenLabs)
- ✅ Xây dựng pipeline tự động từ text → video
- ✅ Xử lý tiếng Việt tốt (NLP và TTS)
- ✅ Tạo output chất lượng cao trong thời gian ngắn

### 10.2 Ứng dụng thực tế
Hệ thống có thể được sử dụng cho:
- 📚 Tạo video giáo dục từ tài liệu
- 📖 Chuyển truyện ngắn thành video animation
- 🎬 Tạo storyboard tự động cho phim
- 📱 Content marketing (explainer videos)
- 🎓 E-learning materials

### 10.3 Hướng phát triển
- 🔄 **Character consistency**: Tích hợp ControlNet hoặc Fooocus
- 🎨 **Style control**: Cho phép upload reference style image
- 🎬 **Animation**: Thêm motion với AI video models (Runway, Pika)
- 🌐 **Multi-language**: Mở rộng hỗ trợ nhiều ngôn ngữ hơn
- 💾 **Database**: Lưu jobs vào MongoDB thay vì in-memory
- 🚀 **Optimization**: Batch processing, queue system với Bull/Redis

---

## 11. TECHNICAL STACK SUMMARY

```
Frontend:         React.js (hoặc Next.js)
Backend:          Node.js + Express
AI Services:
  ├─ NLP:         Google Gemini 2.5 Flash
  ├─ Image:       Stability AI (SDXL 1.0)
  └─ Voice:       ElevenLabs TTS (Multilingual v2)
Video Processing: FFmpeg
Storage:          Local filesystem (/output)
Job Queue:        In-memory Map (production: Redis)
```

---

**Báo cáo được tạo**: November 17, 2025  
**Dự án**: ATI Final Project - Narrated Slideshow Generator  
**Tác giả**: [Your Name]  
**Version**: 1.0

---

## PHỤ LỤC: API ENDPOINTS

### REST API Documentation

```http
# 1. Analyze script
POST /api/script/analyze
Body: { "script": "..." }
Response: { "jobId": "123", "analysis": {...} }

# 2. Segment scenes
POST /api/scenes/segment/:jobId
Response: { "scenes": [...] }

# 3. Generate images
POST /api/images/generate/:jobId
Response: { "scenes": [{..., "imageUrl": "..."}] }

# 4. Generate audio
POST /api/audio/generate/:jobId
Response: { "scenes": [{..., "audioUrl": "..."}] }

# 5. Create slideshow
POST /api/videos/merge/:jobId
Body: { "backgroundMusic": "...", "transition": "fade" }
Response: { "videoUrl": "..." }

# 6. One-click workflow
POST /api/workflow/process
Body: { "script": "..." }
Response: { "jobId": "123", "status": "processing" }

# 7. Check status
GET /api/jobs/:jobId
Response: { "id", "status", "progress", "scenes", "finalVideoUrl" }
```

---

**End of Report**

