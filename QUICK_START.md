# 🎬 Quick Start Guide - Narrated Slideshow Generator

## ✨ Những gì đã thay đổi

### ❌ Trước đây: Animated Video Workflow
```
Script → Images → Animated Videos (pan/zoom) → Audio → Merge
```
- Tạo video động với hiệu ứng pan/zoom từ mỗi ảnh
- Phức tạp và tốn thời gian
- Video đôi khi không đồng bộ với audio

### ✅ Bây giờ: Narrated Slideshow Workflow
```
Script → Images (with consistency) → Audio/Narration → Slideshow
```
- **Ảnh tĩnh** với lời thoại kể chuyện
- Đơn giản, nhanh hơn, đáng tin cậy hơn
- **Duration tự động** khớp với độ dài audio
- **Character consistency** được cải thiện đáng kể

---

## 🚀 Cách sử dụng

### 1. Setup (Lần đầu tiên)

```bash
# Backend
cd backend
npm install
cp .env.example .env
# Chỉnh sửa .env với API keys của bạn:
# STABILITY_API_KEY=sk-...
# GOOGLE_API_KEY=AIza...
npm start

# Frontend (terminal mới)
cd frontend
npm install
npm start
```

### 2. Tạo Slideshow

**Cách 1: One-Click (Khuyến nghị)**
1. Mở http://localhost:3000
2. Nhập script của bạn
3. Click **"Run Backend Workflow"**
4. Đợi và xem video hoàn thành!

**Cách 2: Step-by-Step**
1. Nhập script → Click "Analyze Script"
2. Xem và chỉnh sửa thông tin nhân vật/setting
3. Click "Approve & Generate Scenes"
4. Đợi tạo ảnh (với consistency seed)
5. Tự động tạo audio
6. Click "Create Slideshow"
7. Xem và download video!

---

## 📝 Mẫu Script Mẫu

```
Mai, một cô bé 8 tuổi với mái tóc dài màu đen và nụ cười tươi,
đang ngồi trong công viên lúc hoàng hôn. 
Cô mặc chiếc váy trắng nhẹ nhàng.

Trời đang dần tối, bầu trời nhuộm màu cam hồng tuyệt đẹp.
Mai đang đọc cuốn sách yêu thích của mình dưới gốc cây lớn.

Bỗng nhiên, một chú chó con đáng yêu chạy đến.
Nó vẫy đuôi và liếm tay cô bé.

Mai cười vui vẻ. "Chào em! Em tên gì vậy?"
Cô vuốt ve chú chó nhỏ một cách dịu dàng.

Họ cùng nhau chơi đùa trong công viên cho đến khi mặt trời lặn.
Đó thật là một ngày tuyệt vời.
```

**Lưu ý khi viết script:**
- ✅ Mô tả chi tiết nhân vật ngay từ đầu
- ✅ Sử dụng tên nhất quán
- ✅ Mỗi đoạn = 1 scene
- ✅ Bao gồm cả hành động và cảm xúc

---

## 🎨 Tính năng Character Consistency

### Đã cải thiện gì?

1. **Consistency Seed**: Mỗi project có 1 seed duy nhất
   - Tất cả ảnh trong cùng project dùng chung seed
   - → Nhân vật có style nhất quán hơn

2. **Enhanced Prompts**: Prompt chi tiết hơn
   - Bao gồm: Description + Characters (chi tiết) + Style + Quality keywords
   - Thêm: "consistent character design", "same character throughout"

3. **Negative Prompts**: Loại bỏ inconsistency
   - "inconsistent character design"
   - "different face", "different appearance"
   - "bad anatomy", "deformed"

4. **Better API Parameters**:
   - `cfg_scale: 8` (tăng từ 7)
   - `steps: 40` (tăng từ 30)
   - `style_preset: "anime"` (có thể thay đổi)

---

## ⚙️ Cấu hình

### Thay đổi Image Style

Trong `backend/services/imageGenerator.js` (dòng 138):

```javascript
style_preset: "anime",  // Đổi thành:
// "photographic" - Ảnh thật
// "comic-book" - Truyện tranh
// "digital-art" - Nghệ thuật số
// "3d-model" - 3D
// "cinematic" - Điện ảnh
```

### Thay đổi Voice

Trong `backend/services/voiceGenerator.js`:

```javascript
const voiceMap = {
  male: { languageCode: "en-US", name: "en-US-Neural2-D" },
  female: { languageCode: "en-US", name: "en-US-Neural2-C" },
  // Thêm giọng mới...
};
```

