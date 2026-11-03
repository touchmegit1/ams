import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useWorkspaceNavigate } from '../../components/common/WorkspaceNavigation.jsx';
import WorkspaceHeader from '../../components/common/WorkspaceHeader.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import '../../assets/styles/course-management.css';

const teacherSections = [
  { id: 'home', label: 'Trang chủ' },
  { id: 'courses', label: 'Khóa học' },
];

export default function TeacherWorkspaceLayout() {
  const { user } = useAuth();
  const navigate = useWorkspaceNavigate();
  const { pathname } = useLocation();
  const onSelect = (id) => {
    navigate(id === 'courses' ? '/courses' : '/dashboard');
  };

  if (user?.role !== 'TEACHER' && user?.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;

  return (
    <div className="dashboard-container course-workspace">
      <WorkspaceHeader sections={teacherSections} activeId={pathname.startsWith('/courses') ? 'courses' : 'home'} onSelect={onSelect} />
      <Outlet />
    </div>
  );
}
