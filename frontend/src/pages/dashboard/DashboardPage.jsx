import { useAuth } from '../../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <span className="logo-text">📚 AMS</span>
        <div className="user-info">
          <div className="avatar">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.fullName} />
            ) : (
              getInitials(user?.fullName)
            )}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{user?.fullName}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{user?.email}</div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            Đăng xuất
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="dashboard-content">
        <div className="welcome-card">
          <h2>Xin chào, {user?.fullName}! 👋</h2>
          <p>Chào mừng bạn đến với Assignment Management System.</p>
          <span className="role-badge">
            {user?.role === 'TEACHER' ? '👨‍🏫 Giáo viên' : '🎓 Sinh viên'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
