require("dotenv").config();
const slideshowGen = require("./services/slideshowGenerator");
const voiceGen = require("./services/voiceGenerator");
const imageGen = require("./services/imageGenerator");
const fs = require("fs");
const path = require("path");

console.log("\n🎬 Testing Slideshow with Audio...\n");

async function test() {
  try {
    // 1. Generate test voice
    console.log("1. Generating test audio...");
    const audioUrl = await voiceGen.generateVoice("This is a test narration.", {
      voiceStyle: "neutral",
    });
    console.log("   Audio:", audioUrl);

    const audioPath = path.join(__dirname, audioUrl);
    const audioStats = fs.statSync(audioPath);
    console.log("   Audio size:", audioStats.size, "bytes ✅");

    // 2. Create test scene with dummy image
    const testScenes = [
      {
        imageUrl: "/output/images/scene_2_1763268939680.png", // Use existing image
        audioUrl: audioUrl,
        description: "Test scene with audio",
        duration: 5,
      },
    ];

    console.log("\n2. Creating slideshow...");
    const videoUrl = await slideshowGen.createSimpleSlideshow(testScenes);
    console.log("   Video:", videoUrl);

    const videoPath = path.join(__dirname, videoUrl);
    const videoStats = fs.statSync(videoPath);
    console.log("   Video size:", videoStats.size, "bytes");

    // 3. Check if video has audio stream
    console.log("\n3. Checking video audio stream...");
    const { exec } = require("child_process");
    exec(
      `ffprobe -v error -show_entries stream=codec_type -of default=noprint_wrappers=1 "${videoPath}"`,
      (err, stdout) => {
        if (err) {
          console.log("   ❌ Cannot probe video");
          return;
        }

        if (stdout.includes("codec_type=audio")) {
          console.log("   ✅ Video HAS audio stream!");
        } else {
          console.log("   ❌ Video does NOT have audio stream");
        }
        console.log("\n✅ Test complete!\n");
      }
    );
  } catch (error) {
    console.log("\n❌ Error:", error.message);
    console.log(error.stack);
  }
}

test();
