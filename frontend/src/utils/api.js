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

const handleResponse = async (res) => {
  let data = {};
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = {};
    }
  } else {
    try {
      const text = await res.text();
      data = { error: text };
    } catch {
      data = {};
    }
  }

  // Handle 401 Unauthorized (expired or invalid token)
  if (res.status === 401) {
    const expiredMsg = data.error || 'Your session has expired. Please log in again.';
    try {
      localStorage.removeItem('fb_token');
      localStorage.removeItem('fb_user');
      sessionStorage.setItem('fb_session_expired', expiredMsg);
    } catch {
      // Ignore storage errors
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('fb:auth-expired', {
          detail: { message: expiredMsg },
        })
      );
    }

    return {
      ...data,
      success: false,
      status: 401,
      expired: true,
      error: expiredMsg,
    };
  }

  // Handle 403 Forbidden (authenticated user without required permission)
  if (res.status === 403) {
    return {
      ...data,
      success: false,
      status: 403,
      error: data.error || 'Access denied. You do not have permission to access this resource.',
    };
  }

  // Handle other non-ok HTTP responses
  if (!res.ok) {
    return {
      ...data,
      success: false,
      status: res.status,
      error: data.error || `Request failed with status ${res.status}.`,
    };
  }

  return data;
};

export const api = {
  /** GET request */
  get: async (path) => {
    try {
      const res = await fetch(`${BASE_URL}${path}`, { headers: headers() });
      return await handleResponse(res);
    } catch (err) {
      return {
        success: false,
        networkError: true,
        error: err.message || 'Unable to connect to the server. Please check your network connection.',
      };
    }
  },

  /** POST – json body */
  post: async (path, body) => {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
      });
      return await handleResponse(res);
    } catch (err) {
      return {
        success: false,
        networkError: true,
        error: err.message || 'Unable to connect to the server. Please check your network connection.',
      };
    }
  },

  /** POST – FormData (file upload) */
  postForm: async (path, formData) => {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: headers(true),
        body: formData,
      });
      return await handleResponse(res);
    } catch (err) {
      return {
        success: false,
        networkError: true,
        error: err.message || 'Unable to connect to the server. Please check your network connection.',
      };
    }
  },

  /** PUT – json body */
  put: async (path, body) => {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(body),
      });
      return await handleResponse(res);
    } catch (err) {
      return {
        success: false,
        networkError: true,
        error: err.message || 'Unable to connect to the server. Please check your network connection.',
      };
    }
  },

  /** PUT – FormData (file upload) */
  putForm: async (path, formData) => {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method: 'PUT',
        headers: headers(true),
        body: formData,
      });
      return await handleResponse(res);
    } catch (err) {
      return {
        success: false,
        networkError: true,
        error: err.message || 'Unable to connect to the server. Please check your network connection.',
      };
    }
  },

  /** PATCH – json body */
  patch: async (path, body) => {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify(body),
      });
      return await handleResponse(res);
    } catch (err) {
      return {
        success: false,
        networkError: true,
        error: err.message || 'Unable to connect to the server. Please check your network connection.',
      };
    }
  },

  /** DELETE */
  delete: async (path) => {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method: 'DELETE',
        headers: headers(),
      });
      return await handleResponse(res);
    } catch (err) {
      return {
        success: false,
        networkError: true,
        error: err.message || 'Unable to connect to the server. Please check your network connection.',
      };
    }
  },
};

export const BACKEND_URL =
  import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
    : (import.meta.env.PROD ? '' : 'http://localhost:5000');
