import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import '../../assets/styles/course-management.css';
import './teacher-dashboard.css';

function TeacherWorkspaceLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem('teacherSidebarOpen') !== 'false');
  const isManager = user?.role === 'TEACHER' || user?.role === 'ADMIN';
  const initials = user?.fullName?.split(' ').map((word) => word[0]).join('').toUpperCase().slice(0, 2) || '?';

  if (!isManager) return <Outlet />;

  const isCourses = location.pathname.startsWith('/courses');
  const toggleSidebar = () => setSidebarOpen((open) => {
    localStorage.setItem('teacherSidebarOpen', String(!open));
    return !open;
  });

  return (
    <div className="dashboard-container teacher-dashboard">
      <header className="dashboard-header">
        <div className="td-header-left">
          {!sidebarOpen && <button className="td-sidebar-toggle td-sidebar-toggle-icon" type="button" onClick={toggleSidebar} aria-expanded="false" aria-label="Show sidebar" title="Show sidebar">☰</button>}
          <Link to="/dashboard" className="td-brand"><span className="td-brand-mark">A</span> AMS</Link>
        </div>
        <div className="user-info">
          <div className="avatar">{user?.avatarUrl ? <img src={user.avatarUrl} alt={user.fullName} /> : initials}</div>
          <div className="td-user"><strong>{user?.fullName}</strong><span>{user?.email}</span></div>
          <button className="btn-logout" onClick={() => { logout(); navigate('/login'); }}>Đăng xuất</button>
        </div>
      </header>
      <div className={`td-layout${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
        {sidebarOpen && <aside className="td-sidebar" id="teacher-sidebar" aria-label="Teacher navigation">
          <button className="td-sidebar-collapse" type="button" onClick={toggleSidebar} aria-expanded="true" aria-label="Hide sidebar"><span aria-hidden="true">☰</span> Hide menu</button>
          <p className="td-sidebar-label">WORKSPACE</p>
          <nav className="td-sidebar-nav">
            <NavLink end to="/dashboard" className={`td-nav-link${location.pathname === '/dashboard' ? ' active' : ''}`}><span className="td-nav-icon">⌂</span>Overview</NavLink>
            <NavLink to="/courses" className={`td-nav-link${isCourses ? ' active' : ''}`}><span className="td-nav-icon">▤</span>Courses</NavLink>
          </nav>
        </aside>}
        <main className="td-content"><Outlet /></main>
      </div>
    </div>
  );
}

export default TeacherWorkspaceLayout;
