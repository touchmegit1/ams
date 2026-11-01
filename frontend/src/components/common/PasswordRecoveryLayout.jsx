function PasswordRecoveryLayout({ children }) {
  return (
    <div className="auth-container auth-page recovery-page">
      <div className="auth-shell">
        <aside className="auth-intro" aria-label="Giới thiệu AMS">
          <div className="auth-brand">AMS <span>·</span> ASSIGNMENT MANAGEMENT SYSTEM</div>
          <div className="auth-intro-content">
            <p className="auth-eyebrow">Trở lại không gian học tập</p>
            <h2>Khôi phục truy cập,<br />tiếp tục hành trình.</h2>
            <p>Đặt lại mật khẩu qua email để tiếp tục theo dõi bài tập và làm việc cùng lớp của bạn.</p>
          </div>
          <div className="auth-intro-footer">Học tập có tổ chức. Tiến bộ có thể thấy.</div>
        </aside>
        <div className="auth-card">{children}</div>
      </div>
    </div>
  );
}

export default PasswordRecoveryLayout;
