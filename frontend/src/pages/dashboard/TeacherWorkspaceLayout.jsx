import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useWorkspaceNavigate } from '../../components/common/WorkspaceNavigation.jsx';
import WorkspaceHeader from '../../components/common/WorkspaceHeader.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import '../../assets/styles/course-management.css';

const teacherSections = [
  { id: 'home', label: 'Trang chủ' },
  { id: 'courses', label: 'Khóa học' },
  { id: 'content', label: 'Học phần' },
  { id: 'assignments', label: 'Bài tập' },
  { id: 'students', label: 'Sinh viên' },
];

export default function TeacherWorkspaceLayout() {
  const { user } = useAuth();
  const navigate = useWorkspaceNavigate();
  const { pathname } = useLocation();
  const onSelect = (id) => {
    if (id === 'assignments') navigate('/teacher/assignments');
    else if (id === 'courses' || id === 'content') navigate('/courses');
    else navigate(id === 'home' ? '/dashboard' : '/dashboard?section=students');
  };

  if (user?.role !== 'TEACHER' && user?.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;

  return (
    <div className="dashboard-container course-workspace">
      <WorkspaceHeader sections={teacherSections} activeId={pathname.startsWith('/courses') ? 'courses' : 'home'} onSelect={onSelect} />
      <Outlet />
    </div>
  );
}
