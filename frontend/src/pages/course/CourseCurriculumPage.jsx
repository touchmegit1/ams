import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiArrowLeft, FiArrowRight, FiBookOpen, FiClipboard, FiDownload, FiFileText, FiSearch, FiUsers, FiVideo } from 'react-icons/fi';
import api from '../../services/api.js';
import CourseForm from '../../components/course/CourseForm.jsx';
import { courseStatusLabel, formatCoursePrice } from './courseUi.js';
import '../../assets/styles/course-management.css';

const errorMessage = (error) => error.response?.data?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.';
const paymentStatusLabel = { PAID: 'Đã thanh toán', PENDING: 'Đang chờ', FREE: 'Miễn phí', EXPIRED: 'Hết hạn', NOT_COLLECTED: 'Chưa thu (chưa triển khai)' };
const paymentDate = (value) => value ? new Date(value).toLocaleString('vi-VN') : '—';

export const getAssignmentReviewStatus = (item) => {
  if (item.status === 'DRAFT') {
    return { key: 'DRAFT', label: 'Bản nháp', className: 'status-draft' };
  }
  if (item.status === 'CLOSED') {
    return { key: 'CLOSED', label: 'Đã đóng', className: 'status-closed' };
  }
  if (item.status === 'ARCHIVED') {
    return { key: 'ARCHIVED', label: 'Lưu trữ', className: 'status-archived' };
  }
  const pending = Number(item.pendingReviewCount) || 0;
  const reviewed = Number(item.reviewedCount) || 0;
  const totalSubs = Number(item.submissionCount) || 0;

  if (pending > 0) {
    return { key: 'PENDING_REVIEW', label: `Chờ chấm (${pending})`, className: 'status-pending-review' };
  }
  if (totalSubs > 0 && pending === 0) {
    return { key: 'REVIEWED', label: `Đã chấm (${reviewed}/${totalSubs})`, className: 'status-reviewed' };
  }
  return { key: 'RECEIVING', label: 'Đang nhận bài', className: 'status-published' };
};

