import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext.jsx';
import authService from '../../services/authService.js';

const OTP_LENGTH = 6;

function VerifyOtpPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { saveAuth } = useAuth();

  const email = location.state?.email || '';
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef([]);

  // Nếu không có email → quay lại register
  useEffect(() => {
    if (!email) {
      navigate('/register', { replace: true });
    }
  }, [email, navigate]);

  // Countdown resend OTP
  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleChange = (index, value) => {
    // Chỉ cho nhập số
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Tự nhảy sang ô tiếp theo
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    // Backspace → quay về ô trước
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').trim();
    if (!/^\d+$/.test(pasteData)) return;

    const digits = pasteData.slice(0, OTP_LENGTH).split('');
    const newOtp = [...otp];
    digits.forEach((d, i) => {
      newOtp[i] = d;
    });
    setOtp(newOtp);

    // Focus vào ô cuối hoặc ô tiếp theo
    const focusIndex = Math.min(digits.length, OTP_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length !== OTP_LENGTH) {
      toast.error('Vui lòng nhập đủ 6 chữ số OTP');
      return;
    }

    setLoading(true);
    try {
      const res = await authService.verifyOtp({ email, otpCode });
      saveAuth(res.data);
      toast.success('Xác thực thành công!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Mã OTP không đúng');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending || !canResend) return;
    setResending(true);
    try {
      const res = await authService.resendOtp(email);
      toast.success(res.data.message);
      setCountdown(60);
      setCanResend(false);
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gửi lại OTP thất bại');
    } finally { setResending(false); }
  };

  if (!email) return null;

  return (
    <div className="auth-container auth-page otp-page">
      <div className="auth-shell">
        <aside className="auth-intro" aria-label="Giới thiệu AMS">
          <div className="auth-brand">AMS <span>·</span> ASSIGNMENT MANAGEMENT</div>
          <div className="auth-intro-content">
            <p className="auth-eyebrow">Một bước nữa thôi</p>
            <h2>Xác thực email,<br />bắt đầu học tập.</h2>
            <p>Nhập mã được gửi đến hộp thư để hoàn tất tài khoản và truy cập không gian học tập của bạn.</p>
          </div>
          <div className="auth-intro-footer">Học tập có tổ chức. Tiến bộ có thể thấy.</div>
        </aside>
        <div className="auth-card">
        <p className="otp-step">BƯỚC 02 / 02</p>
        <h1>Xác thực email</h1>
        <p className="subtitle">
          Nhập mã gồm 6 chữ số đã gửi đến 
          <strong>{email}</strong>
        </p>

        <form onSubmit={handleSubmit}>
          <label className="otp-label" htmlFor="otp-digit-0">Mã xác thực</label>
          <div className="otp-inputs" onPaste={handlePaste}>
            {otp.map((digit, index) => (
              <input
                key={index}
                id={'otp-digit-' + index}
                aria-label={'Chữ số ' + (index + 1) + ' của mã xác thực'}
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                autoFocus={index === 0}
              />
            ))}
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="spinner"></span> : 'Xác nhận'}
          </button>
        </form>

        <div className="resend-otp">
          {canResend ? (
            <button type="button" onClick={handleResend} disabled={resending || loading}>{resending ? 'Đang gửi…' : 'Gửi lại mã OTP'}</button>
          ) : (
            <span>Chưa nhận được mã? Gửi lại sau <strong>{countdown}s</strong></span>
          )}
        </div>

        <p className="auth-footer">
          <button type="button" className="auth-back-link" onClick={() => navigate('/register')}>Quay lại đăng ký</button>
        </p>
      </div>
      </div>
    </div>
  );
}

export default VerifyOtpPage;
