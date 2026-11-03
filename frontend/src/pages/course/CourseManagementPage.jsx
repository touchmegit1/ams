import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiArrowRight, FiBookOpen, FiEdit2, FiLayers, FiTrash2, FiUsers } from 'react-icons/fi';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import CourseForm from '../../components/course/CourseForm.jsx';
import { courseStatusLabel, formatCoursePrice } from './courseUi.js';
import '../../assets/styles/course-management.css';

const errorMessage = (error) => error.response?.data?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.';
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
  const [showForm, setShowForm] = useState(() => searchParams.get('create') === '1');
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [response, workspaceResponse] = await Promise.all([
        api.get('/courses'),
        api.get('/teacher/courses').catch(() => null),
      ]);
      const courseList = Array.isArray(response.data) ? response.data : [];
      const workspaceById = new Map((Array.isArray(workspaceResponse?.data) ? workspaceResponse.data : []).map((course) => [String(course.courseId), course]));
      const coursesWithMetrics = courseList.map((course) => ({ ...course, ...workspaceById.get(String(course.courseId)) }));
      setCourses(coursesWithMetrics);
      const structureEntries = await Promise.all(coursesWithMetrics.map(async (course) => {
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
      toast.success(editingCourse ? 'Đã cập nhật khóa học' : 'Đã tạo khóa học');
    } catch (error) {
      const message = error.response?.data?.message || 'Không thể lưu khóa học';
      setSubmitError(message);
    } finally {
      setSaving(false);
    }
  };

  const deleteCourse = async (course) => {
    if (!window.confirm(`Xóa khóa học “${course.title}” cùng toàn bộ học phần và bài học?`)) return;
    try {
      await api.delete(`/courses/${course.courseId}`);
      setCourses((current) => current.filter((item) => item.courseId !== course.courseId));
      toast.success('Đã xóa khóa học');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const isManager = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  if (!isManager) {
    return (
      <main className="cm-page">
        <section className="cm-empty-state"><h1>Quản lý khóa học dành cho giảng viên</h1><p>Tài khoản của bạn không có quyền quản lý khóa học.</p><Link to="/dashboard" className="cm-button cm-button-primary">Về tổng quan</Link></section>
      </main>
    );
  }

  return (
    <main className="cm-page">
      <div className="cm-container">
        <div className="cm-breadcrumb"><Link to="/dashboard">Tổng quan</Link><span>/</span><strong>Khóa học</strong></div>
        <section className="cm-page-heading">
          <div>
            <p className="cm-eyebrow">KHÔNG GIAN GIẢNG DẠY</p>
            <h1>Quản lý khóa học</h1>
            <p>Tạo khóa học, sắp xếp học phần và quản lý bài học.</p>
          </div>
          <button className="cm-button cm-button-primary" onClick={openCreate}>＋ Tạo khóa học</button>
        </section>

        <section className="cm-toolbar cm-course-filters" aria-label="Bộ lọc khóa học">
          <label className="cm-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo mã, tên hoặc mô tả khóa học" /></label>
          <select aria-label="Lọc theo trạng thái" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ALL">Tất cả trạng thái</option><option value="DRAFT">Bản nháp</option><option value="PUBLISHED">Đã xuất bản</option><option value="ARCHIVED">Đã lưu trữ</option>
          </select>
          <select aria-label="Lọc theo môn học" value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
            <option value="ALL">Tất cả môn học</option>{subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
          </select>
          {(search || statusFilter !== 'ALL' || subjectFilter !== 'ALL') && <button className="cm-button cm-button-quiet" onClick={() => { setSearch(''); setStatusFilter('ALL'); setSubjectFilter('ALL'); }}>Đặt lại</button>}
        </section>

        {loadError && <div className="cm-alert" role="alert"><span>{loadError}</span><button onClick={loadCourses}>Thử lại</button></div>}
        <section className="cm-panel">
          <div className="cm-panel-heading"><div><h2>Khóa học của bạn</h2><p>{loading ? 'Đang tải…' : `Hiển thị ${visibleCourses.length ? (currentPage - 1) * pageSize + 1 : 0}–${Math.min(currentPage * pageSize, visibleCourses.length)} / ${visibleCourses.length} khóa học`}</p></div><label className="cm-page-size">Số dòng mỗi trang<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option></select></label></div>
          {loading ? <div className="cm-loading">Đang tải khóa học…</div> : visibleCourses.length === 0 ? (
            <div className="cm-empty-state"><div className="cm-empty-icon">▤</div><h3>{courses.length ? 'Không tìm thấy khóa học' : 'Bắt đầu với khóa học đầu tiên'}</h3><p>{courses.length ? 'Thử từ khóa hoặc bộ lọc khác.' : 'Thêm thông tin khóa học, sau đó tạo học phần và bài học.'}</p>{!courses.length && <button className="cm-button cm-button-primary" onClick={openCreate}>Tạo khóa học</button>}</div>
          ) : (
            <div className="teacher-managed-course-grid">
              {pageCourses.map((course) => (
                <article className="teacher-managed-course" key={course.courseId}>
                  <div className="teacher-managed-course-art">
                    <span className="cm-code-value">{course.courseCode}</span>
                    <span className={`cm-status cm-status-${course.status.toLowerCase()}`}>{courseStatusLabel[course.status] || course.status}</span>
                    <span className="teacher-managed-subject">{course.subject || 'Khóa học'}</span>
                    <FiBookOpen className="teacher-managed-course-icon" aria-hidden="true" />
                  </div>
                  <div className="teacher-managed-course-body">
                    <h3><Link to={`/courses/${course.courseId}`}>{course.title}</Link></h3>
                    <p>{course.description || 'Thêm mô tả để giới thiệu khóa học.'}</p>
                    <div className="teacher-managed-course-meta"><span><FiLayers aria-hidden="true" /><strong>{structures[course.courseId]?.modules ?? '—'}</strong> học phần</span><span><FiUsers aria-hidden="true" /><strong>{course.studentCount ?? '—'}</strong> sinh viên</span><span className="teacher-managed-lesson-count">{structures[course.courseId]?.lessons ?? '—'} bài học</span></div>
                    <div className="teacher-managed-course-footer"><strong>{formatCoursePrice(course.price)}</strong><div className="teacher-managed-course-actions"><button type="button" className="teacher-managed-icon-action" aria-label={`Sửa khóa học ${course.title}`} title="Sửa khóa học" onClick={() => openEdit(course)}><FiEdit2 /></button><button type="button" className="teacher-managed-icon-action is-danger" aria-label={`Xóa khóa học ${course.title}`} title="Xóa khóa học" onClick={() => deleteCourse(course)}><FiTrash2 /></button><button type="button" className="teacher-managed-enter" onClick={() => navigate(`/courses/${course.courseId}`)}>Vào lớp <FiArrowRight aria-hidden="true" /></button></div></div>
                  </div>
                </article>
              ))}
            </div>
          )}
          {!loading && visibleCourses.length > 0 && <nav className="cm-pagination" aria-label="Các trang khóa học">
            <span>Trang {currentPage} / {totalPages}</span>
            <div className="cm-pagination-controls">
              <button className="cm-button cm-button-small" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} aria-label="Trang đầu">«</button>
              <button className="cm-button cm-button-small" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>Trước</button>
              {pageNumbers.map((page) => typeof page === 'string' ? <span className="cm-page-gap" key={page}>…</span> : <button key={page} className={`cm-button cm-button-small cm-page-number${currentPage === page ? ' active' : ''}`} onClick={() => setCurrentPage(page)} aria-current={currentPage === page ? 'page' : undefined}>{page}</button>)}
              <button className="cm-button cm-button-small" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}>Tiếp</button>
              <button className="cm-button cm-button-small" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} aria-label="Trang cuối">»</button>
            </div>
          </nav>}
        </section>
      </div>

      {showForm && <CourseForm initialCourse={editingCourse} onClose={() => setShowForm(false)} onSubmit={saveCourse} saving={saving} submitError={submitError} />}
    </main>
  );
}

export default CourseManagementPage;
