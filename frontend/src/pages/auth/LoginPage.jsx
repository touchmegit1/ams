import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext.jsx';
import authService from '../../services/authService.js';
import GoogleLoginButton from '../../components/common/GoogleLoginButton.jsx';

function LoginPage() {
  const navigate = useNavigate();
  const { saveAuth, isAuthenticated, user } = useAuth();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [adminMode, setAdminMode] = useState(false);

  // Nếu đã login → redirect dashboard
  if (isAuthenticated) {
    return <Navigate to={user?.role === 'ADMIN' ? '/admin' : '/dashboard'} replace />;
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: '' });
    setSubmitError('');
  };

  const validate = () => {
    const newErrors = {};
    if (!form.email.trim()) newErrors.email = 'Vui lòng nhập email';
    else if (!/\S+@\S+\.\S+/.test(form.email)) newErrors.email = 'Email không hợp lệ';
    if (!form.password) newErrors.password = 'Vui lòng nhập mật khẩu';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await authService.login(form);
      if (adminMode && res.data.user?.role !== 'ADMIN') {
        setSubmitError('Tài khoản này không có quyền Admin.');
        return;
      }
      if (!adminMode && res.data.user?.role === 'ADMIN') {
        setSubmitError('Vui lòng chọn Admin để đăng nhập.');
        return;
      }
      saveAuth(res.data);
      toast.success('Đăng nhập thành công!');
    } catch (err) {
      const msg = err.response?.data?.message || 'Đăng nhập thất bại';
      setSubmitError(msg);

      // Nếu chưa verify → chuyển sang trang OTP
      if (msg.includes('xác thực OTP')) {
        navigate('/verify-otp', { state: { email: form.email } });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (idToken) => {
    try {
      const res = await authService.googleLogin(idToken);
      saveAuth(res.data);
      toast.success('Đăng nhập Google thành công!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Đăng nhập Google thất bại');
    }
  };

  return (
    <div className="auth-container auth-page">
      <div className="auth-shell">
        <aside className="auth-intro" aria-label="Giới thiệu AMS">
          <div className="auth-brand">AMS <span>·</span> ASSIGNMENT MANAGEMENT SYSTEM</div>
          <div className="auth-intro-content">
            <p className="auth-eyebrow">Không gian học tập của bạn</p>
            <h2>Quản lý bài tập<br />rõ ràng hơn mỗi ngày.</h2>
            <p>Theo dõi tiến độ, nhận thông báo và làm việc cùng lớp trong một nơi.</p>
          </div>
          <div className="auth-intro-footer">Học tập có tổ chức. Tiến bộ có thể thấy.</div>
        </aside>
        <div className="auth-card">
        <h1>{adminMode ? 'Đăng nhập Admin' : 'Đăng nhập AMS'}</h1>
        <p className="subtitle">Assignment Management System</p>
        <div className="auth-role-choice" role="group" aria-label="Chọn vai trò đăng nhập">
          <button type="button" className={!adminMode ? 'is-selected' : ''} aria-pressed={!adminMode} onClick={() => { setAdminMode(false); setSubmitError(''); }}>
            Sinh viên / Giảng viên
          </button>
          <button type="button" className={adminMode ? 'is-selected' : ''} aria-pressed={adminMode} onClick={() => { setAdminMode(true); setSubmitError(''); }}>
            Admin
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <div className="input-wrapper">
              <input
                type="email"
                id="email"
                name="email"
                placeholder="your@email.com"
                value={form.email}
                onChange={handleChange}
              />
            </div>
            {errors.email && <p className="form-error">{errors.email}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="password">Mật khẩu</label>
            <div className="input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                placeholder="Nhập mật khẩu"
                value={form.password}
                onChange={handleChange}
              />
              <button
                type="button"
                className="toggle-password"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
              </button>
            </div>
            {errors.password && <p className="form-error">{errors.password}</p>}
          </div>

          <p className="auth-forgot-password">
            <Link to="/forgot-password" state={{ email: form.email }}>Quên mật khẩu?</Link>
          </p>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="spinner"></span> : 'Đăng nhập'}
          </button>
          {submitError && <p className="auth-submit-error" role="alert">{submitError}</p>}
        </form>

        {!adminMode && <>
          <div className="divider"><span>hoặc</span></div>
          <GoogleLoginButton onSuccess={handleGoogleSuccess} />
          <p className="auth-footer">Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link></p>
        </>}
      </div>
      </div>
    </div>
  );
}

export default LoginPage;
