const SESSION_KEY = 'ams.session';
let accessToken = null;

const tokenIsActive = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return Number.isFinite(payload.exp) && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
};

export const getAccessToken = () => accessToken;

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
