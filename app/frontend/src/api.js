const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const DEFAULT_ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN || "";
const ADMIN_AUTH_STORAGE_KEY = "atman_admin_auth";
const ADMIN_TOKEN_STORAGE_KEY = "atman_admin_token";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    const raw = await response.text();
    if (raw) {
      try {
        const payload = JSON.parse(raw);
        message = extractApiErrorMessage(payload, message);
      } catch (_) {
        message = raw;
      }
    }
    throw new Error(message);
  }

  return response.json();
}

function extractApiErrorMessage(payload, fallback) {
  if (!payload || typeof payload !== "object") return fallback;

  const detail = payload.detail;
  if (typeof detail === "string" && detail.trim()) return detail;

  if (Array.isArray(detail)) {
    const normalized = detail
      .map((item) => {
        if (!item || typeof item !== "object") return "";
        const msg = typeof item.msg === "string" ? item.msg : "";
        const loc = Array.isArray(item.loc) ? item.loc.join(".") : "";
        if (msg && loc) return `${loc}: ${msg}`;
        return msg || loc || "";
      })
      .filter(Boolean)
      .join("; ");
    if (normalized) return normalized;
  }

  if (detail && typeof detail === "object") {
    const objectText = Object.entries(detail)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(", ");
    if (objectText) return objectText;
  }

  if (typeof payload.message === "string" && payload.message.trim()) return payload.message;
  return fallback;
}

