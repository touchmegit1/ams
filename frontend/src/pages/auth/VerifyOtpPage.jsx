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
    try {
      await authService.resendOtp(email);
      toast.success('Đã gửi lại mã OTP! Kiểm tra email.');
      setCountdown(60);
      setCanResend(false);
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gửi lại OTP thất bại');
    }
  };

  if (!email) return null;

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="logo">✉️</div>
        <h1>Xác thực OTP</h1>
        <p className="subtitle">
          Mã OTP đã được gửi đến<br />
          <strong>{email}</strong>
        </p>

        <form onSubmit={handleSubmit}>
          <div className="otp-inputs" onPaste={handlePaste}>
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
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
            <button onClick={handleResend}>Gửi lại mã OTP</button>
          ) : (
            <span>Gửi lại sau <strong>{countdown}s</strong></span>
          )}
        </div>

        <p className="auth-footer">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/register'); }}>
            ← Quay lại đăng ký
          </a>
        </p>
      </div>
    </div>
  );
}

export default VerifyOtpPage;
