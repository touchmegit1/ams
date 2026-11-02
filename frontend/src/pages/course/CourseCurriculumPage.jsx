import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api.js';
import CourseForm from '../../components/course/CourseForm.jsx';
import LessonAssignments from '../../components/course/LessonAssignments.jsx';
import { courseStatusLabel, formatCoursePrice } from './courseUi.js';
import '../../assets/styles/course-management.css';

const errorMessage = (error) => error.response?.data?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.';

function CurriculumModal({ title, initial, kind, courseId, onClose, onSubmit, saving, submitError }) {
  const isLesson = kind === 'lesson';
  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = isLesson
      ? { title: form.get('title').trim(), orderIndex: initial?.orderIndex || null }
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
            {isLesson && <LessonAssignments courseId={courseId} lesson={initial} />}
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
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [courseFormOpen, setCourseFormOpen] = useState(false);
  const [curriculumForm, setCurriculumForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

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
      let createdLesson = null;
      if (curriculumForm.kind === 'module') {
        const module = curriculumForm.module;
        if (module) await api.put(`/courses/${courseId}/modules/${module.moduleId}`, payload);
        else await api.post(`/courses/${courseId}/modules`, payload);
      } else {
        const { module, lesson } = curriculumForm;
        if (lesson) await api.put(`/courses/${courseId}/modules/${module.moduleId}/lessons/${lesson.lessonId}`, payload);
        else ({ data: createdLesson } = await api.post(`/courses/${courseId}/modules/${module.moduleId}/lessons`, payload));
      }
      setCurriculumForm(null);
      await load();
      if (createdLesson) setCurriculumForm({ kind: 'lesson', module: curriculumForm.module, lesson: createdLesson });
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
        <div className="cm-breadcrumb"><Link to="/courses">Khóa học</Link><span>/</span><strong>{course.courseCode}</strong><span>/</span><strong>Học phần và bài học</strong></div>
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
          <div className="cm-stat"><span>Học phí</span><strong>{formatCoursePrice(course.price)}</strong></div>
          <div className="cm-stat"><span>Trạng thái khóa học</span><strong>{courseStatusLabel[course.status] || course.status}</strong></div>
        </section>

        <div className="cm-curriculum-layout">
        <section className="cm-panel cm-curriculum-panel">
          <div className="cm-panel-heading"><div><h2>Chương trình học</h2><p>Sắp xếp học phần, bài học và bài trắc nghiệm gắn với từng bài.</p></div><button className="cm-button cm-button-primary" onClick={() => { setSubmitError(''); setCurriculumForm({ kind: 'module', module: null }); }}>＋ Thêm học phần</button></div>
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
                        <div className="cm-lesson-main"><strong>{lesson.title}</strong></div>
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
        </div>
      </div>

      {courseFormOpen && <CourseForm initialCourse={course} onClose={() => setCourseFormOpen(false)} onSubmit={submitCourse} saving={saving} submitError={submitError} />}
      {curriculumForm && <CurriculumModal courseId={courseId} kind={curriculumForm.kind} initial={curriculumForm.module && curriculumForm.kind === 'module' ? curriculumForm.module : curriculumForm.lesson} title={`${curriculumForm.module || curriculumForm.lesson ? 'Sửa' : 'Thêm'} ${curriculumForm.kind === 'module' ? 'học phần' : 'bài học'}`} onClose={() => setCurriculumForm(null)} onSubmit={submitCurriculum} saving={saving} submitError={submitError} />}
    </main>
  );
}

export default CourseCurriculumPage;
