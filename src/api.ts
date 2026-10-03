import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
  timeout: 120000,
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    // Retry only connection failures, not real API errors such as Gemini 400/429/503.
    const isNetworkError = !error.response && !!config;
    const currentBaseURL = config?.baseURL || api.defaults.baseURL || "";
    const fallbackURL = currentBaseURL.includes(":8000")
      ? "http://127.0.0.1:5000"
      : "http://127.0.0.1:8000";

    if (isNetworkError && !config.__triedFallbackPort) {
      config.__triedFallbackPort = true;
      config.baseURL = fallbackURL;
      return api.request(config);
    }

    return Promise.reject(error);
  },
);

export default api;
