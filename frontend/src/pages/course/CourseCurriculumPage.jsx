import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api.js';
import CourseForm from '../../components/course/CourseForm.jsx';
import '../../assets/styles/course-management.css';

const errorMessage = (error) => error.response?.data?.message || 'Something went wrong. Please try again.';

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
        <header className="cm-modal-header"><div><p className="cm-eyebrow">CURRICULUM</p><h2 id="curriculum-form-title">{title}</h2></div><button className="cm-icon-button" type="button" onClick={onClose} aria-label="Close">×</button></header>
        <form onSubmit={handleSubmit}>
          <div className="cm-modal-body">
            <label className="cm-field"><span>{isLesson ? 'Lesson title' : 'Module title'} <b>*</b></span><input name="title" required maxLength="200" defaultValue={initial?.title || ''} autoFocus placeholder={isLesson ? 'Name this lesson' : 'Name this module'} /></label>
            {isLesson && <>
              <label className="cm-field"><span>Lesson content</span><textarea name="content" maxLength="100000" rows="8" defaultValue={initial?.content || ''} placeholder="Write lesson notes or instructions here." /></label>
              <label className="cm-field"><span>Video URL</span><input name="videoUrl" type="url" maxLength="500" defaultValue={initial?.videoUrl || ''} placeholder="https://…" /></label>
            </>}
            {submitError && <p className="cm-form-error" role="alert">{submitError}</p>}
          </div>
          <footer className="cm-modal-footer"><button className="cm-button cm-button-quiet" type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="cm-button cm-button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : initial ? 'Save changes' : `Add ${isLesson ? 'lesson' : 'module'}`}</button></footer>
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
      toast.success('Course updated');
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
      toast.success('Curriculum saved');
    } catch (error) {
      setSubmitError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const removeModule = async (module) => {
    if (!window.confirm(`Delete “${module.title}” and all of its lessons?`)) return;
    try {
      await api.delete(`/courses/${courseId}/modules/${module.moduleId}`);
      await load();
      toast.success('Module deleted');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const removeLesson = async (module, lesson) => {
    if (!window.confirm(`Delete lesson “${lesson.title}”?`)) return;
    try {
      await api.delete(`/courses/${courseId}/modules/${module.moduleId}/lessons/${lesson.lessonId}`);
      await load();
      toast.success('Lesson deleted');
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

  if (loading) return <main className="cm-page"><div className="cm-loading cm-page-loading">Loading course…</div></main>;
  if (loadError || !course) return <main className="cm-page"><div className="cm-container"><div className="cm-alert" role="alert"><span>{loadError || 'Course not found'}</span><button onClick={() => navigate('/courses')}>Back to courses</button></div></div></main>;

  return (
    <main className="cm-page">
      <div className="cm-container">
        <div className="cm-breadcrumb"><Link to="/courses">Courses</Link><span>/</span><strong>{course.courseCode}</strong><span>/</span><strong>Modules &amp; Lessons</strong></div>
        <section className="cm-course-hero">
          <div>
            <p className="cm-eyebrow">{course.courseCode} · {course.subject}</p>
            <div className="cm-hero-title"><h1>{course.title}</h1><span className={`cm-status cm-status-${course.status.toLowerCase()}`}>{course.status}</span></div>
            <p>{course.description || 'Add a description to explain what students will learn.'}</p>
            {course.targetAudience && <p className="cm-audience">For {course.targetAudience}</p>}
          </div>
        </section>

        <section className="cm-stats-row">
          <div className="cm-stat"><span>Modules</span><strong>{modules.length}</strong></div>
          <div className="cm-stat"><span>Lessons</span><strong>{totalLessons}</strong></div>
          <div className="cm-stat"><span>Price</span><strong>{Number(course.price) === 0 ? 'Free' : new Intl.NumberFormat('vi-VN').format(course.price) + ' VND'}</strong></div>
          <div className="cm-stat"><span>Course status</span><strong>{course.status}</strong></div>
        </section>

        <div className="cm-curriculum-layout">
        <section className="cm-panel cm-curriculum-panel">
          <div className="cm-panel-heading"><div><h2>Course curriculum</h2><p>Arrange modules and add lesson material by hand.</p></div><button className="cm-button cm-button-primary" onClick={() => { setSubmitError(''); setCurriculumForm({ kind: 'module', module: null }); }}>＋ Add module</button></div>
          {modules.length === 0 ? (
            <div className="cm-empty-state"><div className="cm-empty-icon">▤</div><h3>No modules yet</h3><p>Add the first module to start building this course.</p><button className="cm-button cm-button-primary" onClick={() => { setSubmitError(''); setCurriculumForm({ kind: 'module', module: null }); }}>Add first module</button></div>
          ) : (
            <div className="cm-module-list">
              {modules.map((module, moduleIndex) => (
                <article className="cm-module-card" key={module.moduleId}>
                  <header className="cm-module-header">
                    <div className="cm-module-number">{String(moduleIndex + 1).padStart(2, '0')}</div>
                    <div className="cm-module-title"><h3>{module.title}</h3><span>{module.lessons.length} {module.lessons.length === 1 ? 'lesson' : 'lessons'}</span></div>
                    <div className="cm-row-actions">
                      <button className="cm-icon-button" aria-label="Move module up" disabled={moduleIndex === 0} onClick={() => moveModule(moduleIndex, -1)}>↑</button>
                      <button className="cm-icon-button" aria-label="Move module down" disabled={moduleIndex === modules.length - 1} onClick={() => moveModule(moduleIndex, 1)}>↓</button>
                      <button className="cm-button cm-button-small cm-button-quiet" onClick={() => { setSubmitError(''); setCurriculumForm({ kind: 'module', module }); }}>Edit</button>
                      <button className="cm-button cm-button-small cm-button-danger" onClick={() => removeModule(module)}>Delete</button>
                    </div>
                  </header>
                  <div className="cm-lesson-list">
                    {module.lessons.map((lesson, lessonIndex) => (
                      <div className="cm-lesson-row" key={lesson.lessonId}>
                        <div className="cm-lesson-number">{moduleIndex + 1}.{lessonIndex + 1}</div>
                        <div className="cm-lesson-main"><strong>{lesson.title}</strong>{lesson.content && <p>{lesson.content}</p>}{lesson.videoUrl && <a href={lesson.videoUrl} target="_blank" rel="noreferrer">Open lesson video ↗</a>}</div>
                        <div className="cm-row-actions">
                          <button className="cm-icon-button" aria-label="Move lesson up" disabled={lessonIndex === 0} onClick={() => moveLesson(module, lessonIndex, -1)}>↑</button>
                          <button className="cm-icon-button" aria-label="Move lesson down" disabled={lessonIndex === module.lessons.length - 1} onClick={() => moveLesson(module, lessonIndex, 1)}>↓</button>
                          <button className="cm-button cm-button-small cm-button-quiet" onClick={() => { setSubmitError(''); setCurriculumForm({ kind: 'lesson', module, lesson }); }}>Edit</button>
                          <button className="cm-button cm-button-small cm-button-danger" onClick={() => removeLesson(module, lesson)}>Delete</button>
                        </div>
                      </div>
                    ))}
                    <button className="cm-add-lesson" onClick={() => { setSubmitError(''); setCurriculumForm({ kind: 'lesson', module, lesson: null }); }}>＋ Add lesson to {module.title}</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <aside className="cm-inspector">
          <section className="cm-inspector-card"><h2>Course hierarchy</h2><dl><div><dt>Course code</dt><dd>{course.courseCode}</dd></div><div><dt>Status</dt><dd><span className={`cm-status cm-status-${course.status.toLowerCase()}`}>{course.status}</span></dd></div><div><dt>Total modules</dt><dd>{modules.length}</dd></div><div><dt>Total lessons</dt><dd>{totalLessons}</dd></div><div><dt>Subject</dt><dd>{course.subject || '—'}</dd></div><div><dt>Price</dt><dd>{Number(course.price) === 0 ? 'Free' : new Intl.NumberFormat('vi-VN').format(course.price) + ' VND'}</dd></div></dl></section>
          <section className="cm-inspector-card"><h2>Course actions</h2><button className="cm-inspector-action" onClick={() => { setSubmitError(''); setCourseFormOpen(true); }}>Edit course settings</button><Link className="cm-inspector-action" to="/courses">Back to course list</Link></section>
        </aside>
        </div>
      </div>

      {courseFormOpen && <CourseForm initialCourse={course} onClose={() => setCourseFormOpen(false)} onSubmit={submitCourse} saving={saving} submitError={submitError} />}
      {curriculumForm && <CurriculumModal kind={curriculumForm.kind} initial={curriculumForm.module && curriculumForm.kind === 'module' ? curriculumForm.module : curriculumForm.lesson} title={`${curriculumForm.module || curriculumForm.lesson ? 'Edit' : 'Add'} ${curriculumForm.kind}`} onClose={() => setCurriculumForm(null)} onSubmit={submitCurriculum} saving={saving} submitError={submitError} />}
    </main>
  );
}

export default CourseCurriculumPage;
