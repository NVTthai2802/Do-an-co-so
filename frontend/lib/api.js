function normalizeApiUrl(value) {
  return value ? value.replace(/\/+$/, "") : "";
}

// Vercel tự cấp NEXT_PUBLIC_BACKEND_URL cho service "backend" khai báo
// trong vercel.json (xem docs.vercel.com/docs/services/experimental).
// NEXT_PUBLIC_API_URL được giữ lại làm giá trị override / chạy local.
const envApiUrl =
  normalizeApiUrl(process.env.NEXT_PUBLIC_BACKEND_URL) ||
  normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL);
const DEFAULT_API_URL = "http://localhost:8000";

export function getApiUrl() {
  return envApiUrl || DEFAULT_API_URL;
}

export const API_URL = getApiUrl();

export async function request(path, { method = "GET", body, token } = {}) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${getApiUrl()}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || data.message || "Da xay ra loi.");
  }

  return data;
}
