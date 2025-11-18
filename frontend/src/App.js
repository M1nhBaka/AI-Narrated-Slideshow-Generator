import React, { useState } from "react";
import {
  Upload,
  Film,
  Users,
  Image,
  Video,
  Mic,
  Download,
  Play,
  CheckCircle,
  Loader,
  AlertCircle,
} from "lucide-react";
import {
  analyzeScript,
  updateAnalysis,
  segmentScenes,
  generateImages,
  generateAudio,
  mergeVideo,
  getJob,
  API_BASE,
} from "./api/client";

const AIVideoGenerator = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [script, setScript] = useState("");
  const [jobId, setJobId] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [scenes, setScenes] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [finalVideo, setFinalVideo] = useState(null);

  // Step 1: Script Input & Analysis
  const handleScriptSubmit = async () => {
    if (!script.trim()) {
      setError("Vui lòng nhập script");
      return;
    }
    setProcessing(true);
    setError("");

    try {
      const { jobId: newJobId, analysis: scriptAnalysis } = await analyzeScript(
        script
      );
      setJobId(newJobId);
      setAnalysis(scriptAnalysis);
      setCurrentStep(2);
    } catch (err) {
      setError(err.message || "Lỗi khi phân tích script");
    } finally {
      setProcessing(false);
    }
  };

  // Step 2: Edit Analysis & Approve
  const handleAnalysisApprove = async () => {
    setProcessing(true);
    setError("");

    try {
      // Save updated analysis
      await updateAnalysis(jobId, analysis);

      // Move to scene generation
      setCurrentStep(3);
      generateScenes();
    } catch (err) {
      setError(err.message || "Lỗi khi lưu analysis");
      setProcessing(false);
    }
  };

  // Step 3: Generate Scenes & Images
  const generateScenes = async () => {
    setProcessing(true);
    setProgress(0);

    try {
      // Segment scenes
      setProgress(10);
      const { scenes: segmentedScenes } = await segmentScenes(jobId);
      setScenes(segmentedScenes);
      setProgress(20);

      // Generate images
      await generateImages(jobId);

      // Poll for images
      let imagesReady = false;
      while (!imagesReady) {
        await new Promise((r) => setTimeout(r, 2000));
        const job = await getJob(jobId);
        setScenes([...job.scenes]);
        imagesReady = job.scenes.every((s) => s.imageUrl);
        const imageProgress =
          (job.scenes.filter((s) => s.imageUrl).length / job.scenes.length) *
          60;
        setProgress(20 + imageProgress);
      }

      // Stay at step 3, show button to generate audio
      setProgress(80);
    } catch (err) {
      setError(err.message || "Lỗi khi tạo scenes");
    } finally {
      setProcessing(false);
    }
  };

  // Step 4: Generate Audio
  const generateVideos = async () => {
    setProcessing(true);
    setProgress(80);
    setCurrentStep(4); // Move to step 4

    try {
      await generateAudio(jobId);

      // Poll for audio
      let audioReady = false;
      while (!audioReady) {
        await new Promise((r) => setTimeout(r, 2000));
        const job = await getJob(jobId);
        setScenes([...job.scenes]);
        audioReady = job.scenes.every((s) => s.audioUrl);
        const audioProgress =
          (job.scenes.filter((s) => s.audioUrl).length / job.scenes.length) *
          10;
        setProgress(80 + audioProgress);
      }

      setProgress(90);
      // Stay at step 4, show button to merge video
    } catch (err) {
      setError(err.message || "Lỗi khi tạo audio");
    } finally {
      setProcessing(false);
    }
  };

  // Step 5: Merge Final Video
  const mergeFinalVideo = async () => {
    setProcessing(true);
    setProgress(95);

    try {
      const response = await mergeVideo(jobId);
      const videoUrl = response.videoUrl || response.finalVideoUrl;

      console.log("✅ Merge video response:", response);
      console.log("🎬 Video URL:", videoUrl);
      console.log("🔗 API_BASE:", API_BASE);
      console.log(
        "📁 Full path:",
        videoUrl?.startsWith("http") ? videoUrl : `${API_BASE}${videoUrl}`
      );

      if (!videoUrl) {
        throw new Error("Video URL not found in response");
      }

      setFinalVideo({
        url: videoUrl,
        duration: scenes.reduce((acc, s) => acc + (s.duration || 0), 0),
        size: "-",
      });
      setProgress(100);
      setCurrentStep(6);
    } catch (err) {
      setError(err.message || "Lỗi khi ghép video");
    } finally {
      setProcessing(false);
    }
  };

  const handleEditCharacter = (id, field, value) => {
    const updated = { ...analysis };
    const charIndex = updated.characters.findIndex((c) => c.id === id);
    if (charIndex !== -1) {
      updated.characters[charIndex][field] = value;
      setAnalysis(updated);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Film className="w-12 h-12 text-purple-600" />
            <h1 className="text-4xl font-bold text-gray-800">
              AI Narrated Slideshow Generator
            </h1>
          </div>
          <p className="text-gray-600">
            Transform your script into narrated slideshow videos with AI
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8 bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            {[
              { num: 1, name: "Script", icon: Upload },
              { num: 2, name: "Analysis", icon: Users },
              { num: 3, name: "Scenes", icon: Image },
              { num: 4, name: "Audio", icon: Mic },
              { num: 5, name: "Merge", icon: Film },
              { num: 6, name: "Export", icon: Download },
            ].map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={step.num} className="flex items-center">
                  <div
                    className={`flex flex-col items-center ${
                      currentStep >= step.num
                        ? "text-purple-600"
                        : "text-gray-400"
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        currentStep >= step.num
                          ? "bg-purple-600 text-white"
                          : "bg-gray-200"
                      }`}
                    >
                      {currentStep > step.num ? (
                        <CheckCircle className="w-6 h-6" />
                      ) : (
                        <Icon className="w-6 h-6" />
                      )}
                    </div>
                    <span className="text-xs mt-2 font-medium">
                      {step.name}
                    </span>
                  </div>
                  {idx < 5 && (
                    <div
                      className={`w-16 h-1 mx-2 ${
                        currentStep > step.num ? "bg-purple-600" : "bg-gray-300"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
          {processing && (
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-center text-sm text-gray-600 mt-2">
                Processing... {progress}%
              </p>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Script Input */}
        {currentStep === 1 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <Upload className="w-6 h-6 text-purple-600" />
              Nhập Script của bạn
            </h2>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Dán script của bạn vào đây... Ví dụ:&#10;&#10;Mai, một cô gái trẻ với mái tóc dài đen, đi dạo trong công viên lúc hoàng hôn. Bầu trời nhuộm màu cam hồng tuyệt đẹp.&#10;&#10;Cô nhìn thấy một chú chó con nhỏ dưới gốc cây và mỉm cười ấm áp."
              className="w-full h-64 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleScriptSubmit}
                disabled={processing}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 flex items-center gap-2 font-medium"
              >
                {processing ? (
                  <Loader className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
                Phân tích Script
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Character & Setting Analysis */}
        {currentStep === 2 && analysis && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <Users className="w-6 h-6 text-purple-600" />
                Nhân vật
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {analysis.characters.map((char) => (
                  <div
                    key={char.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <h3 className="font-semibold text-lg mb-2">{char.name}</h3>
                    <div className="space-y-2">
                      <div>
                        <label className="text-sm text-gray-600">Mô tả:</label>
                        <input
                          type="text"
                          value={char.description || ""}
                          onChange={(e) =>
                            handleEditCharacter(
                              char.id,
                              "description",
                              e.target.value
                            )
                          }
                          className="w-full p-2 border rounded mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-600">
                          Ngoại hình:
                        </label>
                        <input
                          type="text"
                          value={char.appearance || ""}
                          onChange={(e) =>
                            handleEditCharacter(
                              char.id,
                              "appearance",
                              e.target.value
                            )
                          }
                          className="w-full p-2 border rounded mt-1"
                        />
                      </div>
                      {char.clothing && (
                        <div>
                          <label className="text-sm text-gray-600">
                            Trang phục:
                          </label>
                          <input
                            type="text"
                            value={char.clothing}
                            onChange={(e) =>
                              handleEditCharacter(
                                char.id,
                                "clothing",
                                e.target.value
                              )
                            }
                            className="w-full p-2 border rounded mt-1"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold mb-4">
                Bối cảnh & Phong cách
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600">Địa điểm:</label>
                  <input
                    type="text"
                    value={analysis.setting?.location || ""}
                    onChange={(e) =>
                      setAnalysis({
                        ...analysis,
                        setting: {
                          ...analysis.setting,
                          location: e.target.value,
                        },
                      })
                    }
                    className="w-full p-2 border rounded mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Thời gian:</label>
                  <input
                    type="text"
                    value={analysis.setting?.time || ""}
                    onChange={(e) =>
                      setAnalysis({
                        ...analysis,
                        setting: { ...analysis.setting, time: e.target.value },
                      })
                    }
                    className="w-full p-2 border rounded mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">
                    Phong cách nghệ thuật:
                  </label>
                  <input
                    type="text"
                    value={analysis.setting?.artStyle || ""}
                    onChange={(e) =>
                      setAnalysis({
                        ...analysis,
                        setting: {
                          ...analysis.setting,
                          artStyle: e.target.value,
                        },
                      })
                    }
                    className="w-full p-2 border rounded mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Màu sắc:</label>
                  <input
                    type="text"
                    value={analysis.setting?.colors || ""}
                    onChange={(e) =>
                      setAnalysis({
                        ...analysis,
                        setting: {
                          ...analysis.setting,
                          colors: e.target.value,
                        },
                      })
                    }
                    className="w-full p-2 border rounded mt-1"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                Quay lại
              </button>
              <button
                onClick={handleAnalysisApprove}
                disabled={processing}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 flex items-center gap-2 font-medium"
              >
                {processing ? (
                  <Loader className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
                Xác nhận & Tạo Scenes
              </button>
            </div>
          </div>
        )}

        {/* Step 3 & 4: Scene Generation */}
        {(currentStep === 3 || currentStep === 4) && scenes.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <Image className="w-6 h-6 text-purple-600" />
              Các Cảnh đã tạo
            </h2>
            <div className="space-y-4">
              {scenes.map((scene, idx) => (
                <div
                  key={idx}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="bg-purple-100 text-purple-600 w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">
                        {scene.description}
                      </h3>
                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div>
                          <span className="text-gray-600">Nhân vật:</span>{" "}
                          {scene.characters?.join(", ") || "Không rõ"}
                        </div>
                        <div>
                          <span className="text-gray-600">Thời lượng:</span>{" "}
                          {scene.duration || 5}s
                        </div>
                      </div>
                      {scene.imageUrl && (
                        <div className="mt-3">
                          <img
                            src={
                              scene.imageUrl?.startsWith("http")
                                ? scene.imageUrl
                                : `${API_BASE}${scene.imageUrl}`
                            }
                            alt={`Scene ${idx + 1}`}
                            className="w-full rounded-lg border"
                          />
                          <div className="flex gap-2 mt-2">
                            {scene.imageUrl && (
                              <span className="text-green-600 text-sm flex items-center gap-1">
                                <CheckCircle className="w-4 h-4" /> Hình ảnh đã
                                tạo
                              </span>
                            )}
                            {scene.audioUrl && (
                              <span className="text-green-600 text-sm flex items-center gap-1">
                                <CheckCircle className="w-4 h-4" /> Audio đã tạo
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Action Buttons */}
            <div className="mt-6 flex justify-end">
              {currentStep === 3 &&
                scenes.every((s) => s.imageUrl) &&
                !processing && (
                  <button
                    onClick={generateVideos}
                    className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 font-medium"
                  >
                    <Mic className="w-5 h-5" />
                    Tạo Audio
                  </button>
                )}
              {currentStep === 4 &&
                scenes.every((s) => s.audioUrl) &&
                !processing && (
                  <button
                    onClick={() => setCurrentStep(5)}
                    className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 font-medium"
                  >
                    <Film className="w-5 h-5" />
                    Tiếp tục ghép video
                  </button>
                )}
            </div>
          </div>
        )}

        {/* Step 5: Merge Video */}
        {currentStep === 5 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <Film className="w-6 h-6 text-purple-600" />
              Ghép Video Cuối cùng
            </h2>
            <p className="text-gray-600 mb-6">
              Sẵn sàng ghép tất cả các cảnh thành video slideshow hoàn chỉnh.
            </p>
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-purple-600">
                    {scenes.length}
                  </div>
                  <div className="text-sm text-gray-600">Cảnh</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">
                    {scenes.reduce((acc, s) => acc + (s.duration || 0), 0)}s
                  </div>
                  <div className="text-sm text-gray-600">Tổng thời lượng</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">
                    {analysis?.characters?.length || 0}
                  </div>
                  <div className="text-sm text-gray-600">Nhân vật</div>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={mergeFinalVideo}
                disabled={processing}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 flex items-center gap-2 font-medium"
              >
                {processing ? (
                  <Loader className="w-5 h-5 animate-spin" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
                Ghép Video
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Export */}
        {currentStep === 6 && finalVideo && (
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="mb-6">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-gray-800 mb-2">
                Video Hoàn thành!
              </h2>
              <p className="text-gray-600">
                Video slideshow của bạn đã được tạo thành công.
              </p>
            </div>

            {/* Video Player */}
            <div className="mb-6">
              {finalVideo.url && (
                <>
                  <video
                    controls
                    className="w-full rounded-lg border-2 border-purple-200 shadow-lg max-h-96 mx-auto"
                    src={
                      finalVideo.url?.startsWith("http")
                        ? finalVideo.url
                        : `${API_BASE}${finalVideo.url}`
                    }
                    onError={(e) => {
                      console.error("Video load error:", e);
                      console.error("Video URL:", finalVideo.url);
                      console.error(
                        "Full URL:",
                        finalVideo.url?.startsWith("http")
                          ? finalVideo.url
                          : `${API_BASE}${finalVideo.url}`
                      );
                    }}
                  >
                    Trình duyệt của bạn không hỗ trợ video.
                  </video>
                  <div className="text-xs text-gray-500 mt-2 text-center">
                    Video path: {finalVideo.url}
                  </div>
                </>
              )}
              {!finalVideo.url && (
                <div className="text-red-600 text-center p-4">
                  ⚠️ Video URL not found
                </div>
              )}
            </div>

            <div className="bg-gray-50 p-6 rounded-lg mb-6 inline-block">
              <Film className="w-24 h-24 text-purple-600 mx-auto mb-4" />
              <div className="text-left space-y-2">
                <div>
                  <span className="text-gray-600">Thời lượng:</span>{" "}
                  <span className="font-semibold">{finalVideo.duration}s</span>
                </div>
                <div>
                  <span className="text-gray-600">Số cảnh:</span>{" "}
                  <span className="font-semibold">{scenes.length}</span>
                </div>
                <div>
                  <span className="text-gray-600">Định dạng:</span>{" "}
                  <span className="font-semibold">MP4</span>
                </div>
              </div>
            </div>
            <div className="flex justify-center gap-4">
              <a
                href={
                  finalVideo.url?.startsWith("http")
                    ? finalVideo.url
                    : `${API_BASE}${finalVideo.url}`
                }
                download
                className="px-8 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 font-medium text-lg"
              >
                <Download className="w-5 h-5" />
                Download Video
              </a>
              <button
                onClick={() => {
                  setCurrentStep(1);
                  setScript("");
                  setAnalysis(null);
                  setScenes([]);
                  setFinalVideo(null);
                  setProgress(0);
                  setJobId(null);
                  setError("");
                }}
                className="px-8 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium text-lg"
              >
                Tạo Video Mới
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIVideoGenerator;
