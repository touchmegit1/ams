import { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService.js';
import { clearSession, setAccessToken } from '../services/authSession.js';
import { toast } from 'react-toastify';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Remove credentials from previous app versions. Do not restore untrusted browser storage.
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
    setAccessToken(accessToken);
  };

  const updateUser = (userInfo) => {
    setUser(userInfo);
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
