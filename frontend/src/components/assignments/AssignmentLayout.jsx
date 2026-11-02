import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { SmoothLink as Link, useWorkspaceNavigate as useNavigate } from '../common/WorkspaceNavigation.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import WorkspaceHeader from '../common/WorkspaceHeader.jsx';
import '../../assets/styles/assignments.css';

const sections = [{ id: 'home', label: 'Trang chủ' }, { id: 'courses', label: 'Khóa học' }];
export default function AssignmentLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  if (!['TEACHER', 'ADMIN'].includes(user?.role?.toUpperCase())) return <Navigate to="/forbidden" replace />;
  return <div className="assignment-app dashboard-container">
    <WorkspaceHeader sections={sections} activeId="courses" onSelect={(id) => id === 'courses' ? navigate('/courses') : navigate('/dashboard')} />
    <main className="assignment-main">
      <nav className="assignment-tabs" aria-label="Quản lý bài tập"><Link aria-current={location.pathname.startsWith('/teacher/assignments') ? 'page' : undefined} to="/teacher/assignments">Bài tập môn học</Link><Link aria-current={location.pathname.startsWith('/teacher/assignment-templates') ? 'page' : undefined} to="/teacher/assignment-templates">Thư viện mẫu</Link></nav>
      <Outlet />
    </main>
  </div>;
}
