/**
 * Lightweight API helper.
 * Reads the JWT token from localStorage and attaches it to every request.
 */

export const BASE_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

const getToken = () => localStorage.getItem('fb_token');

const headers = (isFormData = false) => {
  const h = {};
  const token = getToken();
  if (token) {
    h['Authorization'] = `Bearer ${token}`;
  }
  if (!isFormData) h['Content-Type'] = 'application/json';
  return h;
};

export const api = {
  /** GET request */
  get: (path) =>
    fetch(`${BASE_URL}${path}`, { headers: headers() }).then((r) => r.json()),

  /** POST – json body */
  post: (path, body) =>
    fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    }).then((r) => r.json()),

  /** POST – FormData (file upload) */
  postForm: (path, formData) =>
    fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: headers(true),
      body: formData,
    }).then((r) => r.json()),

  /** PUT – json body */
  put: (path, body) =>
    fetch(`${BASE_URL}${path}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(body),
    }).then((r) => r.json()),

  /** PUT – FormData (file upload) */
  putForm: (path, formData) =>
    fetch(`${BASE_URL}${path}`, {
      method: 'PUT',
      headers: headers(true),
      body: formData,
    }).then((r) => r.json()),

  /** PATCH – json body */
  patch: (path, body) =>
    fetch(`${BASE_URL}${path}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify(body),
    }).then((r) => r.json()),

  /** DELETE */
  delete: (path) =>
    fetch(`${BASE_URL}${path}`, {
      method: 'DELETE',
      headers: headers(),
    }).then((r) => r.json()),
};

export const BACKEND_URL =
  import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
    : (import.meta.env.PROD ? '' : 'http://localhost:5000');
