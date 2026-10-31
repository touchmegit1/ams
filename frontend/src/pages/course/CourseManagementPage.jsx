import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import CourseForm from '../../components/course/CourseForm.jsx';
import '../../assets/styles/course-management.css';

const errorMessage = (error) => error.response?.data?.message || 'Something went wrong. Please try again.';
const money = (value) => Number(value || 0) === 0
  ? 'Free'
  : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);

function CourseManagementPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [courses, setCourses] = useState([]);
  const [structures, setStructures] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(() => ['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(searchParams.get('status')) ? searchParams.get('status') : 'ALL');
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [pageSize, setPageSize] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingCourse, setEditingCourse] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await api.get('/courses');
      const courseList = Array.isArray(response.data) ? response.data : [];
      setCourses(courseList);
      const structureEntries = await Promise.all(courseList.map(async (course) => {
        try {
          const { data } = await api.get(`/courses/${course.courseId}/modules`);
          const modules = Array.isArray(data) ? data : [];
          return [course.courseId, { modules: modules.length, lessons: modules.reduce((sum, module) => sum + (module.lessons?.length || 0), 0) }];
        } catch {
          return [course.courseId, { modules: null, lessons: null }];
        }
      }));
      setStructures(Object.fromEntries(structureEntries));
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCourses(); }, [loadCourses]);

  useEffect(() => {
    const status = searchParams.get('status');
    setStatusFilter(['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status) ? status : 'ALL');
  }, [searchParams]);

  const visibleCourses = useMemo(() => courses.filter((course) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [course.courseCode, course.title, course.subject, course.description]
      .some((value) => value?.toLowerCase().includes(query));
    return matchesSearch && (statusFilter === 'ALL' || course.status === statusFilter)
      && (subjectFilter === 'ALL' || course.subject === subjectFilter);
  }), [courses, search, statusFilter, subjectFilter]);
  const subjects = useMemo(() => [...new Set(courses.map((course) => course.subject).filter(Boolean))].sort(), [courses]);
  const totalPages = Math.max(1, Math.ceil(visibleCourses.length / pageSize));
  const pageCourses = useMemo(() => visibleCourses.slice((currentPage - 1) * pageSize, currentPage * pageSize), [visibleCourses, currentPage, pageSize]);
  const pageNumbers = useMemo(() => {
    const pages = [...new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1].filter((page) => page >= 1 && page <= totalPages))].sort((a, b) => a - b);
    return pages.flatMap((page, index) => index && page - pages[index - 1] > 1 ? [`gap-${page}`, page] : [page]);
  }, [currentPage, totalPages]);

  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, subjectFilter, pageSize]);
  useEffect(() => { setCurrentPage((page) => Math.min(page, totalPages)); }, [totalPages]);

  const openCreate = () => {
    setEditingCourse(null);
    setSubmitError('');
    setShowForm(true);
  };

  const openEdit = (course) => {
    setEditingCourse(course);
    setSubmitError('');
    setShowForm(true);
  };

  const saveCourse = async (payload) => {
    setSaving(true);
    setSubmitError('');
    try {
      if (editingCourse) await api.put(`/courses/${editingCourse.courseId}`, payload);
      else await api.post('/courses', payload);
      setShowForm(false);
      await loadCourses();
      toast.success(editingCourse ? 'Course updated' : 'Course created');
    } catch (error) {
      const message = error.response?.data?.message || 'Could not save this course';
      setSubmitError(message);
    } finally {
      setSaving(false);
    }
  };

  const deleteCourse = async (course) => {
    if (!window.confirm(`Delete “${course.title}” and all of its modules and lessons?`)) return;
    try {
      await api.delete(`/courses/${course.courseId}`);
      setCourses((current) => current.filter((item) => item.courseId !== course.courseId));
      toast.success('Course deleted');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const isManager = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  if (!isManager) {
    return (
      <main className="cm-page">
        <section className="cm-empty-state"><h1>Course management is for teachers</h1><p>Your account can’t manage courses.</p><Link to="/dashboard" className="cm-button cm-button-primary">Back to dashboard</Link></section>
      </main>
    );
  }

  return (
    <main className="cm-page">
      <div className="cm-container">
        <div className="cm-breadcrumb"><Link to="/dashboard">Overview</Link><span>/</span><strong>Courses</strong></div>
        <section className="cm-page-heading">
          <div>
            <p className="cm-eyebrow">TEACHING WORKSPACE</p>
            <h1>Courses &amp; Curriculum Management</h1>
            <p>Manage courses and build their modules and lessons.</p>
          </div>
          <button className="cm-button cm-button-primary" onClick={openCreate}>＋ Create course</button>
        </section>

        <section className="cm-toolbar cm-course-filters" aria-label="Course filters">
          <label className="cm-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search course code, title, or scope" /></label>
          <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ALL">All statuses</option><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option>
          </select>
          <select aria-label="Filter by subject" value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
            <option value="ALL">All subjects</option>{subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
          </select>
          {(search || statusFilter !== 'ALL' || subjectFilter !== 'ALL') && <button className="cm-button cm-button-quiet" onClick={() => { setSearch(''); setStatusFilter('ALL'); setSubjectFilter('ALL'); }}>Reset</button>}
        </section>

        {loadError && <div className="cm-alert" role="alert"><span>{loadError}</span><button onClick={loadCourses}>Retry</button></div>}
        <section className="cm-panel">
          <div className="cm-panel-heading"><div><h2>Your courses</h2><p>{loading ? 'Loading…' : `Showing ${visibleCourses.length ? (currentPage - 1) * pageSize + 1 : 0}–${Math.min(currentPage * pageSize, visibleCourses.length)} of ${visibleCourses.length} matching courses`}</p></div><label className="cm-page-size">Rows per page<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option></select></label></div>
          {loading ? <div className="cm-loading">Loading your courses…</div> : visibleCourses.length === 0 ? (
            <div className="cm-empty-state"><div className="cm-empty-icon">▤</div><h3>{courses.length ? 'No matching courses' : 'Start with your first course'}</h3><p>{courses.length ? 'Try another search or status filter.' : 'Add course details, then build its modules and lessons manually.'}</p>{!courses.length && <button className="cm-button cm-button-primary" onClick={openCreate}>Create a course</button>}</div>
          ) : (
            <div className="cm-table-wrap">
              <table className="cm-table cm-course-table">
                <thead><tr><th>Course code</th><th>Course title &amp; scope</th><th>Structure</th><th>Price</th><th>Status</th><th>Last updated</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>{pageCourses.map((course) => (
                  <tr key={course.courseId}>
                    <td><strong className="cm-code-value">{course.courseCode}</strong></td>
                    <td><div className="cm-course-name"><Link className="cm-course-title-link" to={`/courses/${course.courseId}`}>{course.title}</Link><small>{course.description || course.subject || 'No scope provided yet'}{course.targetAudience ? ` · ${course.targetAudience}` : ''}</small></div></td>
                    <td>{structures[course.courseId]?.modules == null ? '—' : <><strong>{structures[course.courseId].modules} {structures[course.courseId].modules === 1 ? 'Module' : 'Modules'}</strong><small className="cm-subline">{structures[course.courseId].lessons} Lessons</small></>}</td>
                    <td>{money(course.price)}</td>
                    <td><span className={`cm-status cm-status-${course.status.toLowerCase()}`}>{course.status}</span></td>
                    <td>{course.updatedAt ? new Date(course.updatedAt).toLocaleDateString() : course.createdAt ? new Date(course.createdAt).toLocaleDateString() : '—'}</td>
                    <td><div className="cm-row-actions"><button className="cm-button cm-button-small" onClick={() => navigate(`/courses/${course.courseId}`)}>Curriculum</button><button className="cm-button cm-button-small cm-button-quiet" onClick={() => openEdit(course)}>Edit</button><button className="cm-button cm-button-small cm-button-danger" onClick={() => deleteCourse(course)}>Delete</button></div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {!loading && visibleCourses.length > 0 && <nav className="cm-pagination" aria-label="Course pages">
            <span>Page {currentPage} of {totalPages}</span>
            <div className="cm-pagination-controls">
              <button className="cm-button cm-button-small" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} aria-label="First page">«</button>
              <button className="cm-button cm-button-small" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>Previous</button>
              {pageNumbers.map((page) => typeof page === 'string' ? <span className="cm-page-gap" key={page}>…</span> : <button key={page} className={`cm-button cm-button-small cm-page-number${currentPage === page ? ' active' : ''}`} onClick={() => setCurrentPage(page)} aria-current={currentPage === page ? 'page' : undefined}>{page}</button>)}
              <button className="cm-button cm-button-small" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}>Next</button>
              <button className="cm-button cm-button-small" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} aria-label="Last page">»</button>
            </div>
          </nav>}
        </section>
      </div>

      {showForm && <CourseForm initialCourse={editingCourse} onClose={() => setShowForm(false)} onSubmit={saveCourse} saving={saving} submitError={submitError} />}
    </main>
  );
}

export default CourseManagementPage;
