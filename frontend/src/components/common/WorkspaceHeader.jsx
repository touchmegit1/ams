import { useEffect, useRef, useState } from 'react';
import { useWorkspaceNavigate as useNavigate } from './WorkspaceNavigation.jsx';
import { FiChevronDown, FiUser, FiLogOut } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext.jsx';

export default function WorkspaceHeader({ sections, activeId, onSelect }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const isTeacher = ['TEACHER', 'ADMIN'].includes(user?.role?.toUpperCase());
  const name = user?.fullName || (isTeacher ? 'Giảng viên' : 'Sinh viên');
  const initials = name.trim().split(/\s+/).map((word) => word[0]).slice(-2).join('').toUpperCase();
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event) => { if (event.key === 'Escape' || (event.type === 'pointerdown' && !menuRef.current?.contains(event.target))) setMenuOpen(false); };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, [menuOpen]);
  const handleLogout = async () => { await logout(); navigate('/login'); };
  return (
      <header className="dashboard-header">
        <div className="dashboard-header-inner">
          <button className="dashboard-brand" onClick={() => onSelect('home')} aria-label="AMS - Trang chủ">
            <span className="dashboard-brand-mark">AMS</span>
            <span className="dashboard-brand-name">ASSIGNMENT MANAGEMENT SYSTEM</span>
          </button>
          <nav className="dashboard-nav" aria-label="Điều hướng chính">
            {sections.map(({ id, label }) => (
              <button key={id} type="button" className={activeId === id ? 'dashboard-nav-link is-active' : 'dashboard-nav-link'} onClick={() => onSelect(id)} aria-current={activeId === id ? 'page' : undefined}>{label}</button>
            ))}
          </nav>
          <div className="dashboard-account" ref={menuRef}>
            <button className="dashboard-account-trigger" type="button" aria-label="Mở menu tài khoản" aria-expanded={menuOpen} aria-haspopup="menu" onClick={() => setMenuOpen((open) => !open)}>
              <span className="dashboard-avatar" aria-hidden="true">{user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials}</span>
              <span className="dashboard-account-label"><span className="dashboard-account-name">{name}</span><span className="dashboard-account-role">{isTeacher ? 'Giảng viên' : 'Sinh viên'}</span></span>
              <FiChevronDown aria-hidden="true" />
            </button>
            {menuOpen && <div className="dashboard-account-menu" role="menu">
              <div className="dashboard-menu-user"><span className="dashboard-avatar dashboard-menu-avatar" aria-hidden="true">{user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials}</span><div><strong>{name}</strong><span>{user?.email}</span></div></div>
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); navigate('/profile'); }}><FiUser aria-hidden="true" /> Hồ sơ</button>
              <button type="button" role="menuitem" className="dashboard-menu-logout" onClick={handleLogout}><FiLogOut aria-hidden="true" /> Đăng xuất</button>
            </div>}
          </div>
        </div>
      </header>
  );
}
