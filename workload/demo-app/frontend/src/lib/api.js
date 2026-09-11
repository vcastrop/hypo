import axios from "axios";

const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);

export const api = axios.create({
  baseURL: isLocalHost ? "" : import.meta.env.VITE_API_URL || "",
});
