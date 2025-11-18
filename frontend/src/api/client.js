// Prefer explicit env; otherwise, default to localhost:3001 when running CRA on 3000
const inferredBase =
  typeof window !== "undefined" &&
  window.location &&
  window.location.port === "3000"
    ? "http://localhost:3001"
    : "";
const API_BASE = process.env.REACT_APP_API_BASE || inferredBase;

// Export for use in components to build absolute URLs
export { API_BASE };

async function request(path, { method = "GET", body, headers } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(headers || {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => ({})) : await res.text();
  if (!res.ok) {
    const error = new Error((isJson && data?.error) || res.statusText);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

export function processWorkflow(script) {
  return request("/api/workflow/process", { method: "POST", body: { script } });
}
export function getJob(jobId) {
  return request(`/api/jobs/${jobId}`);
}
export function health() {
  return request("/health");
}

// Per-step endpoints
export function analyzeScript(script) {
  return request("/api/script/analyze", { method: "POST", body: { script } });
}
export function updateAnalysis(jobId, analysis) {
  return request(`/api/analysis/${jobId}`, {
    method: "PUT",
    body: { analysis },
  });
}
export function segmentScenes(jobId) {
  return request(`/api/scenes/segment/${jobId}`, { method: "POST" });
}
export function updateScenes(jobId, scenes) {
  return request(`/api/scenes/update/${jobId}`, {
    method: "PUT",
    body: { scenes },
  });
}
export function generateImages(jobId) {
  return request(`/api/images/generate/${jobId}`, { method: "POST" });
}
export function generateVideos(jobId) {
  return request(`/api/videos/generate/${jobId}`, { method: "POST" });
}
export function generateAudio(jobId) {
  return request(`/api/audio/generate/${jobId}`, { method: "POST" });
}
export function mergeVideo(jobId, options = {}) {
  const {
    backgroundMusic = null,
    useTransitions = false,
    transition = "fade",
  } = options;
  return request(`/api/videos/merge/${jobId}`, {
    method: "POST",
    body: { backgroundMusic, useTransitions, transition },
  });
}

const api = {
  processWorkflow,
  getJob,
  health,
  analyzeScript,
  updateAnalysis,
  segmentScenes,
  updateScenes,
  generateImages,
  generateVideos,
  generateAudio,
  mergeVideo,
};

export default api;
