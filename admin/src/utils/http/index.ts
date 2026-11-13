import axios, { type AxiosRequestConfig } from "axios";
import { sessionTokenKey, expireAdminSession } from "../admin-session";

const client = axios.create({ baseURL: import.meta.env.VITE_API_BASE || "/api", timeout: 15000 });
client.interceptors.request.use(config => {
  const token = localStorage.getItem(sessionTokenKey);
  if (token && config.url !== "/admin/login") config.headers.Authorization = `Bearer ${token}`;
  return config;
});
client.interceptors.response.use(response => response, error => {
  if (error.response?.status === 401 && error.config?.url !== "/admin/login") expireAdminSession();
  return Promise.reject(error);
});
export const http = {
  async request<T>(method: string, url: string, params?: AxiosRequestConfig, config?: AxiosRequestConfig): Promise<T> {
    return (await client.request({ method, url, ...params, ...config })).data;
  }
};
