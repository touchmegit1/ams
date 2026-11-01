// Access tokens stay in memory, never browser storage. Reloading requires login.
let accessToken = null;
export const getAccessToken = () => accessToken;
export const setAccessToken = token => { accessToken = token; };
export const clearSession = () => {
  accessToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('user');
  window.dispatchEvent(new Event('ams:session-ended'));
};
