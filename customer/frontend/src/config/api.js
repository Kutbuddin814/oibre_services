const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

// Backend base URL for uploads and other non-API endpoints
export const BACKEND_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "");

export default API_BASE_URL;