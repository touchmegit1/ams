import api from './api';

const authService = {
  /** Đăng ký tài khoản */
  register: (data) => api.post('/auth/register', data),

  /** Xác thực OTP */
  verifyOtp: (data) => api.post('/auth/verify-otp', data),

  /** Gửi lại OTP */
  resendOtp: (email) => api.post(`/auth/resend-otp?email=${encodeURIComponent(email)}`),

  /** Đăng nhập email/password */
  login: (data) => api.post('/auth/login', data),

  /** Đăng nhập Google */
  googleLogin: (idToken) => api.post('/auth/google-login', { idToken }),
};

export default authService;