Xem danh sách giọng: https://cloud.google.com/text-to-speech/docs/voices

---

## 🎯 Workflow API

### One-Click API
```bash
POST http://localhost:3001/api/workflow/process
Content-Type: application/json

{
  "script": "Your script here..."
}
```

Response:
```json
{
  "jobId": "1234567890",
  "status": "processing"
}
```

### Check Status
```bash
GET http://localhost:3001/api/jobs/:jobId
```

Response với progress:
```json
{
  "id": "1234567890",
  "status": "generating_images",
  "progress": 45,
  "scenes": [...],
  "finalVideoUrl": "/output/final/slideshow_xxx.mp4"
}
```

### Status Flow
```
processing
  ↓
analyzing
  ↓
segmenting
  ↓
generating_images
  ↓
generating_audio
  ↓
creating_slideshow  ← NEW!
  ↓
completed ✅
```

---

## 📊 So sánh Performance

| Metric | Trước (Animated) | Sau (Slideshow) |
|--------|------------------|-----------------|
| **Thời gian tạo** | ~5-10 phút | ~3-5 phút |
| **Độ phức tạp** | Cao | Trung bình |
| **Audio sync** | Thủ công | Tự động |
| **File size** | Lớn hơn | Nhỏ hơn |
| **Character consistency** | Cơ bản | Cải thiện đáng kể ⭐ |
| **Use case** | Motion graphics | Storytelling/Narration |

---

## 🐛 Troubleshooting

### Ảnh vẫn không nhất quán?
1. Đảm bảo tất cả scenes dùng **cùng jobId**
2. Kiểm tra character descriptions có chi tiết không
3. Thử style khác: `"anime"` thường consistency tốt hơn `"photographic"`
4. Tăng `cfg_scale` lên 9-10 (trong imageGenerator.js)

### Audio không khớp với ảnh?
- Audio duration được tự động detect
- Minimum duration là 3 giây/scene
- Check file audio có generate thành công không

### Slideshow creation fails?
1. Thử `useTransitions: false` (simple slideshow)
2. Check FFmpeg đã cài chưa: `ffmpeg -version`
3. Check quyền write vào folder `output/`
4. Xem console logs để biết chi tiết lỗi

### API quota exceeded?
- **Stability AI**: Free tier có giới hạn
- **Google TTS**: 1 triệu ký tự/tháng free
- Consider upgrade hoặc dùng nhiều API keys

---

## 📚 File Structure

```
backend/
├── services/
│   ├── slideshowGenerator.js  ⭐ NEW - Tạo slideshow
│   ├── imageGenerator.js      ✨ IMPROVED - Consistency
│   ├── scriptAnalyzer.js
│   ├── sceneSegmenter.js
│   ├── voiceGenerator.js
│   ├── videoGenerator.js      (optional - animated clips)
│   └── videoMerger.js         (optional - old workflow)
├── output/
│   ├── images/      → Generated images
│   ├── audio/       → Narration audio
│   ├── temp/        → Temporary files
│   └── final/       → Final slideshow videos
└── server.js        ✨ IMPROVED - New workflow

frontend/
├── src/
│   ├── api/
│   │   └── client.js    ✨ UPDATED - New parameters
│   └── App.js           ✨ UPDATED - Slideshow UI
```

---

## 🎉 Kết luận

Bạn giờ có một **AI-powered narrated slideshow generator** hoàn chỉnh với:
- ✅ Ảnh AI với character consistency tốt hơn
- ✅ Lời thoại tự động từ script
- ✅ Duration tự động khớp với audio
- ✅ Workflow đơn giản và đáng tin cậy
- ✅ UI thân thiện

**Perfect cho:**
- 📖 Truyện kể cho trẻ em
- 🎓 Nội dung giáo dục
- 📱 Content mạng xã hội
- 🎨 Motion comics
- 📚 Audiobook có hình ảnh

---

## 📖 Đọc thêm

- **SLIDESHOW_WORKFLOW.md** - Hướng dẫn chi tiết về workflow
- **backend/README.md** - API documentation
- **frontend/README.md** - Frontend setup

---

**Enjoy creating beautiful narrated slideshows! 🚀✨**

Nếu có vấn đề, check:
1. Console logs (backend terminal)
2. Browser console (F12)
3. API response messages
4. File permissions in output folders

Happy creating! 🎬

