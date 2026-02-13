const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const DEFAULT_ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN || "";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    const raw = await response.text();
    if (raw) {
      try {
        const payload = JSON.parse(raw);
        message = payload.detail || payload.message || message;
      } catch (_) {
        message = raw;
      }
    }
    throw new Error(message);
  }

  return response.json();
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

export function submitBooking(payload) {
  return request("/api/bookings", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function checkPaymentStatus(paymentId) {
  return request(`/api/payments/${encodeURIComponent(paymentId)}/status`);
}

export function getAdminToken() {
  const fromStorage = localStorage.getItem("atman_admin_token");
  if (fromStorage) return fromStorage;
  if (DEFAULT_ADMIN_TOKEN) return DEFAULT_ADMIN_TOKEN;
  return "";
}

export function setAdminToken(value) {
  localStorage.setItem("atman_admin_token", value || "");
}

function adminRequest(path, options = {}) {
  const token = getAdminToken();
  return request(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      "X-Admin-Token": token
    }
  });
}

export function adminListServices() {
  return adminRequest("/api/admin/services");
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
