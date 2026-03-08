import axios from "axios";
import API_BASE_URL from "./api";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000 // 2 minutes timeout for all requests
});

// Interceptor to automatically add Authorization header if customer token exists
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("customerToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;