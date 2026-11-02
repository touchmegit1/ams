import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import TeacherPortalLayout from '../layout/TeacherPortalLayout.jsx';
import '../../assets/styles/assignments.css';

export default function AssignmentLayout() {
  const { user } = useAuth();

  if (!['TEACHER', 'ADMIN'].includes(user?.role?.toUpperCase())) {
    return <Navigate to="/forbidden" replace />;
  }

  return (
    <TeacherPortalLayout>
      <Outlet />
    </TeacherPortalLayout>
  );
}