function safeParseJSON(value) {
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

export function toMediaUrl(relativePath) {
  if (!relativePath) return "";
  return `${API_BASE}/media/${encodeURI(relativePath)}`;
}

export function getSite() {
  return request("/api/site");
}

export function getServices() {
  return request("/api/services");
}

export function getService(slug) {
  return request(`/api/services/${slug}`);
}

export function getSchedule(serviceSlug) {
  const query = serviceSlug ? `?service_slug=${encodeURIComponent(serviceSlug)}` : "";
  return request(`/api/schedule${query}`);
}

export function getGallery(category) {
  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  return request(`/api/gallery${query}`);
}

export function getLegalPages() {
  return request("/api/legal");
}

export function getLegalPage(slug) {
  return request(`/api/legal/${encodeURIComponent(slug)}`);
}

export function submitContact(payload) {
  return request("/api/contacts", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function submitBooking(payload) {
  return request("/api/bookings", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function purchaseCertificate(payload) {
  return request("/api/certificates/purchase", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getCertificate(code) {
  return request(`/api/certificates/${encodeURIComponent(code)}`);
}

export function checkPaymentStatus(paymentId) {
  return request(`/api/payments/${encodeURIComponent(paymentId)}/status`);
}

export function getAdminAuth() {
  const raw = localStorage.getItem(ADMIN_AUTH_STORAGE_KEY);
  if (!raw) return null;
  const parsed = safeParseJSON(raw);
  if (!parsed || typeof parsed !== "object") return null;
  if (!parsed.access_token || typeof parsed.access_token !== "string") return null;
  return parsed;
}

export function setAdminAuth(payload) {
  if (!payload || !payload.access_token) {
    localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
    return;
  }
  localStorage.setItem(ADMIN_AUTH_STORAGE_KEY, JSON.stringify(payload));
  localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
}

export function clearAdminAuth() {
  localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
  localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
}

export function getAdminToken() {
  const auth = getAdminAuth();
  if (auth?.access_token) return auth.access_token;
  const fromStorage = localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  if (fromStorage) return fromStorage;
  if (DEFAULT_ADMIN_TOKEN) return DEFAULT_ADMIN_TOKEN;
  return "";
}

export function setAdminToken(value) {
  localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, value || "");
}

function buildAdminHeaders(existing = {}) {
  const auth = getAdminAuth();
  if (auth?.access_token) {
    return {
      ...existing,
      Authorization: `Bearer ${auth.access_token}`
    };
  }

  const fallbackToken = getAdminToken();
  return {
    ...existing,
    ...(fallbackToken ? { "X-Admin-Token": fallbackToken } : {})
  };
}

function adminRequest(path, options = {}) {
  return request(path, {
    ...options,
    headers: buildAdminHeaders(options.headers || {})
  });
}

export async function adminLogin(username, password) {
  const payload = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
  setAdminAuth(payload);
  return payload;
}

export function adminMe() {
  return adminRequest("/api/auth/me");
}

export function adminLogout() {
  clearAdminAuth();
}

export function adminListServices() {
  return adminRequest("/api/admin/services").catch((error) => {
    const message = String(error?.message || "");
    if (!/500|internal server error/i.test(message)) {
      throw error;
    }
    return adminRequest("/api/admin/services-list");
  });
}

export function adminCreateService(payload) {
  return adminRequest("/api/admin/services", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function adminUpdateService(id, payload) {
  return adminRequest(`/api/admin/services/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function adminDeleteService(id) {
  return adminRequest(`/api/admin/services/${id}`, {
    method: "DELETE"
  });
}

export function adminListSchedule() {
  return adminRequest("/api/admin/schedule");
}

export function adminCreateSchedule(payload) {
  return adminRequest("/api/admin/schedule", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function adminUpdateSchedule(id, payload) {
  return adminRequest(`/api/admin/schedule/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function adminDeleteSchedule(id) {
  return adminRequest(`/api/admin/schedule/${id}`, {
    method: "DELETE"
  });
}

export function adminListGallery() {
  return adminRequest("/api/admin/gallery");
}

export function adminCreateGallery(payload) {
  return adminRequest("/api/admin/gallery", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function adminUpdateGallery(id, payload) {
  return adminRequest(`/api/admin/gallery/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function adminDeleteGallery(id) {
  return adminRequest(`/api/admin/gallery/${id}`, {
    method: "DELETE"
  });
}

export function adminDashboardStats() {
  return adminRequest("/api/admin/dashboard");
}

export function adminListBookings(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return adminRequest(`/api/admin/bookings${suffix}`);
}

export function adminUpdateBookingStatus(id, status) {
  return adminRequest(`/api/admin/bookings/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

export function adminDeleteBooking(id) {
  return adminRequest(`/api/admin/bookings/${id}`, { method: "DELETE" });
}

export function adminListContacts(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return adminRequest(`/api/admin/contacts${suffix}`);
}

export function adminUpdateContactStatus(id, status) {
  return adminRequest(`/api/admin/contacts/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

export function adminDeleteContact(id) {
  return adminRequest(`/api/admin/contacts/${id}`, { method: "DELETE" });
}

export function adminListSettings() {
  return adminRequest("/api/admin/settings");
}

export function adminBulkUpdateSettings(items) {
  return adminRequest("/api/admin/settings", {
    method: "PUT",
    body: JSON.stringify({ items })
  });
}

export function adminDeleteSetting(key) {
  return adminRequest(`/api/admin/settings/${encodeURIComponent(key)}`, {
    method: "DELETE"
  });
}

export function adminListCertificates(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return adminRequest(`/api/admin/certificates${suffix}`);
}

export function adminUpdateCertificate(id, payload) {
  return adminRequest(`/api/admin/certificates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function adminUploadFile(file, target = "gallery") {
  const data = new FormData();
  data.append("file", file);
  data.append("target", target);

  const response = await fetch(`${API_BASE}/api/admin/upload`, {
    method: "POST",
    headers: buildAdminHeaders(),
    body: data
  });

  if (!response.ok) {
    let message = `Upload failed: ${response.status}`;
    const raw = await response.text();
    if (raw) {
      try {
        const payload = JSON.parse(raw);
        message = extractApiErrorMessage(payload, message);
      } catch (_) {
        message = raw;
      }
    }
    throw new Error(message);
  }

  return response.json();
}