function exportPayments(rows, courseCode) {
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const contents = [
    ['Sinh viên', 'Trạng thái', 'Số tiền', 'Ngày thanh toán'],
    ...rows.map((row) => [row.studentName, paymentStatusLabel[row.status] || row.status, row.status === 'PAID' ? row.amount : row.status === 'FREE' ? 'Miễn phí' : row.status === 'NOT_COLLECTED' ? 'Chưa thu' : '', paymentDate(row.paidAt)]),
  ].map((row) => row.map(quote).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`\ufeff${contents}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `thanh-toan-${courseCode || 'khoa-hoc'}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CurriculumModal({ title, initial, kind, onClose, onSubmit, saving, submitError }) {
  const isLesson = kind === 'lesson';
  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = isLesson
      ? { title: form.get('title').trim(), content: form.get('content').trim(), videoUrl: form.get('videoUrl').trim() || null, orderIndex: initial?.orderIndex || null }
      : { title: form.get('title').trim(), orderIndex: initial?.orderIndex || null };
    await onSubmit(payload);
  };

  return (
    <div className="cm-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="cm-modal" role="dialog" aria-modal="true" aria-labelledby="curriculum-form-title">
        <header className="cm-modal-header"><div><p className="cm-eyebrow">CHƯƠNG TRÌNH HỌC</p><h2 id="curriculum-form-title">{title}</h2></div><button className="cm-icon-button" type="button" onClick={onClose} aria-label="Đóng">×</button></header>
        <form onSubmit={handleSubmit}>
          <div className="cm-modal-body">
            <label className="cm-field"><span>{isLesson ? 'Tên bài học' : 'Tên học phần'} <b>*</b></span><input name="title" required maxLength="200" defaultValue={initial?.title || ''} autoFocus placeholder={isLesson ? 'Nhập tên bài học' : 'Nhập tên học phần'} /></label>
            {isLesson && <>
              <label className="cm-field"><span>Nội dung bài học</span><textarea name="content" maxLength="100000" rows="8" defaultValue={initial?.content || ''} placeholder="Viết nội dung hoặc hướng dẫn cho bài học." /></label>
              <label className="cm-field"><span>Liên kết video</span><input name="videoUrl" type="url" maxLength="500" defaultValue={initial?.videoUrl || ''} placeholder="https://…" /></label>
            </>}
            {submitError && <p className="cm-form-error" role="alert">{submitError}</p>}
          </div>
          <footer className="cm-modal-footer"><button className="cm-button cm-button-quiet" type="button" onClick={onClose} disabled={saving}>Hủy</button><button className="cm-button cm-button-primary" type="submit" disabled={saving}>{saving ? 'Đang lưu…' : initial ? 'Lưu thay đổi' : `Thêm ${isLesson ? 'bài học' : 'học phần'}`}</button></footer>
        </form>
      </section>
    </div>
  );
}

function CourseCurriculumPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = ['overview', 'content', 'assignments', 'students', 'payments'].includes(searchParams.get('tab')) ? searchParams.get('tab') : 'overview';
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [courseFormOpen, setCourseFormOpen] = useState(false);
  const [curriculumForm, setCurriculumForm] = useState(null);
  const [viewingLesson, setViewingLesson] = useState(null);
  const [collapsedModules, setCollapsedModules] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [workspaceStats, setWorkspaceStats] = useState(null);
  const [students, setStudents] = useState([]);
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [courseAssignments, setCourseAssignments] = useState([]);
  const [workspaceError, setWorkspaceError] = useState('');
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('ALL');
  const [paymentPage, setPaymentPage] = useState(0);
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState('ALL');
  const [assignmentDateFilter, setAssignmentDateFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [courseResponse, moduleResponse] = await Promise.all([
        api.get(`/courses/${courseId}`),
        api.get(`/courses/${courseId}/modules`),
      ]);
      setCourse(courseResponse.data);
      setModules(moduleResponse.data);
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let active = true;
    const requests = [api.get('/teacher/courses')];
    if (activeTab === 'students') requests.push(api.get(`/teacher/courses/${courseId}/students`));
    if (activeTab === 'payments') requests.push(api.get(`/teacher/courses/${courseId}/payments`));
    if (activeTab === 'assignments') requests.push(api.get('/assignments', { params: { subjectId: courseId, page: 0, size: 100 } }));
    setWorkspaceError('');
    setWorkspaceLoading(true);
    Promise.all(requests).then(([all, extra]) => {
      if (!active) return;
      setWorkspaceStats((Array.isArray(all.data) ? all.data : []).find((item) => String(item.courseId) === String(courseId)) || null);
      if (activeTab === 'students') setStudents(Array.isArray(extra.data) ? extra.data : []);
      if (activeTab === 'payments') setPaymentSummary(extra.data);
      if (activeTab === 'assignments') setCourseAssignments(extra.data?.content || []);
    }).catch((error) => { if (active) setWorkspaceError(errorMessage(error)); })
      .finally(() => { if (active) setWorkspaceLoading(false); });
    return () => { active = false; };
  }, [activeTab, courseId]);

  const submitCourse = async (payload) => {
    setSaving(true);
    setSubmitError('');
    try {
      await api.put(`/courses/${courseId}`, payload);
      setCourseFormOpen(false);
      await load();
      toast.success('Đã cập nhật khóa học');
    } catch (error) {
      setSubmitError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const submitCurriculum = async (payload) => {
    setSaving(true);
    setSubmitError('');
    try {
      if (curriculumForm.kind === 'module') {
        const module = curriculumForm.module;
        if (module) await api.put(`/courses/${courseId}/modules/${module.moduleId}`, payload);
        else await api.post(`/courses/${courseId}/modules`, payload);
      } else {
        const { module, lesson } = curriculumForm;
        if (lesson) await api.put(`/courses/${courseId}/modules/${module.moduleId}/lessons/${lesson.lessonId}`, payload);
        else await api.post(`/courses/${courseId}/modules/${module.moduleId}/lessons`, payload);
      }
      setCurriculumForm(null);
      await load();
      toast.success('Đã lưu chương trình học');
    } catch (error) {
      setSubmitError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const removeModule = async (module) => {
    if (!window.confirm(`Xóa học phần “${module.title}” cùng toàn bộ bài học?`)) return;
    try {
      await api.delete(`/courses/${courseId}/modules/${module.moduleId}`);
      await load();
      toast.success('Đã xóa học phần');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const removeLesson = async (module, lesson) => {
    if (!window.confirm(`Xóa bài học “${lesson.title}”?`)) return;
    try {
      await api.delete(`/courses/${courseId}/modules/${module.moduleId}/lessons/${lesson.lessonId}`);
      await load();
      toast.success('Đã xóa bài học');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const moveModule = async (index, offset) => {
    const next = [...modules];
    const target = index + offset;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    try {
      await api.put(`/courses/${courseId}/modules/order`, { ids: next.map((module) => module.moduleId) });
      await load();
    } catch (error) { toast.error(errorMessage(error)); }
  };

  const moveLesson = async (module, index, offset) => {
    const next = [...module.lessons];
    const target = index + offset;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    try {
      await api.put(`/courses/${courseId}/modules/${module.moduleId}/lessons/order`, { ids: next.map((lesson) => lesson.lessonId) });
      await load();
    } catch (error) { toast.error(errorMessage(error)); }
  };

  const totalLessons = modules.reduce((total, module) => total + module.lessons.length, 0);
  const visibleStudents = useMemo(() => {
    const query = studentSearch.trim().toLocaleLowerCase('vi');
    return students.filter((student) => !query || [student.fullName, student.email].some((value) => value?.toLocaleLowerCase('vi').includes(query)));
  }, [students, studentSearch]);
  const visiblePayments = useMemo(() => (paymentSummary?.payments || []).filter((payment) => {
    const query = paymentSearch.trim().toLocaleLowerCase('vi');
    return (paymentStatusFilter === 'ALL' || payment.status === paymentStatusFilter)
      && (!query || payment.studentName?.toLocaleLowerCase('vi').includes(query));
  }), [paymentSummary, paymentSearch, paymentStatusFilter]);
  const visibleCourseAssignments = useMemo(() => {
    const query = assignmentSearch.trim().toLocaleLowerCase('vi');
    return courseAssignments.filter((item) => {
      const matchQuery = !query || [item.title, item.description].some((value) => value?.toLocaleLowerCase('vi').includes(query));
      const st = getAssignmentReviewStatus(item);
      let matchStatus = true;
      if (assignmentStatusFilter !== 'ALL') {
        if (assignmentStatusFilter === 'PENDING_REVIEW') {
          matchStatus = st.key === 'PENDING_REVIEW';
        } else if (assignmentStatusFilter === 'REVIEWED') {
          matchStatus = st.key === 'REVIEWED';
        } else if (assignmentStatusFilter === 'RECEIVING') {
          matchStatus = st.key === 'RECEIVING';
        } else {
          matchStatus = item.status === assignmentStatusFilter;
        }
      }
      const matchDate = !assignmentDateFilter || (item.dueDate ? String(item.dueDate).slice(0, 10) === assignmentDateFilter : false);
      return matchQuery && matchStatus && matchDate;
    });
  }, [courseAssignments, assignmentSearch, assignmentStatusFilter, assignmentDateFilter]);
  const paginatedPayments = visiblePayments.slice(paymentPage * 10, paymentPage * 10 + 10);
  const totalPaymentPages = Math.max(1, Math.ceil(visiblePayments.length / 10));
  useEffect(() => { setPaymentPage(0); }, [paymentSearch, paymentStatusFilter]);

  if (loading) return <main className="cm-page"><div className="cm-loading cm-page-loading">Đang tải khóa học…</div></main>;
  if (loadError || !course) return <main className="cm-page"><div className="cm-container"><div className="cm-alert" role="alert"><span>{loadError || 'Không tìm thấy khóa học'}</span><button onClick={() => navigate('/courses')}>Về danh sách khóa học</button></div></div></main>;

  return (
    <main className="cm-page">
      <div className="cm-container">
        <div className="cm-breadcrumb"><Link to="/courses">Quản lý khóa học</Link><span>/</span><strong>{course.courseCode}</strong><span>/</span><strong>Lớp học</strong></div>
        <section className="cm-course-hero">
          <div className="cm-course-hero-copy">
            <p className="cm-eyebrow">{course.courseCode} <span>·</span> {course.subject}</p>
            <div className="cm-hero-title"><h1>{course.title}</h1><span className={`cm-status cm-status-${course.status.toLowerCase()}`}>{courseStatusLabel[course.status] || course.status}</span></div>
            <p>{course.description || 'Thêm mô tả để sinh viên biết nội dung khóa học.'}</p>
            {course.targetAudience && <p className="cm-audience"><FiUsers aria-hidden="true" /> Dành cho {course.targetAudience}</p>}
          </div>
          <div className="cm-course-hero-actions"><Link className="cm-button cm-button-quiet cm-course-back" to="/courses"><FiArrowLeft aria-hidden="true" /> Quay lại quản lý khóa học</Link><button className="cm-button cm-button-quiet cm-course-edit" onClick={() => { setSubmitError(''); setCourseFormOpen(true); }}>Sửa thông tin</button></div>
        </section>

        <section className="cm-stats-row" aria-label="Chỉ số khóa học">
          <div className="cm-stat"><FiBookOpen aria-hidden="true" /><span>Học phần<strong>{modules.length}</strong></span></div>
          <div className="cm-stat"><FiFileText aria-hidden="true" /><span>Bài học<strong>{totalLessons}</strong></span></div>
          <div className="cm-stat"><FiUsers aria-hidden="true" /><span>Sinh viên<strong>{workspaceStats?.studentCount ?? '—'}</strong></span></div>
          <div className="cm-stat cm-stat-attention"><FiClipboard aria-hidden="true" /><span>Bài cần chấm<strong>{workspaceStats?.pendingReviewCount ?? '—'}</strong></span></div>
          <div className="cm-stat cm-stat-price"><span>Học phí<strong>{formatCoursePrice(course.price)}</strong></span></div>
        </section>

        <nav className="course-class-tabs" aria-label="Quản lý lớp học">
          {[['overview', 'Tổng quan'], ['content', 'Học phần'], ['assignments', 'Bài tập'], ['students', 'Sinh viên'], ['payments', 'Thanh toán']].map(([id, label]) =>
            <button key={id} className={activeTab === id ? 'is-active' : ''} onClick={() => setSearchParams({ tab: id })} aria-current={activeTab === id ? 'page' : undefined}>{label}</button>)}
        </nav>
        {workspaceError && <div className="course-workspace-alert" role="alert">{workspaceError}</div>}

        {activeTab === 'overview' && <div className="course-overview-layout">
          <section className="course-overview-panel">
            <div className="course-overview-intro"><p className="cm-eyebrow">TỔNG QUAN KHÓA HỌC</p><h2>{course.title}</h2><p>{course.description || 'Quản lý chương trình học, bài tập, sinh viên và học phí trong một nơi.'}</p></div>
            <div className="course-overview-facts"><div><span>Mã khóa học</span><strong>{course.courseCode}</strong></div><div><span>Môn học</span><strong>{course.subject || '—'}</strong></div><div><span>Đối tượng</span><strong>{course.targetAudience || 'Chưa cập nhật'}</strong></div><div><span>Trạng thái</span><strong>{courseStatusLabel[course.status] || course.status}</strong></div></div>
            <div className="course-overview-actions">
              <button className="cm-button cm-button-primary" onClick={() => setSearchParams({ tab: 'content' })}>Mở chương trình học</button>
              <button className="cm-button" onClick={() => setSearchParams({ tab: 'assignments' })}>Xem bài tập</button>
              <button className="cm-button" onClick={() => setSearchParams({ tab: 'students' })}>Xem sinh viên</button>
            </div>
          </section>
          <aside className="course-overview-priority">
            <section className={workspaceStats?.pendingReviewCount > 0 ? 'is-pending' : ''}>
              <span className="course-overview-priority-icon"><FiClipboard aria-hidden="true" /></span>
              <div><p>Việc cần chú ý</p><strong>{workspaceStats?.pendingReviewCount ?? '—'} bài chờ chấm</strong><small>{workspaceStats?.pendingReviewCount > 0 ? 'Xem bài nộp và gửi nhận xét cho sinh viên.' : 'Bài nộp mới sẽ xuất hiện tại đây.'}</small></div>
              {workspaceStats?.pendingReviewCount > 0 && <button aria-label="Mở bài tập cần chấm" onClick={() => {
  if (workspaceStats?.firstPendingAssignmentId) {
    navigate(`/teacher/assignments/${workspaceStats.firstPendingAssignmentId}?subjectId=${courseId}`);
  } else {
    setSearchParams({ tab: 'assignments' });
  }
}}>→</button>}
            </section>
            <section><span className="course-overview-priority-icon"><FiUsers aria-hidden="true" /></span><div><p>Lớp học</p><strong>{workspaceStats?.studentCount ?? '—'} sinh viên</strong><small>Đang ghi danh khóa học</small></div><button aria-label="Mở danh sách sinh viên" onClick={() => setSearchParams({ tab: 'students' })}>→</button></section>
          </aside>
        </div>}

        {activeTab === 'content' && <div className="cm-curriculum-layout">
        <section className="cm-panel cm-curriculum-panel">
          <div className="cm-panel-heading"><div><h2>Chương trình học</h2><p>Sắp xếp học phần và thêm nội dung cho từng bài học.</p></div><button className="cm-button cm-button-primary" onClick={() => { setSubmitError(''); setCurriculumForm({ kind: 'module', module: null }); }}>＋ Thêm học phần</button></div>
          {modules.length === 0 ? (
            <div className="cm-empty-state"><div className="cm-empty-icon">▤</div><h3>Chưa có học phần</h3><p>Tạo học phần đầu tiên để xây dựng khóa học.</p><button className="cm-button cm-button-primary" onClick={() => { setSubmitError(''); setCurriculumForm({ kind: 'module', module: null }); }}>Thêm học phần đầu tiên</button></div>
          ) : (
            <div className="cm-module-list">
              {modules.map((module, moduleIndex) => (
                <article className="cm-module-card" key={module.moduleId}>
                  <header className="cm-module-header">
                    <button type="button" className="cm-module-toggle" aria-expanded={!collapsedModules.has(module.moduleId)} aria-controls={`module-lessons-${module.moduleId}`} onClick={() => setCollapsedModules((current) => { const next = new Set(current); if (next.has(module.moduleId)) next.delete(module.moduleId); else next.add(module.moduleId); return next; })}>
                      <span className="cm-module-number">{String(moduleIndex + 1).padStart(2, '0')}</span>
                      <span className="cm-module-title"><strong>{module.title}</strong><small>{module.lessons.length} bài học</small></span>
                      <span className="cm-module-chevron" aria-hidden="true">{collapsedModules.has(module.moduleId) ? '⌄' : '⌃'}</span>
                    </button>
                    <div className="cm-row-actions">
                      <button className="cm-icon-button" aria-label="Đưa học phần lên" disabled={moduleIndex === 0} onClick={() => moveModule(moduleIndex, -1)}>↑</button>
                      <button className="cm-icon-button" aria-label="Đưa học phần xuống" disabled={moduleIndex === modules.length - 1} onClick={() => moveModule(moduleIndex, 1)}>↓</button>
                      <button className="cm-button cm-button-small cm-button-quiet" onClick={() => { setSubmitError(''); setCurriculumForm({ kind: 'module', module }); }}>Sửa</button>
                      <button className="cm-button cm-button-small cm-button-danger" onClick={() => removeModule(module)}>Xóa</button>
                    </div>
                  </header>
                  <div className="cm-lesson-list" id={`module-lessons-${module.moduleId}`} hidden={collapsedModules.has(module.moduleId)}>
                    {module.lessons.map((lesson, lessonIndex) => (
                      <div className="cm-lesson-row" key={lesson.lessonId}>
                        <div className="cm-lesson-number">{moduleIndex + 1}.{lessonIndex + 1}</div>
                        <button type="button" className="cm-lesson-view" onClick={() => setViewingLesson({ module, lesson })} aria-label={`Xem bài học ${lesson.title}`}>
                          <span className="cm-lesson-main"><strong>{lesson.title}</strong>{lesson.content && <span className="cm-lesson-preview-text">{lesson.content}</span>}<span className="cm-lesson-meta">{lesson.videoUrl && <span><FiVideo aria-hidden="true" /> Có video</span>}{lesson.content && <span><FiFileText aria-hidden="true" /> Có nội dung</span>}<span className="cm-lesson-open-label">Bấm để xem</span></span></span>
                        </button>
                        <div className="cm-row-actions">
                          <button className="cm-icon-button" aria-label="Đưa bài học lên" disabled={lessonIndex === 0} onClick={() => moveLesson(module, lessonIndex, -1)}>↑</button>
                          <button className="cm-icon-button" aria-label="Đưa bài học xuống" disabled={lessonIndex === module.lessons.length - 1} onClick={() => moveLesson(module, lessonIndex, 1)}>↓</button>
                          <button className="cm-button cm-button-small cm-button-quiet" onClick={() => { setSubmitError(''); setCurriculumForm({ kind: 'lesson', module, lesson }); }}>Sửa</button>
                          <button className="cm-button cm-button-small cm-button-danger" onClick={() => removeLesson(module, lesson)}>Xóa</button>
                        </div>
                      </div>
                    ))}
                    <button className="cm-add-lesson" onClick={() => { setSubmitError(''); setCurriculumForm({ kind: 'lesson', module, lesson: null }); }}>＋ Thêm bài học vào {module.title}</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <aside className="cm-inspector">
          <section className="cm-inspector-card"><h2>Thông tin khóa học</h2><dl><div><dt>Mã khóa học</dt><dd>{course.courseCode}</dd></div><div><dt>Trạng thái</dt><dd><span className={`cm-status cm-status-${course.status.toLowerCase()}`}>{courseStatusLabel[course.status] || course.status}</span></dd></div><div><dt>Tổng học phần</dt><dd>{modules.length}</dd></div><div><dt>Tổng bài học</dt><dd>{totalLessons}</dd></div><div><dt>Môn học</dt><dd>{course.subject || '—'}</dd></div><div><dt>Học phí</dt><dd>{formatCoursePrice(course.price)}</dd></div></dl></section>
          <section className="cm-inspector-card"><h2>Thao tác khóa học</h2><button className="cm-inspector-action" onClick={() => { setSubmitError(''); setCourseFormOpen(true); }}>Sửa thông tin khóa học</button><Link className="cm-inspector-action" to="/courses">Về danh sách khóa học</Link></section>
        </aside>
        </div>}

        {activeTab === 'assignments' && <section className="course-workspace-panel">
          <div className="course-workspace-panel-heading"><div><p className="cm-eyebrow">ĐÁNH GIÁ</p><h2>Bài tập của lớp</h2><p>Tạo đề bài và theo dõi bài nộp của sinh viên.</p></div><Link className="cm-button cm-button-primary" to={`/teacher/assignments/new?subjectId=${courseId}`}>＋ Tạo bài tập</Link></div>
          <div className="cm-assignment-filter-toolbar">
            <label className="cm-workspace-search"><FiSearch aria-hidden="true" /><span className="sr-only">Tìm bài tập</span><input value={assignmentSearch} onChange={(e) => setAssignmentSearch(e.target.value)} placeholder="Tìm theo tên bài tập…" /></label>
            <div className="cm-assignment-filters-group">
              <label className="cm-filter-item"><span className="cm-filter-label">Trạng thái:</span><select value={assignmentStatusFilter} onChange={(e) => setAssignmentStatusFilter(e.target.value)}><option value="ALL">Tất cả trạng thái</option><option value="PENDING_REVIEW">Chưa chấm / Chờ chấm</option><option value="REVIEWED">Đã chấm</option><option value="RECEIVING">Đang nhận bài</option><option value="CLOSED">Đã đóng</option><option value="DRAFT">Bản nháp</option></select></label>
              <label className="cm-filter-item"><span className="cm-filter-label">Hạn nộp:</span><input type="date" value={assignmentDateFilter} onChange={(e) => setAssignmentDateFilter(e.target.value)} title="Lọc theo ngày hạn nộp" /></label>
              {(assignmentSearch || assignmentStatusFilter !== 'ALL' || assignmentDateFilter) && <button type="button" className="cm-button cm-button-small cm-reset-btn" onClick={() => { setAssignmentSearch(''); setAssignmentStatusFilter('ALL'); setAssignmentDateFilter(''); }}>Đặt lại bộ lọc</button>}
            </div>
          </div>
          {workspaceLoading ? <p className="course-workspace-loading" role="status">Đang tải bài tập…</p> : !courseAssignments.length ? <div className="cm-empty-state"><span className="cm-empty-icon"><FiClipboard aria-hidden="true" /></span><h3>Chưa có bài tập</h3><p>Tạo bài tập đầu tiên cho lớp này.</p><Link className="cm-button cm-button-primary" to={`/teacher/assignments/new?subjectId=${courseId}`}>Tạo bài tập</Link></div> : !visibleCourseAssignments.length ? <div className="course-workspace-empty">Không tìm thấy bài tập phù hợp với bộ lọc tìm kiếm.</div> : <div className="course-workspace-table-wrap"><table className="cm-table cm-assignment-table"><thead><tr><th>Bài tập</th><th>Hạn nộp</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{visibleCourseAssignments.map((item) => {
  const st = getAssignmentReviewStatus(item);
  const pending = Number(item.pendingReviewCount) || 0;
  return (
    <tr key={item.id}>
      <td>
        <div className="cm-assignment-name"><span><FiClipboard aria-hidden="true" /></span><strong>{item.title}</strong></div>
        <small>{item.assignmentType === 'QUIZ' ? 'Trắc nghiệm' : 'Tự luận / tài liệu'} · {item.maxScore ?? 10} điểm</small>
      </td>
      <td>{item.dueDate ? paymentDate(item.dueDate) : '—'}</td>
      <td><span className={`cm-work-status ${st.className}`}>{st.label}</span></td>
      <td><Link className="cm-table-action" to={`/teacher/assignments/${item.id}?subjectId=${courseId}`}>{item.status === 'DRAFT' ? 'Sửa bài tập' : pending > 0 ? `Chấm bài (${pending})` : 'Xem và chấm'} <FiArrowRight aria-hidden="true" /></Link></td>
    </tr>
  );
})}</tbody></table></div>}
        </section>}

        {activeTab === 'students' && <section className="course-workspace-panel">
          <div className="course-workspace-panel-heading"><div><p className="cm-eyebrow">DANH SÁCH LỚP</p><h2>Sinh viên trong lớp</h2><p>Theo dõi ghi danh và trạng thái thanh toán.</p></div><strong className="cm-panel-count">{students.length} sinh viên</strong></div>
          <label className="cm-workspace-search"><FiSearch aria-hidden="true" /><span className="sr-only">Tìm sinh viên</span><input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Tìm theo tên hoặc email sinh viên" /></label>
          {workspaceLoading ? <p className="course-workspace-loading" role="status">Đang tải danh sách sinh viên…</p> : !students.length ? <div className="cm-empty-state"><span className="cm-empty-icon"><FiUsers aria-hidden="true" /></span><h3>Chưa có sinh viên</h3><p>Sinh viên ghi danh khóa học sẽ xuất hiện tại đây.</p></div> : !visibleStudents.length ? <div className="course-workspace-empty">Không tìm thấy sinh viên phù hợp.</div> : <div className="course-workspace-table-wrap"><table className="cm-table cm-student-table"><thead><tr><th>Sinh viên</th><th>Email</th><th>Ghi danh</th><th>Thanh toán</th><th>Đã trả</th></tr></thead><tbody>{visibleStudents.map((item) => <tr key={item.studentId}><td><strong className="cm-student-name">{item.fullName}</strong></td><td>{item.email}</td><td><span className={`cm-work-status status-${item.enrollmentStatus?.toLowerCase()}`}>{item.enrollmentStatus === 'ACTIVE' ? 'Đang học' : item.enrollmentStatus === 'PENDING' ? 'Chờ kích hoạt' : 'Hết hạn'}</span></td><td><span className={`cm-work-status status-${item.paymentStatus?.toLowerCase()}`}>{paymentStatusLabel[item.paymentStatus] || item.paymentStatus}</span></td><td>{item.paymentStatus === 'PAID' ? formatCoursePrice(item.paidAmount) : item.paymentStatus === 'FREE' ? 'Miễn phí' : '—'}</td></tr>)}</tbody></table></div>}
        </section>}

        {activeTab === 'payments' && !paymentSummary && <section className="course-workspace-panel cm-payment-panel"><p className="course-workspace-loading" role="status">{workspaceLoading ? 'Đang tải thanh toán…' : 'Chưa có dữ liệu thanh toán.'}</p></section>}
        {activeTab === 'payments' && paymentSummary && <section className="course-workspace-panel cm-payment-panel">
          <div className="course-workspace-panel-heading"><div><p className="cm-eyebrow">ĐỐI SOÁT KHÓA HỌC</p><h2>Thanh toán khóa học</h2><p>Tổng hợp thanh toán theo danh sách sinh viên ghi danh.</p></div><div className="cm-payment-tools"><label className="cm-workspace-search"><FiSearch aria-hidden="true" /><span className="sr-only">Tìm thanh toán</span><input value={paymentSearch} onChange={(event) => setPaymentSearch(event.target.value)} placeholder="Tìm sinh viên" /></label><button className="cm-button" onClick={() => exportPayments(visiblePayments, course.courseCode)} disabled={!visiblePayments.length}><FiDownload aria-hidden="true" /> Tải báo cáo CSV</button></div></div>
          <div className="course-payment-totals">
            <div className="is-paid"><span>Đã thu</span><strong>{formatCoursePrice(paymentSummary.paidAmount)}</strong><small>{paymentSummary.paidCount} thanh toán thành công</small><div className="cm-payment-progress"><span style={{ width: `${paymentSummary.payments?.length ? Math.min(100, Math.round(paymentSummary.paidCount * 100 / paymentSummary.payments.length)) : 0}%` }} /></div><small>Tỉ lệ đã thanh toán: {paymentSummary.payments?.length ? Math.round(paymentSummary.paidCount * 100 / paymentSummary.payments.length) : 0}%</small></div>
            <div className="is-waiting"><span>Đang chờ</span><strong>{formatCoursePrice(paymentSummary.pendingAmount)}</strong><small>{paymentSummary.pendingCount} giao dịch đang chờ xác nhận</small></div>
          </div>
          <div className="cm-payment-filter-row"><span>{visiblePayments.length} sinh viên</span><label><span className="sr-only">Lọc trạng thái thanh toán</span><select value={paymentStatusFilter} onChange={(event) => setPaymentStatusFilter(event.target.value)}><option value="ALL">Tất cả trạng thái</option><option value="PAID">Đã thanh toán</option><option value="NOT_COLLECTED">Chưa thu</option><option value="PENDING">Đang chờ</option><option value="FREE">Miễn phí</option><option value="EXPIRED">Hết hạn</option></select></label></div>
          {!visiblePayments.length ? <div className="course-workspace-empty">Không có giao dịch phù hợp với bộ lọc.</div> : <div className="course-workspace-table-wrap"><table className="cm-table cm-payment-table"><thead><tr><th>Sinh viên</th><th>Trạng thái</th><th>Số tiền đã trả</th><th>Ngày thanh toán</th></tr></thead><tbody>{paginatedPayments.map((item) => <tr key={item.studentId}><td><strong className="cm-student-name">{item.studentName}</strong></td><td><span className={`cm-work-status status-${item.status?.toLowerCase()}`}>{paymentStatusLabel[item.status] || item.status}</span></td><td>{item.status === 'PAID' ? formatCoursePrice(item.amount) : item.status === 'FREE' ? 'Miễn phí' : item.status === 'NOT_COLLECTED' ? 'Chưa thu' : '—'}</td><td>{paymentDate(item.paidAt)}</td></tr>)}</tbody></table></div>}
          {visiblePayments.length > 0 && <div className="cm-payment-pagination"><span>Hiển thị {paymentPage * 10 + 1}–{Math.min((paymentPage + 1) * 10, visiblePayments.length)} / {visiblePayments.length}</span><div><button className="cm-button cm-button-small" disabled={paymentPage === 0} onClick={() => setPaymentPage((page) => Math.max(0, page - 1))}>Trước</button><span>{paymentPage + 1} / {totalPaymentPages}</span><button className="cm-button cm-button-small" disabled={paymentPage + 1 >= totalPaymentPages} onClick={() => setPaymentPage((page) => Math.min(totalPaymentPages - 1, page + 1))}>Tiếp</button></div></div>}
        </section>}
      </div>

      {viewingLesson && <div className="cm-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setViewingLesson(null); }}>
        <section className="cm-modal cm-lesson-preview" role="dialog" aria-modal="true" aria-labelledby="lesson-preview-title">
          <header className="cm-modal-header"><div><p className="cm-eyebrow">{viewingLesson.module.title}</p><h2 id="lesson-preview-title">{viewingLesson.lesson.title}</h2></div><button className="cm-icon-button" type="button" onClick={() => setViewingLesson(null)} aria-label="Đóng nội dung bài học">×</button></header>
          <div className="cm-lesson-preview-content">{viewingLesson.lesson.content ? <p>{viewingLesson.lesson.content}</p> : <p className="cm-lesson-preview-empty">Bài học chưa có nội dung mô tả.</p>}{viewingLesson.lesson.videoUrl && <a href={viewingLesson.lesson.videoUrl} target="_blank" rel="noreferrer"><FiVideo aria-hidden="true" /> Mở video bài học <FiArrowRight aria-hidden="true" /></a>}</div>
          <footer className="cm-modal-footer"><button className="cm-button cm-button-quiet" type="button" onClick={() => setViewingLesson(null)}>Đóng</button><button className="cm-button cm-button-primary" type="button" onClick={() => { setCurriculumForm({ kind: 'lesson', module: viewingLesson.module, lesson: viewingLesson.lesson }); setViewingLesson(null); }}>Sửa bài học</button></footer>
        </section>
      </div>}
      {courseFormOpen && <CourseForm initialCourse={course} onClose={() => setCourseFormOpen(false)} onSubmit={submitCourse} saving={saving} submitError={submitError} />}
      {curriculumForm && <CurriculumModal kind={curriculumForm.kind} initial={curriculumForm.module && curriculumForm.kind === 'module' ? curriculumForm.module : curriculumForm.lesson} title={`${curriculumForm.module || curriculumForm.lesson ? 'Sửa' : 'Thêm'} ${curriculumForm.kind === 'module' ? 'học phần' : 'bài học'}`} onClose={() => setCurriculumForm(null)} onSubmit={submitCurriculum} saving={saving} submitError={submitError} />}
    </main>
  );
}

export default CourseCurriculumPage;
