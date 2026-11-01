import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiMail } from 'react-icons/fi';
import PasswordRecoveryLayout from '../../components/common/PasswordRecoveryLayout.jsx';
import authService from '../../services/authService.js';

function ForgotPasswordPage() {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [sentEmail, setSentEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!resendAt) return;
    const tick = () => setCountdown(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);

  const sendLink = async (targetEmail) => {
    if (loading) return;
    setLoading(true);
    setError('');
    setNotice('');
    try {
      await authService.forgotPassword(targetEmail);
      setSentEmail(targetEmail);
      setCountdown(60);
      setResendAt(Date.now() + 60000);
      setNotice('Yêu cầu đã được tiếp nhận. Vui lòng kiểm tra email của bạn.');
    } catch (err) {
      const data = err.response?.data;
      if (data?.email && !sentEmail) setEmailError(data.email);
      else setError(data?.message || data?.email || 'Không thể gửi yêu cầu. Kiểm tra kết nối và thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const value = email.trim();
    if (!value) return setEmailError('Vui lòng nhập email');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return setEmailError('Email không hợp lệ');
    setEmailError('');
    sendLink(value);
  };

  return (
    <PasswordRecoveryLayout>
      <p className="recovery-step">BƯỚC {sentEmail ? '02' : '01'} / 03</p>
      {sentEmail ? (
        <>
          <div className="recovery-icon"><FiMail aria-hidden="true" /></div>
          <h1>Kiểm tra email</h1>
          <p className="subtitle">Nếu <strong className="recovery-email">{sentEmail}</strong> thuộc tài khoản đã xác thực có mật khẩu, bạn sẽ nhận được liên kết đặt lại mật khẩu.</p>
          <div className="recovery-note">
            <p>Mở email từ AMS và nhấn liên kết để nhập mật khẩu mới. Liên kết có hiệu lực trong <strong>30 phút</strong> và chỉ dùng một lần.</p>
            <p>Chưa thấy email? Kiểm tra mục thư rác. Nếu yêu cầu gửi lại, hãy sử dụng liên kết trong email mới nhất.</p>
          </div>
          <p className="recovery-status" role="status">{notice}</p>
          <button type="button" className="btn btn-primary" disabled={loading || countdown > 0}
            onClick={() => sendLink(sentEmail)}>
            {loading ? 'Đang gửi…' : countdown > 0 ? `Gửi lại sau ${countdown}s` : 'Gửi lại liên kết'}
          </button>
          {error && <p className="auth-submit-error" role="alert">{error}</p>}
          <button type="button" className="recovery-change-email" disabled={loading} onClick={() => {
            setSentEmail(''); setError(''); setNotice(''); setEmailError('');
          }}>Nhập email khác</button>
        </>
      ) : (
        <>
          <h1>Quên mật khẩu?</h1>
          <p className="subtitle">Nhập email đã đăng ký. AMS sẽ gửi liên kết để bạn đặt lại mật khẩu.</p>
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="recovery-email">Email</label>
              <div className="input-wrapper">
                <input id="recovery-email" type="email" autoComplete="email" maxLength={150}
                  placeholder="your@email.com" value={email} disabled={loading}
                  aria-invalid={!!emailError} aria-describedby={emailError ? 'recovery-email-error' : undefined}
                  onChange={(event) => { setEmail(event.target.value); setEmailError(''); setError(''); }} />
              </div>
              {emailError && <p id="recovery-email-error" className="form-error" role="alert">{emailError}</p>}
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Đang gửi…' : 'Gửi liên kết đặt lại mật khẩu'}
            </button>
            {error && <p className="auth-submit-error" role="alert">{error}</p>}
          </form>
        </>
      )}
      <p className="recovery-help">Tài khoản chỉ dùng Google: chọn đăng nhập bằng Google. Tài khoản mới cần hoàn tất xác thực email trước.</p>
      <p className="auth-footer"><Link to="/login">Quay lại đăng nhập</Link></p>
    </PasswordRecoveryLayout>
  );
}

export default ForgotPasswordPage;
