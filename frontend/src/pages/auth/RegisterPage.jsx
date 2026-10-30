import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import authService from '../../services/authService.js';
import { passwordError } from '../../utils/passwordPolicy.js';
import PasswordRequirements from '../../components/common/PasswordRequirements.jsx';

function RegisterPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'STUDENT',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: '' });
  };

  const validate = () => {
    const newErrors = {};
    if (!form.fullName.trim()) newErrors.fullName = 'Vui lòng nhập họ tên';
    if (!form.email.trim()) newErrors.email = 'Vui lòng nhập email';
    else if (!/\S+@\S+\.\S+/.test(form.email)) newErrors.email = 'Email không hợp lệ';
    const passwordMessage = passwordError(form.password);
    if (passwordMessage) newErrors.password = passwordMessage;
    if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const { confirmPassword, ...registerData } = form;
      const res = await authService.register({ ...registerData, email: form.email.trim() });
      toast.success(res.data.message);
      navigate('/verify-otp', { state: { email: form.email } });
    } catch (err) {
      const data = err.response?.data;
      if (typeof data === 'object' && !data.message) {
        // Validation errors trả về dạng { field: "message" }
        setErrors(data);
      } else {
        toast.error(data?.message || 'Đăng ký thất bại');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container auth-page">
      <div className="auth-shell">
        <aside className="auth-intro" aria-label="Giới thiệu AMS">
          <div className="auth-brand">AMS <span>·</span> ASSIGNMENT MANAGEMENT</div>
          <div className="auth-intro-content">
            <p className="auth-eyebrow">Không gian học tập của bạn</p>
            <h2>Quản lý bài tập<br />rõ ràng hơn mỗi ngày.</h2>
            <p>Theo dõi tiến độ, nhận thông báo và làm việc cùng lớp trong một nơi.</p>
          </div>
          <div className="auth-intro-footer">Học tập có tổ chức. Tiến bộ có thể thấy.</div>
        </aside>
        <div className="auth-card">
        <h1>Đăng ký tài khoản</h1>
        <p className="subtitle">Tạo tài khoản AMS mới</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="fullName">Họ và tên</label>
            <div className="input-wrapper">
              <input
                type="text"
                id="fullName"
                name="fullName"
                placeholder="Nguyễn Văn A"
                value={form.fullName}
                onChange={handleChange}
              />
            </div>
            {errors.fullName && <p className="form-error">{errors.fullName}</p>}
          </div>

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

          <p className="registration-role-note">Đăng ký tài khoản Sinh viên. Tài khoản Giảng viên do người quản trị cấp.</p>

          <div className="form-group">
            <label htmlFor="password">Mật khẩu</label>
            <div className="input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                placeholder="Nhập mật khẩu mạnh"
                autoComplete="new-password"
                maxLength={128}
                aria-describedby="password-requirements"
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
            <PasswordRequirements value={form.password} />
            {errors.password && <p className="form-error" role="alert">{errors.password}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Xác nhận mật khẩu</label>
            <div className="input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="confirmPassword"
                name="confirmPassword"
                placeholder="Nhập lại mật khẩu"
                autoComplete="new-password"
                maxLength={128}
                value={form.confirmPassword}
                onChange={handleChange}
              />
            </div>
            {errors.confirmPassword && <p className="form-error">{errors.confirmPassword}</p>}
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="spinner"></span> : 'Đăng ký'}
          </button>
        </form>

        <p className="auth-footer">
          Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
        </p>
      </div>
      </div>
    </div>
  );
}

export default RegisterPage;
