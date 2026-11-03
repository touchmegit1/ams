import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiUsers,
  FiDollarSign,
  FiBookOpen,
  FiLogOut,
  FiBell
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext.jsx';
import AdminAccounts from './AdminAccounts.jsx';
import AdminPayments from './AdminPayments.jsx';
import AdminCourses from './AdminCourses.jsx';
import './admin.css';

export default function AdminPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState('courses'); // can default to 'courses' or 'payments'

  const signOut = async () => {
    await logout();
    navigate('/login');
  };

  const userInitial = user?.fullName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'A';

  return (
    <div className="admin-shell">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark">A</span>
          <div>
            <strong>AMS</strong>
            <small>ADMIN CONSOLE</small>
          </div>
        </div>

        <div className="admin-sidebar-caption">QUẢN LÝ HỆ THỐNG</div>

        <nav className="admin-side-nav">
          <button
            className={`admin-side-link ${section === 'accounts' ? 'active' : ''}`}
            onClick={() => setSection('accounts')}
          >
            <FiUsers /> Tài khoản
          </button>
          <button
            className={`admin-side-link ${section === 'payments' ? 'active' : ''}`}
            onClick={() => setSection('payments')}
          >
            <FiDollarSign /> Doanh thu & Thanh toán
          </button>
          <button
            className={`admin-side-link ${section === 'courses' ? 'active' : ''}`}
            onClick={() => setSection('courses')}
          >
            <FiBookOpen /> Khóa học hệ thống
          </button>
        </nav>

        {/* Sidebar Footer with Webhook Status */}
        <div className="admin-sidebar-bottom">
          <div className="admin-webhook-pill">
            <span className="webhook-pulse-dot" />
            <span className="webhook-status-text">VietQR Webhook: Kết nối ổn định</span>
          </div>

          <div className="admin-side-user">
            <span className="admin-user-avatar">{userInitial}</span>
            <div>
              <strong>{user?.fullName || 'Admin AMS'}</strong>
              <small>Quản trị viên</small>
            </div>
          </div>
          <button className="admin-logout-btn" onClick={signOut}>
            <FiLogOut /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <main className="admin-main">
        {/* Topbar */}
        <header className="admin-topbar">
          <div className="admin-breadcrumb">
            <span>Quản trị</span>
            <span className="breadcrumb-separator">/</span>
            {section === 'accounts' && <span>Quản lý Người dùng & Phân quyền</span>}
            {section === 'payments' && (
              <>
                <span>Doanh thu & Thanh toán</span>
                <span className="breadcrumb-separator">/</span>
                <strong>Doanh thu theo Giảng viên & Khóa học</strong>
              </>
            )}
            {section === 'courses' && (
              <>
                <span>Quản trị Đào tạo</span>
                <span className="breadcrumb-separator">/</span>
                <strong>Khóa học Hệ thống</strong>
              </>
            )}
          </div>

          <div className="admin-topbar-right">
            <div className="admin-notif-btn" title="Thông báo hệ thống">
              <FiBell />
              <span className="notif-badge-dot" />
            </div>

            <div className="admin-top-profile">
              <span className="top-avatar-circle">AD</span>
              <span className="top-email">{user?.email || 'admin@gmail.com'}</span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="admin-content-viewport">
          {section === 'accounts' && <AdminAccounts />}
          {section === 'payments' && <AdminPayments />}
          {section === 'courses' && <AdminCourses />}
        </div>
      </main>
    </div>
  );
}
