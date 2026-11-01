import axios from "axios";

const http = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api`,
  withCredentials: true,
  timeout: 180000,
});

// On an expired access token, try the refresh cookie once, then retry.
http.interceptors.response.use(
  (resp) => resp,
  async (error) => {
    const cfg = error.config;
    const status = error.response?.status;
    const url = cfg?.url || "";
    if (status === 401 && cfg && !cfg._retry && !url.includes("/auth/login") && !url.includes("/auth/refresh") && !url.includes("/lookup")) {
      cfg._retry = true;
      try {
        await http.post("/auth/refresh");
        return http(cfg);
      } catch {
        /* refresh failed — surface the original 401 */
      }
    }
    return Promise.reject(error);
  }
);

export const apiError = (e, fallback = "Something went wrong. Please try again.") => {
  const detail = e?.response?.data?.error ?? e?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  return e?.message || fallback;
};

export default http;
