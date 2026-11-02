import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api.js';
import CourseForm from '../../components/course/CourseForm.jsx';
import { courseStatusLabel, formatCoursePrice } from './courseUi.js';
import '../../assets/styles/course-management.css';

const errorMessage = (error) => error.response?.data?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.';

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
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [workspaceStats, setWorkspaceStats] = useState(null);
  const [students, setStudents] = useState([]);
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [courseAssignments, setCourseAssignments] = useState([]);
  const [workspaceError, setWorkspaceError] = useState('');

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
    Promise.all(requests).then(([all, extra]) => {
      if (!active) return;
      setWorkspaceStats((Array.isArray(all.data) ? all.data : []).find((item) => String(item.courseId) === String(courseId)) || null);
      if (activeTab === 'students') setStudents(Array.isArray(extra.data) ? extra.data : []);
      if (activeTab === 'payments') setPaymentSummary(extra.data);
      if (activeTab === 'assignments') setCourseAssignments(extra.data?.content || []);
    }).catch((error) => { if (active) setWorkspaceError(errorMessage(error)); });
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

  if (loading) return <main className="cm-page"><div className="cm-loading cm-page-loading">Đang tải khóa học…</div></main>;
  if (loadError || !course) return <main className="cm-page"><div className="cm-container"><div className="cm-alert" role="alert"><span>{loadError || 'Không tìm thấy khóa học'}</span><button onClick={() => navigate('/courses')}>Về danh sách khóa học</button></div></div></main>;

  return (
    <main className="cm-page">
      <div className="cm-container">
        <div className="cm-breadcrumb"><Link to="/dashboard">Khóa học</Link><span>/</span><strong>{course.courseCode}</strong><span>/</span><strong>Lớp học</strong></div>
        <section className="cm-course-hero">
          <div>
            <p className="cm-eyebrow">{course.courseCode} · {course.subject}</p>
            <div className="cm-hero-title"><h1>{course.title}</h1><span className={`cm-status cm-status-${course.status.toLowerCase()}`}>{courseStatusLabel[course.status] || course.status}</span></div>
            <p>{course.description || 'Thêm mô tả để sinh viên biết nội dung khóa học.'}</p>
            {course.targetAudience && <p className="cm-audience">Dành cho {course.targetAudience}</p>}
          </div>
        </section>

        <section className="cm-stats-row">
          <div className="cm-stat"><span>Học phần</span><strong>{modules.length}</strong></div>
          <div className="cm-stat"><span>Bài học</span><strong>{totalLessons}</strong></div>
          <div className="cm-stat"><span>Sinh viên</span><strong>{workspaceStats?.studentCount ?? '—'}</strong></div>
          <div className="cm-stat"><span>Bài cần chấm</span><strong>{workspaceStats?.pendingReviewCount ?? '—'}</strong></div>
          <div className="cm-stat"><span>Học phí</span><strong>{formatCoursePrice(course.price)}</strong></div>
        </section>

        <nav className="course-class-tabs" aria-label="Quản lý lớp học">
          {[['overview', 'Tổng quan'], ['content', 'Học phần'], ['assignments', 'Bài tập'], ['students', 'Sinh viên'], ['payments', 'Thanh toán']].map(([id, label]) =>
            <button key={id} className={activeTab === id ? 'is-active' : ''} onClick={() => setSearchParams({ tab: id })} aria-current={activeTab === id ? 'page' : undefined}>{label}</button>)}
        </nav>
        {workspaceError && <div className="course-workspace-alert" role="alert">{workspaceError}</div>}

        {activeTab === 'overview' && <section className="course-overview-panel">
          <div><p className="cm-eyebrow">LỚP HỌC</p><h2>{course.title}</h2><p>{course.description || 'Quản lý chương trình học, bài tập, sinh viên và học phí của lớp này.'}</p></div>
          <div className="course-overview-actions">
            <button className="cm-button cm-button-primary" onClick={() => setSearchParams({ tab: 'content' })}>Quản lý học phần</button>
            <button className="cm-button" onClick={() => setSearchParams({ tab: 'assignments' })}>Mở bài tập</button>
            <button className="cm-button" onClick={() => { setSubmitError(''); setCourseFormOpen(true); }}>Sửa thông tin khóa</button>
          </div>
        </section>}

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
                    <div className="cm-module-number">{String(moduleIndex + 1).padStart(2, '0')}</div>
                    <div className="cm-module-title"><h3>{module.title}</h3><span>{module.lessons.length} bài học</span></div>
                    <div className="cm-row-actions">
                      <button className="cm-icon-button" aria-label="Đưa học phần lên" disabled={moduleIndex === 0} onClick={() => moveModule(moduleIndex, -1)}>↑</button>
                      <button className="cm-icon-button" aria-label="Đưa học phần xuống" disabled={moduleIndex === modules.length - 1} onClick={() => moveModule(moduleIndex, 1)}>↓</button>
                      <button className="cm-button cm-button-small cm-button-quiet" onClick={() => { setSubmitError(''); setCurriculumForm({ kind: 'module', module }); }}>Sửa</button>
                      <button className="cm-button cm-button-small cm-button-danger" onClick={() => removeModule(module)}>Xóa</button>
                    </div>
                  </header>
                  <div className="cm-lesson-list">
                    {module.lessons.map((lesson, lessonIndex) => (
                      <div className="cm-lesson-row" key={lesson.lessonId}>
                        <div className="cm-lesson-number">{moduleIndex + 1}.{lessonIndex + 1}</div>
                        <div className="cm-lesson-main"><strong>{lesson.title}</strong>{lesson.content && <p>{lesson.content}</p>}{lesson.videoUrl && <a href={lesson.videoUrl} target="_blank" rel="noreferrer">Mở video bài học ↗</a>}</div>
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
          <div className="course-workspace-panel-heading"><div><h2>Bài tập của lớp</h2><p>Tạo bài tập cho sinh viên đang học khóa này.</p></div><Link className="cm-button cm-button-primary" to={`/teacher/assignments/new?subjectId=${courseId}`}>＋ Tạo bài tập</Link></div>
          {!courseAssignments.length ? <div className="cm-empty-state"><h3>Chưa có bài tập</h3><p>Tạo bài tập đầu tiên cho lớp.</p></div> : <div className="course-workspace-table-wrap"><table className="cm-table"><thead><tr><th>Bài tập</th><th>Hạn nộp</th><th>Trạng thái</th><th></th></tr></thead><tbody>{courseAssignments.map((item) => <tr key={item.id}><td><strong>{item.title}</strong></td><td>{item.dueDate ? new Date(item.dueDate).toLocaleString('vi-VN') : '—'}</td><td>{({ DRAFT: 'Bản nháp', PUBLISHED: 'Đang mở', CLOSED: 'Đã đóng', ARCHIVED: 'Đã lưu trữ' })[item.status] || item.status}</td><td><Link to={`/teacher/assignments/${item.id}`}>Xem và chấm</Link></td></tr>)}</tbody></table></div>}
        </section>}

        {activeTab === 'students' && <section className="course-workspace-panel"><div className="course-workspace-panel-heading"><div><h2>Sinh viên trong lớp</h2><p>Trạng thái ghi danh và quyền học theo thanh toán.</p></div><span>{students.length} sinh viên</span></div>{!students.length ? <p className="course-workspace-empty">Chưa có sinh viên ghi danh.</p> : <div className="course-workspace-table-wrap"><table className="cm-table"><thead><tr><th>Sinh viên</th><th>Email</th><th>Ghi danh</th><th>Thanh toán</th><th>Đã trả</th></tr></thead><tbody>{students.map((item) => <tr key={item.studentId}><td><strong>{item.fullName}</strong></td><td>{item.email}</td><td>{item.enrollmentStatus === 'ACTIVE' ? 'Đang học' : item.enrollmentStatus === 'PENDING' ? 'Chờ kích hoạt' : 'Hết hạn'}</td><td>{item.paymentStatus === 'PAID' ? 'Đã thanh toán' : item.paymentStatus === 'FREE' ? 'Miễn phí' : item.paymentStatus === 'PENDING' ? 'Chờ thanh toán' : 'Hết hạn'}</td><td>{formatCoursePrice(item.paidAmount)}</td></tr>)}</tbody></table></div>}</section>}

        {activeTab === 'payments' && paymentSummary && <section className="course-workspace-panel"><div className="course-workspace-panel-heading"><div><h2>Thanh toán khóa học</h2><p>Tổng hợp từ các khoản SePay đã xác nhận.</p></div></div><div className="course-payment-totals"><div><span>Đã thu</span><strong>{formatCoursePrice(paymentSummary.paidAmount)}</strong><small>{paymentSummary.paidCount} lượt thanh toán thành công</small></div><div><span>Đang chờ</span><strong>{formatCoursePrice(paymentSummary.pendingAmount)}</strong><small>{paymentSummary.pendingCount} lượt chờ xác nhận</small></div></div><div className="course-workspace-table-wrap"><table className="cm-table"><thead><tr><th>Sinh viên</th><th>Trạng thái</th><th>Số tiền đã trả</th><th>Ngày thanh toán</th></tr></thead><tbody>{paymentSummary.payments?.map((item) => <tr key={item.studentId}><td><strong>{item.studentName}</strong></td><td>{item.status === 'PAID' ? 'Đã thanh toán' : item.status === 'FREE' ? 'Miễn phí' : item.status === 'PENDING' ? 'Chờ thanh toán' : 'Hết hạn'}</td><td>{formatCoursePrice(item.amount)}</td><td>{item.paidAt ? new Date(item.paidAt).toLocaleString('vi-VN') : '—'}</td></tr>)}</tbody></table></div></section>}
      </div>

      {courseFormOpen && <CourseForm initialCourse={course} onClose={() => setCourseFormOpen(false)} onSubmit={submitCourse} saving={saving} submitError={submitError} />}
      {curriculumForm && <CurriculumModal kind={curriculumForm.kind} initial={curriculumForm.module && curriculumForm.kind === 'module' ? curriculumForm.module : curriculumForm.lesson} title={`${curriculumForm.module || curriculumForm.lesson ? 'Sửa' : 'Thêm'} ${curriculumForm.kind === 'module' ? 'học phần' : 'bài học'}`} onClose={() => setCurriculumForm(null)} onSubmit={submitCurriculum} saving={saving} submitError={submitError} />}
    </main>
  );
}

export default CourseCurriculumPage;
