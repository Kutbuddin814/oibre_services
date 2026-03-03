import axios from "axios";
import API_BASE_URL from "./api";

const api = axios.create({
  baseURL: API_BASE_URL,//no wooreis
  timeout: 120000 // 2 minutes timeout for all requests
});

export default api;