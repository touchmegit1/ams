import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../services/api.js';
import '../../assets/styles/course-management.css';
import './teacher-dashboard.css';

function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const isManager = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  useEffect(() => {
    if (!isManager) return;
    let active = true;
    setLoading(true);
    api.get('/courses')
      .then(({ data }) => { if (active) setCourses(Array.isArray(data) ? data : []); })
      .catch((error) => { if (active) setLoadError(error.response?.data?.message || 'Could not load your courses.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isManager]);

  const counts = useMemo(() => ({
    total: courses.length,
    published: courses.filter((course) => course.status === 'PUBLISHED').length,
    draft: courses.filter((course) => course.status === 'DRAFT').length,
    archived: courses.filter((course) => course.status === 'ARCHIVED').length,
  }), [courses]);
  const recentCourses = useMemo(() => [...courses]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
    .slice(0, 5), [courses]);

  if (isManager) {
    return (
      <div className="td-dashboard-content">
        <div className="td-heading-row">
          <div><p className="cm-eyebrow">TEACHING WORKSPACE</p><h1>Welcome back, {user?.fullName?.split(' ')[0] || 'teacher'}</h1><p>Manage your courses, curriculum, and publishing status from one place.</p></div>
          <Link className="cm-button cm-button-primary" to="/courses">＋ Manage courses</Link>
        </div>
        {loadError && <div className="cm-alert" role="alert"><span>{loadError}</span><button onClick={() => window.location.reload()}>Retry</button></div>}
        <section className="td-stats" aria-label="Course summary">
          <article className="td-stat td-stat-total"><span className="td-stat-icon">▤</span><div><span>Total courses</span><strong>{loading ? '—' : counts.total}</strong></div></article>
          <article className="td-stat td-stat-published"><span className="td-stat-icon">✓</span><div><span>Published</span><strong>{loading ? '—' : counts.published}</strong></div></article>
          <article className="td-stat td-stat-draft"><span className="td-stat-icon">✎</span><div><span>Drafts</span><strong>{loading ? '—' : counts.draft}</strong></div></article>
          <article className="td-stat td-stat-archived"><span className="td-stat-icon">▣</span><div><span>Archived</span><strong>{loading ? '—' : counts.archived}</strong></div></article>
        </section>
        <section className="td-main-grid">
          <div className="cm-panel td-recent-panel">
            <div className="cm-panel-heading"><div><h2>Recent courses</h2><p>Your latest course updates</p></div><Link className="cm-text-link" to="/courses">View all →</Link></div>
            {loading ? <div className="cm-loading">Loading your courses…</div> : recentCourses.length === 0 ? (
              <div className="td-empty"><span className="td-empty-icon">▤</span><h3>No courses yet</h3><p>Create your first course, then add modules and lessons to build its curriculum.</p><Link className="cm-button cm-button-primary" to="/courses">Get started</Link></div>
            ) : <div className="td-course-list">{recentCourses.map((course) => <article className="td-course-item" key={course.courseId}><div className="td-course-copy"><span className="cm-course-code">{course.courseCode}</span><strong>{course.title}</strong><small>{course.subject || 'No subject'} · Updated {course.updatedAt || course.createdAt ? new Date(course.updatedAt || course.createdAt).toLocaleDateString() : 'recently'}</small></div><span className={`cm-status cm-status-${(course.status || 'DRAFT').toLowerCase()}`}>{course.status || 'DRAFT'}</span><Link className="cm-button cm-button-small" to={`/courses/${course.courseId}`}>Curriculum</Link></article>)}</div>}
          </div>
          <aside className="td-side-column">
            <section className="td-action-card td-guide-card"><span className="td-guide-label">QUICK GUIDE</span><h2>Build your curriculum</h2><ol><li><span>1</span><p>Create or edit a course</p></li><li><span>2</span><p>Add modules in learning order</p></li><li><span>3</span><p>Add lessons and publish when ready</p></li></ol></section>
          </aside>
        </section>
      </div>
    );
  }

  const initials = user?.fullName?.split(' ').map((word) => word[0]).join('').toUpperCase().slice(0, 2) || '?';
  return (
    <div className="dashboard-container">
      <header className="dashboard-header"><span className="logo-text">📚 AMS</span><div className="user-info"><div className="avatar">{user?.avatarUrl ? <img src={user.avatarUrl} alt={user.fullName} /> : initials}</div><div><div style={{ fontWeight: 600, fontSize: 14 }}>{user?.fullName}</div><div style={{ fontSize: 12, color: '#6b7280' }}>{user?.email}</div></div><button className="btn-logout" onClick={() => { logout(); navigate('/login'); }}>Đăng xuất</button></div></header>
      <main className="dashboard-content"><div className="welcome-card"><h2>Xin chào, {user?.fullName}! 👋</h2><p>Chào mừng bạn đến với Assignment Management System.</p><span className="role-badge">🎓 Sinh viên</span></div></main>
    </div>
  );
}

export default DashboardPage;
