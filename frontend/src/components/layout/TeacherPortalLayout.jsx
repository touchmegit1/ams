import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  FiGrid,
  FiBookOpen,
  FiFileText,
  FiUsers,
  FiCheckCircle,
  FiBookmark,
  FiSettings,
  FiSearch,
  FiCalendar,
  FiBell,
  FiChevronDown,
  FiLogOut,
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../services/api.js';
import '../../assets/styles/teacher-portal.css';

export default function TeacherPortalLayout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [overview, setOverview] = useState(null);
  const [coursesCount, setCoursesCount] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/teacher/overview')
      .then(({ data }) => {
        if (active) setOverview(data);
      })
      .catch(() => {});

    api.get('/courses')
      .then(({ data }) => {
        if (active && Array.isArray(data)) setCoursesCount(data.length);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [location.pathname]);

  const currentPath = location.pathname;

  const navItems = [
    {
      to: '/dashboard',
      label: 'Tổng quan',
      icon: FiGrid,
      active: currentPath === '/dashboard',
    },
    {
      to: '/courses',
      label: 'Quản lý khóa học',
      icon: FiBookOpen,
      badge: coursesCount == null ? undefined : `${coursesCount} khóa`,
      active: currentPath === '/courses' || (currentPath.startsWith('/courses/') && !currentPath.includes('/students')),
    },
    {
      to: '/teacher/assignments',
      label: 'Quản lý bài tập',
      icon: FiFileText,
      active: currentPath === '/teacher/assignments' && !location.search.includes('tab=grading'),
    },
    {
      to: '/teacher/students',
      label: 'Quản lý sinh viên',
      icon: FiUsers,
      active: currentPath === '/teacher/students' || currentPath.includes('/students'),
    },
    {
      to: '/teacher/assignments?tab=grading',
      label: 'Chấm điểm & Đánh giá',
      icon: FiCheckCircle,
      badge: overview?.submissionsToReview > 0 ? String(overview.submissionsToReview) : undefined,
      badgeHighlight: true,
      active: location.search.includes('tab=grading'),
    },
    {
      to: '/teacher/assignment-templates',
      label: 'Thư viện đề & Mẫu',
      icon: FiBookmark,
      active: currentPath.startsWith('/teacher/assignment-templates'),
    },
    {
      to: '/profile',
      label: 'Cài đặt giảng dạy',
      icon: FiSettings,
      active: currentPath === '/profile',
    },
  ];

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigate(`/courses?search=${encodeURIComponent(searchQuery)}`);
  };

  const displayName = user?.fullName || 'TS. Mai Phương';
  const displayRole = user?.role === 'TEACHER' ? 'Giảng viên chính' : 'Quản trị viên';

  return (
    <div className="tp-shell">
      {/* Sidebar */}
      <aside className="tp-sidebar">
        <div className="tp-sidebar-brand">
          <div className="tp-sidebar-logo">AMS</div>
          <div className="tp-sidebar-brand-text">
            <span className="tp-sidebar-brand-title">AMS Portal</span>
            <span className="tp-sidebar-brand-badge">ACADEMY SYSTEM</span>
          </div>
        </div>

        <nav className="tp-sidebar-nav">
          <div className="tp-sidebar-label">KHÔNG GIAN LÀM VIỆC</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`tp-sidebar-item ${item.active ? 'is-active' : ''}`}
              >
                <div className="tp-sidebar-item-left">
                  <span className="tp-sidebar-item-icon">
                    <Icon />
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`tp-sidebar-badge ${item.badgeHighlight ? 'is-highlight' : ''}`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom grading progress widget */}
        <div className="tp-sidebar-widget">
          <div className="tp-sidebar-widget-top">
            <span>BÀI CẦN DUYỆT</span>
            <span className="tp-sidebar-widget-pct">{overview?.submissionsToReview ?? '—'}</span>
          </div>
          <div className="tp-sidebar-widget-sub">
            <Link to="/teacher/assignments?tab=grading">Mở hàng đợi chấm điểm</Link>
          </div>
        </div>

        <div className="tp-sidebar-footer">
          <span>AMS v3.2.0 • Học kỳ 1/2026</span>
        </div>
      </aside>

      {/* Main Layout Area */}
      <div className="tp-main">
        {/* Topbar */}
        <header className="tp-topbar">
          <div className="tp-topbar-left">
            <div className="tp-topbar-term">
              <span>Học kỳ 1 (2025 - 2026)</span>
              <FiChevronDown />
            </div>
            <div className="tp-topbar-faculty">
              Khoa Công nghệ Thông tin
            </div>
          </div>

          <div className="tp-topbar-center">
            <form className="tp-search-box" onSubmit={handleSearchSubmit}>
              <FiSearch />
              <input
                type="text"
                placeholder="Tìm nhanh bài học, sinh viên (Ctrl+K)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span className="tp-search-shortcut">⌘K</span>
            </form>
          </div>

          <div className="tp-topbar-right">
            <div className="tp-topbar-term" style={{ background: '#f5faf7' }}>
              <FiCalendar style={{ color: '#2dc48d' }} />
              <span>Lịch thi: <strong>24/03</strong></span>
            </div>

            <button className="tp-icon-btn" title="Thông báo" type="button">
              <FiBell />
              <span className="tp-icon-badge" />
            </button>

            <div style={{ position: 'relative' }}>
              <div
                className="tp-user-profile"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <div className="tp-user-avatar">
                  {displayName.substring(0, 2).toUpperCase()}
                </div>
                <div className="tp-user-details">
                  <span className="tp-user-name">{displayName}</span>
                  <span className="tp-user-role">{displayRole}</span>
                </div>
                <FiChevronDown style={{ color: '#7a9688', fontSize: '14px' }} />
              </div>

              {showUserMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    background: '#ffffff',
                    border: '1px solid #dce7e1',
                    borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    minWidth: '180px',
                    padding: '6px',
                    zIndex: 1000,
                  }}
                >
                  <Link
                    to="/profile"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      fontSize: '13px',
                      color: '#16261f',
                      textDecoration: 'none',
                      borderRadius: '6px',
                    }}
                    onClick={() => setShowUserMenu(false)}
                  >
                    <FiSettings /> Cài đặt hồ sơ
                  </Link>
                  <button
                    type="button"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      color: '#d9383a',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      borderRadius: '6px',
                    }}
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                    }}
                  >
                    <FiLogOut /> Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content body */}
        <main className="tp-content">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
