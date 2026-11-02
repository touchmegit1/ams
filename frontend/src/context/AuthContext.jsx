import { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService.js';
import { clearSession, restoreSession, saveSession, updateSessionUser } from '../services/authSession.js';
import { toast } from 'react-toastify';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [initialSession] = useState(restoreSession);
  const [user, setUser] = useState(initialSession?.user || null);
  const [token, setToken] = useState(initialSession?.accessToken || null);
  const [loading, setLoading] = useState(true);

  // Remove credentials from previous app versions. The current session is tab-scoped.
  useEffect(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    const endSession = () => { setToken(null); setUser(null); };
    window.addEventListener('ams:session-ended', endSession);
    setLoading(false);
    return () => window.removeEventListener('ams:session-ended', endSession);
  }, []);

  useEffect(() => {
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      const remaining = payload.exp * 1000 - Date.now();
      if (!Number.isFinite(remaining) || remaining <= 0) { clearSession(); return; }
      const timer = setTimeout(clearSession, remaining);
      return () => clearTimeout(timer);
    } catch { clearSession(); }
  }, [token]);

  /** Lưu thông tin sau login/verify thành công */
  const saveAuth = (authResponse) => {
    const { accessToken, user: userInfo } = authResponse;
    setToken(accessToken);
    setUser(userInfo);
    saveSession(accessToken, userInfo);
  };

  const updateUser = (userInfo) => {
    setUser(userInfo);
    updateSessionUser(userInfo);
  };

  /** Đăng xuất */
  const logout = async () => {
    try { await authService.logout(); }
    catch { toast.error('Đã thoát trên trình duyệt; chưa xác nhận thu hồi phiên trên máy chủ.'); }
    finally { clearSession(); }
  };

  /** Kiểm tra đã đăng nhập chưa */
  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider value={{ user, token, loading, isAuthenticated, saveAuth, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
