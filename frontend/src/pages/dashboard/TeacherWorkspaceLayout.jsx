import { Outlet, useLocation } from 'react-router-dom';
import { useWorkspaceNavigate } from '../../components/common/WorkspaceNavigation.jsx';
import WorkspaceHeader from '../../components/common/WorkspaceHeader.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import StudentCourses from './StudentCourses.jsx';
import '../../assets/styles/course-management.css';

const teacherSections = [
  { id: 'home', label: 'Trang chủ' },
  { id: 'courses', label: 'Khóa học' },
  { id: 'assignments', label: 'Bài tập' },
];

const studentCourseSections = [
  { id: 'home', label: 'Trang chủ' },
  { id: 'courses', label: 'Khóa học' },
  { id: 'enrollment', label: 'Đăng ký học' },
];

export default function TeacherWorkspaceLayout() {
  const { user } = useAuth();
  const navigate = useWorkspaceNavigate();
  const { pathname } = useLocation();
  const isManager = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  const onSelect = (id) => {
    if (id === 'courses') navigate('/courses');
    else if (id === 'assignments') navigate('/teacher/assignments');
    else navigate('/dashboard');
  };

  if (!isManager) {
    const courseMatch = pathname.match(/^\/courses\/(\d+)/);
    const selectedCourseId = courseMatch?.[1] || null;
    return (
      <div className="dashboard-container">
        <WorkspaceHeader sections={studentCourseSections} activeId="courses" onSelect={(id) => {
          if (id === 'courses') navigate('/courses');
          else navigate(id === 'home' ? '/dashboard' : `/dashboard?section=${id}`);
        }} />
        <main className="dashboard-content">
          <StudentCourses initialView="catalog" initialCourseId={selectedCourseId} onCourseChange={(id) => navigate(id ? `/courses/${id}` : '/courses')} />
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-container course-workspace">
      <WorkspaceHeader
        sections={teacherSections}
        activeId={pathname.startsWith('/courses') ? 'courses' : pathname.startsWith('/teacher') ? 'assignments' : 'home'}
        onSelect={onSelect}
      />
      <Outlet />
    </div>
  );
}
