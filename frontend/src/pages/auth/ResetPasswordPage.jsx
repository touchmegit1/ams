import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiCheck, FiEye, FiEyeOff } from 'react-icons/fi';
import PasswordRecoveryLayout from '../../components/common/PasswordRecoveryLayout.jsx';
import authService from '../../services/authService.js';
import { passwordError } from '../../utils/passwordPolicy.js';
import PasswordRequirements from '../../components/common/PasswordRequirements.jsx';
import { clearSession } from '../../services/authSession.js';

function ResetPasswordPage() {
  const location = useLocation();
  const token = new URLSearchParams(location.hash.slice(1)).get('token') || '';
  const validToken = /^[A-Za-z0-9_-]{43}$/.test(token);
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tokenCheck, setTokenCheck] = useState({ token: '', status: 'checking', message: '' });
  const [checkAttempt, setCheckAttempt] = useState(0);

  useEffect(() => {
    if (!validToken) return;
    let active = true;
    setTokenCheck({ token, status: 'checking', message: '' });
    setSuccess(false);
    setForm({ password: '', confirmPassword: '' });
    authService.validateResetToken(token).then(() => {
      if (active) setTokenCheck({ token, status: 'valid', message: '' });
    }).catch(err => {
      if (!active) return;
      const invalid = err.response?.status === 400;
      setTokenCheck({ token, status: invalid ? 'invalid' : 'error',
        message: err.response?.data?.message || 'Chưa thể kiểm tra liên kết. Kiểm tra kết nối rồi thử lại.' });
    });
    return () => { active = false; };
  }, [token, validToken, checkAttempt]);

  const linkStatus = !validToken ? 'invalid' : tokenCheck.token === token ? tokenCheck.status : 'checking';

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading || linkStatus !== 'valid') return;
    const nextErrors = {};
    const passwordMessage = passwordError(form.password);
    if (passwordMessage) nextErrors.password = passwordMessage;
    if (!form.confirmPassword) nextErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu mới';
    else if (form.password !== form.confirmPassword) nextErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';
    setErrors(nextErrors);
    setSubmitError('');
    if (Object.keys(nextErrors).length) return;
    setLoading(true);
    try {
      await authService.resetPassword({ token, ...form });
      clearSession();
      setForm({ password: '', confirmPassword: '' });
      setSuccess(true);
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object' && !data.message) {
        setErrors({ password: data.password, confirmPassword: data.confirmPassword || data.passwordsMatch });
        setSubmitError(data.token || 'Vui lòng kiểm tra thông tin đã nhập.');
      } else {
        setSubmitError(data?.message || 'Không thể đặt lại mật khẩu. Kiểm tra kết nối và thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <PasswordRecoveryLayout>
      <p className="recovery-step">BƯỚC 03 / 03</p>
      {success ? (
        <>
          <div className="recovery-icon"><FiCheck aria-hidden="true" /></div>
          <h1>Đặt lại mật khẩu thành công</h1>
          <p className="subtitle" role="status">Mật khẩu đã được cập nhật. Bạn có thể đăng nhập AMS bằng mật khẩu mới.</p>
          <Link className="btn btn-primary" to="/login">Đăng nhập ngay</Link>
        </>
      ) : linkStatus === 'checking' ? (
        <><h1>Đang kiểm tra liên kết</h1><p className="subtitle" role="status">Vui lòng đợi trong giây lát…</p></>
      ) : linkStatus === 'error' ? (
        <><h1>Chưa thể kiểm tra liên kết</h1><p className="subtitle" role="alert">{tokenCheck.message}</p>
          <button className="btn btn-primary" onClick={() => setCheckAttempt(value => value + 1)}>Thử lại</button>
          <p className="auth-footer"><Link to="/forgot-password">Yêu cầu liên kết mới</Link></p></>
      ) : linkStatus === 'invalid' ? (
        <>
          <h1>Liên kết không hợp lệ</h1>
          <p className="subtitle" role="alert">Liên kết đặt lại mật khẩu không đúng, đã hết hạn hoặc đã sử dụng. Vui lòng yêu cầu liên kết mới.</p>
          <Link className="btn btn-primary" to="/forgot-password">Yêu cầu liên kết mới</Link>
          <p className="auth-footer"><Link to="/login">Quay lại đăng nhập</Link></p>
        </>
      ) : (
        <>
          <h1>Đặt lại mật khẩu</h1>
          <p className="subtitle">Nhập mật khẩu mới cho tài khoản AMS của bạn.</p>
          <form onSubmit={handleSubmit} noValidate>
            {[
              { name: 'password', label: 'Mật khẩu mới', placeholder: 'Nhập mật khẩu mạnh' },
              { name: 'confirmPassword', label: 'Xác nhận mật khẩu mới', placeholder: 'Nhập lại mật khẩu mới' },
            ].map(({ name, label, placeholder }) => (
              <div className="form-group" key={name}>
                <label htmlFor={name}>{label}</label>
                <div className="input-wrapper">
                  <input id={name} name={name} type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password" placeholder={placeholder} maxLength={128}
                    value={form[name]} disabled={loading} aria-invalid={!!errors[name]}
                    aria-describedby={[name === 'password' && 'password-requirements', errors[name] && `${name}-error`].filter(Boolean).join(' ') || undefined}
                    onChange={(event) => {
                      setForm({ ...form, [name]: event.target.value });
                      setErrors({}); setSubmitError('');
                    }} />
                  {name === 'password' && <button type="button" className="toggle-password"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
                  </button>}
                </div>
                {name === 'password' && <PasswordRequirements value={form.password} />}
                {errors[name] && <p id={`${name}-error`} className="form-error" role="alert">{errors[name]}</p>}
              </div>
            ))}
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Đang cập nhật…' : 'Lưu mật khẩu mới'}
            </button>
            {submitError && <p className="auth-submit-error" role="alert">{submitError}</p>}
          </form>
          <p className="recovery-help">Liên kết hết hạn hoặc đã sử dụng? <Link to="/forgot-password">Yêu cầu liên kết mới</Link></p>
          <p className="auth-footer"><Link to="/login">Quay lại đăng nhập</Link></p>
        </>
      )}
    </PasswordRecoveryLayout>
  );
}

export default ResetPasswordPage;
