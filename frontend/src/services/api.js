import axios from 'axios';
import { clearSession, getAccessToken, saveSession, tokenNeedsRefresh } from './authSession.js';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Silent refresh state ────────────────────────────────────────────────────
// Chỉ gọi /auth/refresh một lần tại một thời điểm dù nhiều request cùng trigger.
let refreshPromise = null;

const doRefresh = () => {
  if (refreshPromise) return refreshPromise;
  const token = getAccessToken();
  if (!token) {
    clearSession();
    return Promise.reject(new Error('No token to refresh'));
  }
  refreshPromise = axios
    .post('/api/auth/refresh', null, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then(({ data }) => {
      if (data?.accessToken) {
        // Giữ lại thông tin user từ session cũ, chỉ cập nhật token.
        try {
          const old = JSON.parse(sessionStorage.getItem('ams.session'));
          saveSession(data.accessToken, old?.user ?? data.user);
        } catch {
          saveSession(data.accessToken, data.user);
        }
        return data.accessToken;
      }
      throw new Error('refresh response missing token');
    })
    .catch((err) => {
      clearSession();
      throw err;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
};
// ─────────────────────────────────────────────────────────────────────────────

// Tự động gắn JWT token vào mỗi request; proactive refresh nếu token sắp hết hạn.
api.interceptors.request.use(
  async (config) => {
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      // Xoa Content-Type de Axios/trinh duyet tu dong them multipart/form-data kem boundary hop le
      if (config.headers.delete) {
        config.headers.delete('Content-Type');
      } else {
        delete config.headers['Content-Type'];
      }
    }

    let token = getAccessToken();

    // Nếu token còn hợp lệ nhưng sắp hết hạn → refresh trước khi gửi request.
    if (token && tokenNeedsRefresh(token)) {
      try { token = await doRefresh(); } catch { /* clearSession đã được gọi trong doRefresh */ }
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Xử lý 401: thử refresh một lần rồi retry request gốc; nếu vẫn lỗi thì logout.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalConfig = error.config;

    if (error.response?.status === 401 && !originalConfig._retried) {
      originalConfig._retried = true;
      const currentToken = getAccessToken();

      if (currentToken) {
        // Token còn trong session → thử refresh rồi retry.
        try {
          const newToken = await doRefresh();
          originalConfig.headers.Authorization = `Bearer ${newToken}`;
          return api(originalConfig);
        } catch {
          // refresh thất bại → clearSession đã được gọi trong doRefresh.
        }
      } else {
        // Không còn token → clear để trigger redirect login.
        clearSession();
      }
    }

    if (error.response?.status === 403) {
      window.dispatchEvent(new Event('ams:forbidden'));
    }

    return Promise.reject(error);
  },
);

export default api;
