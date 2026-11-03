const SESSION_KEY = 'ams.session';
let accessToken = null;

// Thời gian còn lại tối thiểu của token để coi là "còn dùng được"
const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // refresh trước 5 phút khi hết hạn

const getTokenPayload = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
};

const tokenIsActive = (token) => {
  const payload = getTokenPayload(token);
  return payload != null && Number.isFinite(payload.exp) && payload.exp * 1000 > Date.now();
};

/** Token còn hợp lệ nhưng sắp hết hạn (< 5 phút) → cần refresh */
export const tokenNeedsRefresh = (token) => {
  const payload = getTokenPayload(token);
  if (!payload || !Number.isFinite(payload.exp)) return false;
  const expiresAt = payload.exp * 1000;
  return expiresAt > Date.now() && expiresAt - Date.now() < TOKEN_REFRESH_THRESHOLD_MS;
};

export const getAccessToken = () => {
  if (tokenIsActive(accessToken)) return accessToken;
  try {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    if (session?.user && tokenIsActive(session.accessToken)) {
      accessToken = session.accessToken;
      return accessToken;
    }
  } catch { /* Missing or inaccessible tab storage means no usable bearer token. */ }
  accessToken = null;
  return null;
};

export const restoreSession = () => {
  try {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    if (session?.user && tokenIsActive(session.accessToken)) {
      accessToken = session.accessToken;
      return session;
    }
  } catch { /* An invalid or unavailable browser session requires a new login. */ }
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* Storage may be disabled. */ }
  accessToken = null;
  return null;
};

export const saveSession = (token, user) => {
  accessToken = token;
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ accessToken: token, user })); }
  catch { /* Keep the current tab signed in when storage is unavailable. */ }
  window.dispatchEvent(new CustomEvent('ams:session-updated', { detail: { token, user } }));
};

export const updateSessionUser = (user) => {
  if (accessToken) saveSession(accessToken, user);
};

export const clearSession = () => {
  accessToken = null;
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* Storage may be disabled. */ }
  localStorage.removeItem('accessToken');
  localStorage.removeItem('user');
  window.dispatchEvent(new Event('ams:session-ended'));
};
