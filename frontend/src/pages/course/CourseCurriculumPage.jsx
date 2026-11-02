import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api.js';
import CourseForm from '../../components/course/CourseForm.jsx';
import LessonAssignments from '../../components/course/LessonAssignments.jsx';
import { courseStatusLabel, formatCoursePrice } from './courseUi.js';
import { assignmentService } from '../../services/assignmentService.js';
import { StatusTag } from '../../components/assignments/AssignmentUI.jsx';
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
        <header className="cm-modal-header">
          <div><p className="cm-eyebrow">CHƯƠNG TRÌNH HỌC</p><h2 id="curriculum-form-title">{title}</h2></div>
          <button className="cm-icon-button" type="button" onClick={onClose} aria-label="Đóng">×</button>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="cm-modal-body">
            <label className="cm-field">
              <span>{isLesson ? 'Tên bài học' : 'Tên học phần'} <b>*</b></span>
              <input name="title" required maxLength="200" defaultValue={initial?.title || ''} autoFocus placeholder={isLesson ? 'Nhập tên bài học' : 'Nhập tên học phần'} />
            </label>
            {isLesson && <LessonAssignments courseId={courseId} lesson={initial} />}
            {submitError && <p className="cm-form-error" role="alert">{submitError}</p>}
          </div>
          <footer className="cm-modal-footer">
            <button className="cm-button cm-button-quiet" type="button" onClick={onClose} disabled={saving}>Hủy</button>
            <button className="cm-button cm-button-primary" type="submit" disabled={saving}>
              {saving ? 'Đang lưu…' : initial ? 'Lưu thay đổi' : `Thêm ${isLesson ? 'bài học' : 'học phần'}`}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function CourseCurriculumPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [courseFormOpen, setCourseFormOpen] = useState(false);
  const [curriculumForm, setCurriculumForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Tabs: 'curriculum' | 'students' | 'assignments'
  const activeTab = searchParams.get('tab') || 'curriculum';
  const setActiveTab = (tab) => {
    setSearchParams(tab === 'curriculum' ? {} : { tab });
  };

  // Student progress state
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentStatus, setStudentStatus] = useState('ALL');
  const [analytics, setAnalytics] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Subject assignments state
  const [courseAssignments, setCourseAssignments] = useState([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState('');

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

  const loadStudents = useCallback(async () => {
    setStudentsLoading(true);
    setStudentsError('');
    try {
      const [rosterRes, analyticsRes] = await Promise.all([
        api.get(`/courses/${courseId}/students`),
        api.get(`/courses/${courseId}/analytics`),
      ]);
      setStudents(Array.isArray(rosterRes.data) ? rosterRes.data : []);
      setAnalytics(analyticsRes.data);
    } catch (error) {
      setStudentsError(errorMessage(error));
    } finally {
      setStudentsLoading(false);
    }
  }, [courseId]);

  const loadAssignments = useCallback(async () => {
    setAssignmentsLoading(true);
    setAssignmentsError('');
    try {
      const { data } = await api.get('/assignments', { params: { subjectId: courseId, size: 100 } });
      setCourseAssignments(Array.isArray(data.content) ? data.content : []);
    } catch (error) {
      setAssignmentsError(errorMessage(error));
    } finally {
      setAssignmentsLoading(false);
    }
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (activeTab === 'students' || !analytics) {
      loadStudents();
    }
    if (activeTab === 'assignments') {
      loadAssignments();
    }
  }, [activeTab, loadStudents, loadAssignments, analytics]);

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

  const openStudentDetail = async (student) => {
    setSelectedStudent(null);
    setProfileLoading(true);
    try {
      const { data } = await api.get(`/courses/${courseId}/students/${student.studentId}`);
      setSelectedStudent(data);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setProfileLoading(false);
    }
  };

  const exportStudents = async () => {
    try {
      const params = { search: studentSearch.trim() || undefined, status: studentStatus === 'ALL' ? undefined : studentStatus };
      const { data } = await api.get(`/courses/${courseId}/students/export.csv`, { params, responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${course?.courseCode || 'course'}-students.csv`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Đã tải danh sách sinh viên CSV');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const transitionAssignment = async (assignmentId, action) => {
    try {
      await assignmentService.transition(assignmentId, action);
      await loadAssignments();
      toast.success('Đã cập nhật trạng thái bài tập');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const visibleStudents = useMemo(() => students.filter((student) => {
    const query = studentSearch.trim().toLowerCase();
    const matchesSearch = !query || `${student.fullName} ${student.email}`.toLowerCase().includes(query);
    return matchesSearch && (studentStatus === 'ALL' || student.status === studentStatus);
  }), [students, studentSearch, studentStatus]);

  const totalLessons = modules.reduce((total, module) => total + (module.lessons?.length || 0), 0);

  if (loading) return <main className="cm-page"><div className="cm-loading cm-page-loading">Đang tải khóa học…</div></main>;
  if (loadError || !course) {
    return (
      <main className="cm-page">
        <div className="cm-container">
          <div className="cm-alert" role="alert">
            <span>{loadError || 'Không tìm thấy khóa học'}</span>
            <button onClick={() => navigate('/courses')}>Về danh sách khóa học</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="cm-page">
      <div className="cm-container">
        <div className="cm-breadcrumb">
          <Link to="/courses">Khóa học</Link>
          <span>/</span>
          <strong>{course.courseCode}</strong>
          <span>/</span>
          <strong>
            {activeTab === 'students' ? 'Sinh viên & Tiến độ' : activeTab === 'assignments' ? 'Bài tập môn học' : 'Học phần và bài học'}
          </strong>
        </div>

        <section className="cm-course-hero">
          <div>
            <p className="cm-eyebrow">{course.courseCode} · {course.subject || 'Môn học'}</p>
            <div className="cm-hero-title">
              <h1>{course.title}</h1>
              <span className={`cm-status cm-status-${course.status.toLowerCase()}`}>
                {courseStatusLabel[course.status] || course.status}
              </span>
            </div>
            <p>{course.description || 'Thêm mô tả để sinh viên biết nội dung khóa học.'}</p>
            {course.targetAudience && <p className="cm-audience">Dành cho {course.targetAudience}</p>}
          </div>
        </section>

        <section className="cm-stats-row">
          <div className="cm-stat">
            <span>Học phần</span>
            <strong>{modules.length}</strong>
          </div>
          <div className="cm-stat">
            <span>Bài học</span>
            <strong>{totalLessons}</strong>
          </div>
          <div className="cm-stat">
            <span>Sinh viên đang học</span>
            <strong>{analytics?.activeStudents ?? '—'}</strong>
          </div>
          <div className="cm-stat">
            <span>Học phí</span>
            <strong>{formatCoursePrice(course.price)}</strong>
          </div>
        </section>

        {/* Tab Navigation */}
        <nav className="cm-tabs-bar" role="tablist" aria-label="Các phần quản lý khóa học">
          <button
            type="button"
            className={`cm-tab-btn ${activeTab === 'curriculum' ? 'active' : ''}`}
            onClick={() => setActiveTab('curriculum')}
            role="tab"
            aria-selected={activeTab === 'curriculum'}
          >
            Chương trình học
            <span className="cm-tab-count">{modules.length}</span>
          </button>
          <button
            type="button"
            className={`cm-tab-btn ${activeTab === 'students' ? 'active' : ''}`}
            onClick={() => setActiveTab('students')}
            role="tab"
            aria-selected={activeTab === 'students'}
          >
            Sinh viên & Tiến độ
            {analytics?.activeStudents != null && <span className="cm-tab-count">{analytics.activeStudents}</span>}
          </button>
          <button
            type="button"
            className={`cm-tab-btn ${activeTab === 'assignments' ? 'active' : ''}`}
            onClick={() => setActiveTab('assignments')}
            role="tab"
            aria-selected={activeTab === 'assignments'}
          >
            Bài tập môn học
            {courseAssignments.length > 0 && <span className="cm-tab-count">{courseAssignments.length}</span>}
          </button>
        </nav>

        <div className="cm-curriculum-layout">
          {/* TAB 1: CURRICULUM */}
          {activeTab === 'curriculum' && (
            <section className="cm-panel cm-curriculum-panel">
              <div className="cm-panel-heading">
                <div>
                  <h2>Chương trình học</h2>
                  <p>Sắp xếp học phần, bài học và bài trắc nghiệm gắn với từng bài.</p>
                </div>
                <button
                  type="button"
                  className="cm-button cm-button-primary"
                  onClick={() => { setSubmitError(''); setCurriculumForm({ kind: 'module', module: null }); }}
                >
                  ＋ Thêm học phần
                </button>
              </div>

              {modules.length === 0 ? (
                <div className="cm-empty-state">
                  <div className="cm-empty-icon">▤</div>
                  <h3>Chưa có học phần</h3>
                  <p>Tạo học phần đầu tiên để xây dựng cấu trúc khóa học.</p>
                  <button
                    type="button"
                    className="cm-button cm-button-primary"
                    onClick={() => { setSubmitError(''); setCurriculumForm({ kind: 'module', module: null }); }}
                  >
                    Thêm học phần đầu tiên
                  </button>
                </div>
              ) : (
                <div className="cm-module-list">
                  {modules.map((module, moduleIndex) => (
                    <article className="cm-module-card" key={module.moduleId}>
                      <header className="cm-module-header">
                        <div className="cm-module-number">{String(moduleIndex + 1).padStart(2, '0')}</div>
                        <div className="cm-module-title">
                          <h3>{module.title}</h3>
                          <span>{module.lessons?.length || 0} bài học</span>
                        </div>
                        <div className="cm-row-actions">
                          <button
                            type="button"
                            className="cm-icon-button"
                            aria-label="Đưa học phần lên"
                            disabled={moduleIndex === 0}
                            onClick={() => moveModule(moduleIndex, -1)}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="cm-icon-button"
                            aria-label="Đưa học phần xuống"
                            disabled={moduleIndex === modules.length - 1}
                            onClick={() => moveModule(moduleIndex, 1)}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="cm-button cm-button-small cm-button-quiet"
                            onClick={() => { setSubmitError(''); setCurriculumForm({ kind: 'module', module }); }}
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            className="cm-button cm-button-small cm-button-danger"
                            onClick={() => removeModule(module)}
                          >
                            Xóa
                          </button>
                        </div>
                      </header>
                      <div className="cm-lesson-list">
                        {(module.lessons || []).map((lesson, lessonIndex) => (
                          <div className="cm-lesson-row" key={lesson.lessonId}>
                            <div className="cm-lesson-number">{moduleIndex + 1}.{lessonIndex + 1}</div>
                            <div className="cm-lesson-main">
                              <strong>{lesson.title}</strong>
                            </div>
                            <div className="cm-row-actions">
                              <button
                                type="button"
                                className="cm-icon-button"
                                aria-label="Đưa bài học lên"
                                disabled={lessonIndex === 0}
                                onClick={() => moveLesson(module, lessonIndex, -1)}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="cm-icon-button"
                                aria-label="Đưa bài học xuống"
                                disabled={lessonIndex === (module.lessons?.length || 1) - 1}
                                onClick={() => moveLesson(module, lessonIndex, 1)}
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                className="cm-button cm-button-small cm-button-quiet"
                                onClick={() => { setSubmitError(''); setCurriculumForm({ kind: 'lesson', module, lesson }); }}
                              >
                                Sửa
                              </button>
                              <button
                                type="button"
                                className="cm-button cm-button-small cm-button-danger"
                                onClick={() => removeLesson(module, lesson)}
                              >
                                Xóa
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="cm-add-lesson"
                          onClick={() => { setSubmitError(''); setCurriculumForm({ kind: 'lesson', module, lesson: null }); }}
                        >
                          ＋ Thêm bài học vào {module.title}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* TAB 2: STUDENTS & PROGRESS */}
          {activeTab === 'students' && (
            <section className="cm-panel cm-curriculum-panel">
              <div className="cm-panel-heading">
                <div>
                  <h2>Sinh viên và Tiến độ học tập</h2>
                  <p>Theo dõi tỷ lệ hoàn thành lesson, bài tập và điểm trung bình của từng sinh viên.</p>
                </div>
                <button type="button" className="cm-button cm-button-quiet" onClick={exportStudents}>
                  Tải CSV báo cáo
                </button>
              </div>

              {/* Analytics row */}
              {analytics && (
                <div style={{ padding: '16px 20px 0' }}>
                  <div className="cm-analytics-grid">
                    <div>
                      <strong>{analytics.activeStudents}</strong>
                      <span>Đang học</span>
                    </div>
                    <div>
                      <strong>{analytics.pendingEnrollments}</strong>
                      <span>Chờ thanh toán</span>
                    </div>
                    <div>
                      <strong>{analytics.submissionsToReview}</strong>
                      <span>Bài cần duyệt</span>
                    </div>
                    <div>
                      <strong>{analytics.upcomingAssignments}</strong>
                      <span>Sắp đến hạn</span>
                    </div>
                    <div>
                      <strong>{analytics.studentsWithOverdueAssignments}</strong>
                      <span>Trễ hạn</span>
                    </div>
                    <div>
                      <strong>{analytics.averageProgressPercent}%</strong>
                      <span>Tiến độ trung bình</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Student detailed profile modal / panel */}
              {selectedStudent ? (
                <div style={{ padding: '20px' }}>
                  <div className="cm-student-profile-header">
                    <div className="cm-student-profile-info">
                      <div className="cm-student-avatar">
                        {selectedStudent.fullName?.slice(0, 2).toUpperCase() || 'SV'}
                      </div>
                      <div>
                        <h2 style={{ fontSize: '18px', color: '#1d2b25', margin: '0 0 4px' }}>
                          {selectedStudent.fullName}
                        </h2>
                        <span style={{ fontSize: '13px', color: '#68796f' }}>
                          {selectedStudent.email} · Trạng thái: <strong>{selectedStudent.status === 'ACTIVE' ? 'Đang học' : selectedStudent.status}</strong>
                        </span>
                      </div>
                    </div>
                    <button type="button" className="cm-button cm-button-quiet" onClick={() => setSelectedStudent(null)}>
                      ← Trở về danh sách
                    </button>
                  </div>

                  {selectedStudent.status === 'ACTIVE' ? (
                    <>
                      <div className="cm-student-profile-kpis">
                        <div className="cm-student-kpi">
                          <span>Tiến độ bài học</span>
                          <strong>{selectedStudent.completedLessons}/{selectedStudent.totalLessons} ({selectedStudent.lessonProgressPercent}%)</strong>
                        </div>
                        <div className="cm-student-kpi">
                          <span>Tiến độ bài tập</span>
                          <strong>{selectedStudent.completedAssignments}/{selectedStudent.requiredAssignments} ({selectedStudent.assignmentProgressPercent}%)</strong>
                        </div>
                        <div className="cm-student-kpi">
                          <span>Tiến độ chung</span>
                          <strong>{selectedStudent.overallProgressPercent}%</strong>
                        </div>
                        <div className="cm-student-kpi">
                          <span>Điểm trung bình</span>
                          <strong>{selectedStudent.averageScorePercent == null ? 'Chưa có' : `${selectedStudent.averageScorePercent}%`}</strong>
                        </div>
                        <div className={`cm-student-kpi ${selectedStudent.overdueAssignments > 0 ? 'is-warning' : ''}`}>
                          <span>Bài quá hạn</span>
                          <strong>{selectedStudent.overdueAssignments}</strong>
                        </div>
                      </div>

                      <div className="cm-profile-sections-grid">
                        <div className="cm-profile-box">
                          <h3>
                            Tiến độ từng bài học
                            <span style={{ fontSize: '12px', color: '#68796f', fontWeight: 'normal' }}>
                              {selectedStudent.completedLessons} / {selectedStudent.totalLessons}
                            </span>
                          </h3>
                          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                            {selectedStudent.lessons?.map((l) => (
                              <div className="cm-lesson-item" key={l.lessonId}>
                                <span>{l.title}</span>
                                {l.completed ? (
                                  <span className="cm-lesson-done">
                                    ✓ Đã xong ({l.completedAt ? new Date(l.completedAt).toLocaleDateString('vi-VN') : ''})
                                  </span>
                                ) : (
                                  <span className="cm-lesson-not-done">Chưa học</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="cm-profile-box">
                          <h3>
                            Bài tập và Điểm số
                            <span style={{ fontSize: '12px', color: '#68796f', fontWeight: 'normal' }}>
                              {selectedStudent.completedAssignments} / {selectedStudent.requiredAssignments}
                            </span>
                          </h3>
                          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                            {selectedStudent.assignments?.length ? (
                              selectedStudent.assignments.map((a) => (
                                <div className="cm-assignment-item" key={a.assignmentId}>
                                  <div className="cm-assignment-item-top">
                                    <span className="cm-assignment-item-title">{a.title}</span>
                                    <span className={a.status === 'OVERDUE' ? 'cm-overdue-tag' : a.status === 'SUBMITTED' ? 'cm-ok-tag' : 'cm-pending-tag'}>
                                      {a.status === 'OVERDUE' ? 'Quá hạn' : a.status === 'SUBMITTED' ? 'Đã nộp' : 'Chưa nộp'}
                                    </span>
                                  </div>
                                  <div className="cm-assignment-item-meta">
                                    <span>Hạn: {a.dueDate ? new Date(a.dueDate).toLocaleDateString('vi-VN') : 'Không hạn'}</span>
                                    <span>
                                      Điểm: <strong>{a.score == null ? 'Chưa chấm' : `${a.score} / ${a.maxScore} (${a.scorePercent}%)`}</strong>
                                    </span>
                                    {a.submissionStatus && <span>Trạng thái nộp: {a.submissionStatus}</span>}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p style={{ color: '#68796f', fontSize: '13px', margin: '14px 0' }}>Khóa học chưa có bài tập bắt buộc.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="cm-empty-state">
                      <h3>Sinh viên chưa kích hoạt học tập</h3>
                      <p>Tiến độ bài học và kết quả bài tập chỉ được ghi nhận sau khi ghi danh chuyển sang trạng thái ACTIVE.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '16px 20px 24px' }}>
                  {/* Toolbar */}
                  <div className="cm-toolbar" style={{ marginBottom: '16px' }}>
                    <label className="cm-search">
                      <span aria-hidden="true">⌕</span>
                      <input
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder="Tìm theo tên hoặc email sinh viên"
                      />
                    </label>
                    <select
                      aria-label="Lọc theo trạng thái"
                      value={studentStatus}
                      onChange={(e) => setStudentStatus(e.target.value)}
                    >
                      <option value="ALL">Mọi trạng thái</option>
                      <option value="ACTIVE">Đang học</option>
                      <option value="PENDING">Chờ thanh toán</option>
                      <option value="EXPIRED">Hết hạn</option>
                    </select>
                    {(studentSearch || studentStatus !== 'ALL') && (
                      <button
                        type="button"
                        className="cm-button cm-button-quiet"
                        onClick={() => { setStudentSearch(''); setStudentStatus('ALL'); }}
                      >
                        Đặt lại
                      </button>
                    )}
                  </div>

                  {studentsError && <div className="cm-alert" role="alert">{studentsError}</div>}
                  {profileLoading && <div className="cm-loading">Đang tải hồ sơ sinh viên…</div>}
                  {studentsLoading ? (
                    <div className="cm-loading">Đang tải danh sách sinh viên…</div>
                  ) : visibleStudents.length === 0 ? (
                    <div className="cm-empty-state">
                      <div className="cm-empty-icon">👥</div>
                      <h3>{students.length ? 'Không tìm thấy sinh viên phù hợp' : 'Chưa có sinh viên tham gia'}</h3>
                      <p>{students.length ? 'Thử tìm với từ khóa hoặc bộ lọc khác.' : 'Khi sinh viên đăng ký khóa học, danh sách và tiến độ sẽ xuất hiện tại đây.'}</p>
                    </div>
                  ) : (
                    <div className="cm-table-wrap">
                      <table className="cm-table">
                        <thead>
                          <tr>
                            <th>Sinh viên</th>
                            <th>Trạng thái</th>
                            <th>Tiến độ bài học</th>
                            <th>Tiến độ bài tập</th>
                            <th>Tiến độ chung</th>
                            <th>Điểm TB</th>
                            <th>Quá hạn</th>
                            <th><span className="sr-only">Thao tác</span></th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleStudents.map((s) => (
                            <tr key={s.studentId}>
                              <td>
                                <div>
                                  <strong>{s.fullName}</strong>
                                  <small className="cm-subline">{s.email}</small>
                                </div>
                              </td>
                              <td>
                                <span className={`cm-status ${s.status === 'ACTIVE' ? 'cm-status-published' : s.status === 'PENDING' ? 'cm-status-draft' : 'cm-status-archived'}`}>
                                  {s.status === 'ACTIVE' ? 'Đang học' : s.status === 'PENDING' ? 'Chờ thanh toán' : s.status}
                                </span>
                              </td>
                              <td>
                                {s.status === 'ACTIVE' ? (
                                  <div className="cm-progress-cell">
                                    <div className="cm-progress-text">
                                      <span>{s.completedLessons}/{s.totalLessons}</span>
                                      <strong>{s.lessonProgressPercent}%</strong>
                                    </div>
                                    <div className="cm-progress-bar">
                                      <div className="cm-progress-bar-fill" style={{ width: `${Math.min(100, s.lessonProgressPercent || 0)}%` }} />
                                    </div>
                                  </div>
                                ) : '—'}
                              </td>
                              <td>
                                {s.status === 'ACTIVE' ? (
                                  <div className="cm-progress-cell">
                                    <div className="cm-progress-text">
                                      <span>{s.completedAssignments}/{s.requiredAssignments}</span>
                                      <strong>{s.assignmentProgressPercent}%</strong>
                                    </div>
                                    <div className="cm-progress-bar">
                                      <div className="cm-progress-bar-fill" style={{ width: `${Math.min(100, s.assignmentProgressPercent || 0)}%`, background: '#25704d' }} />
                                    </div>
                                  </div>
                                ) : '—'}
                              </td>
                              <td>
                                {s.status === 'ACTIVE' ? (
                                  <strong>{s.overallProgressPercent}%</strong>
                                ) : '—'}
                              </td>
                              <td>
                                {s.status === 'ACTIVE' ? (
                                  s.averageScorePercent != null ? <strong>{s.averageScorePercent}%</strong> : '—'
                                ) : '—'}
                              </td>
                              <td>
                                {s.status === 'ACTIVE' && s.overdueAssignments > 0 ? (
                                  <span className="cm-overdue-tag">⚠ {s.overdueAssignments} bài</span>
                                ) : (
                                  <span style={{ color: '#8c9790' }}>0</span>
                                )}
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="cm-button cm-button-small cm-button-primary"
                                  disabled={s.status !== 'ACTIVE'}
                                  onClick={() => openStudentDetail(s)}
                                >
                                  Hồ sơ học tập
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* TAB 3: SUBJECT ASSIGNMENTS */}
          {activeTab === 'assignments' && (
            <section className="cm-panel cm-curriculum-panel">
              <div className="cm-panel-heading">
                <div>
                  <h2>Bài tập của môn học</h2>
                  <p>Soạn đề tự luận hoặc bài kiểm tra trắc nghiệm, cấu hình rubric và chấm bài nộp.</p>
                </div>
                <button
                  type="button"
                  className="cm-button cm-button-primary"
                  onClick={() => navigate(`/teacher/assignments/new?subjectId=${courseId}`)}
                >
                  ＋ Soạn bài tập mới
                </button>
              </div>

              <div style={{ padding: '16px 20px 24px' }}>
                {assignmentsError && <div className="cm-alert" role="alert">{assignmentsError}</div>}
                {assignmentsLoading ? (
                  <div className="cm-loading">Đang tải danh sách bài tập…</div>
                ) : courseAssignments.length === 0 ? (
                  <div className="cm-empty-state">
                    <div className="cm-empty-icon">📝</div>
                    <h3>Khóa học chưa có bài tập</h3>
                    <p>Soạn bài tập tự luận hoặc bài trắc nghiệm để sinh viên thực hành và tích lũy điểm số.</p>
                    <button
                      type="button"
                      className="cm-button cm-button-primary"
                      onClick={() => navigate(`/teacher/assignments/new?subjectId=${courseId}`)}
                    >
                      Soạn bài tập đầu tiên
                    </button>
                  </div>
                ) : (
                  <div className="cm-table-wrap">
                    <table className="cm-table">
                      <thead>
                        <tr>
                          <th>Tên bài tập</th>
                          <th>Hình thức</th>
                          <th>Hạn nộp</th>
                          <th>Điểm tối đa</th>
                          <th>Tình hình nộp</th>
                          <th>Trạng thái</th>
                          <th><span className="sr-only">Thao tác</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {courseAssignments.map((a) => (
                          <tr key={a.id}>
                            <td>
                              <div>
                                <Link to={`/teacher/assignments/${a.id}`} className="cm-course-title-link">
                                  {a.title}
                                </Link>
                                <small className="cm-subline">{a.description || 'Chưa có mô tả'}</small>
                              </div>
                            </td>
                            <td>
                              <span style={{ fontSize: '12px', color: '#4a5b51', fontWeight: '600' }}>
                                {a.assignmentType === 'QUIZ' ? 'Trắc nghiệm' : 'Tự luận / nộp tệp'}
                              </span>
                            </td>
                            <td>
                              {a.dueDate ? new Date(a.dueDate).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </td>
                            <td>
                              <strong>{a.maxScore}</strong>
                            </td>
                            <td>
                              <span style={{ fontSize: '12px' }}>
                                {a.submissionCount ?? 0} bài nộp
                              </span>
                            </td>
                            <td>
                              <StatusTag status={a.status} />
                            </td>
                            <td>
                              <div className="cm-row-actions">
                                <Link to={`/teacher/assignments/${a.id}`} className="cm-button cm-button-small">
                                  Xem
                                </Link>
                                {['DRAFT', 'PUBLISHED'].includes(a.status) && (
                                  <Link to={`/teacher/assignments/${a.id}/edit`} className="cm-button cm-button-small cm-button-quiet">
                                    Sửa
                                  </Link>
                                )}
                                {a.status === 'DRAFT' && (
                                  <button
                                    type="button"
                                    className="cm-button cm-button-small cm-button-primary"
                                    onClick={() => transitionAssignment(a.id, 'publish')}
                                  >
                                    Xuất bản
                                  </button>
                                )}
                                {a.status === 'PUBLISHED' && (
                                  <button
                                    type="button"
                                    className="cm-button cm-button-small cm-button-quiet"
                                    onClick={() => transitionAssignment(a.id, 'close')}
                                  >
                                    Đóng bài
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* INSPECTOR SIDEBAR */}
          <aside className="cm-inspector">
            <section className="cm-inspector-card">
              <h2>Thông tin khóa học</h2>
              <dl>
                <div>
                  <dt>Mã khóa học</dt>
                  <dd>{course.courseCode}</dd>
                </div>
                <div>
                  <dt>Trạng thái</dt>
                  <dd>
                    <span className={`cm-status cm-status-${course.status.toLowerCase()}`}>
                      {courseStatusLabel[course.status] || course.status}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Tổng học phần</dt>
                  <dd>{modules.length}</dd>
                </div>
                <div>
                  <dt>Tổng bài học</dt>
                  <dd>{totalLessons}</dd>
                </div>
                <div>
                  <dt>Sinh viên đang học</dt>
                  <dd>{analytics?.activeStudents ?? 0}</dd>
                </div>
                <div>
                  <dt>Môn học</dt>
                  <dd>{course.subject || '—'}</dd>
                </div>
                <div>
                  <dt>Học phí</dt>
                  <dd>{formatCoursePrice(course.price)}</dd>
                </div>
              </dl>
            </section>

            <section className="cm-inspector-card">
              <h2>Thao tác khóa học</h2>
              <button
                type="button"
                className="cm-inspector-action"
                onClick={() => { setSubmitError(''); setCourseFormOpen(true); }}
              >
                Sửa thông tin khóa học
              </button>
              <button
                type="button"
                className={`cm-inspector-action ${activeTab === 'curriculum' ? 'active' : ''}`}
                onClick={() => setActiveTab('curriculum')}
              >
                Chương trình học ({modules.length})
              </button>
              <button
                type="button"
                className={`cm-inspector-action ${activeTab === 'students' ? 'active' : ''}`}
                onClick={() => setActiveTab('students')}
              >
                Danh sách sinh viên & tiến độ
              </button>
              <button
                type="button"
                className={`cm-inspector-action ${activeTab === 'assignments' ? 'active' : ''}`}
                onClick={() => setActiveTab('assignments')}
              >
                Bài tập môn học ({courseAssignments.length})
              </button>
              <button
                type="button"
                className="cm-inspector-action"
                onClick={() => navigate(`/teacher/assignments/new?subjectId=${courseId}`)}
              >
                ＋ Soạn bài tập mới cho khóa
              </button>
              <button
                type="button"
                className="cm-inspector-action"
                onClick={exportStudents}
              >
                Tải danh sách sinh viên (CSV)
              </button>
              <Link className="cm-inspector-action" to="/courses">
                Về danh sách khóa học
              </Link>
            </section>
          </aside>
        </div>
      </div>

      {courseFormOpen && (
        <CourseForm
          initialCourse={course}
          onClose={() => setCourseFormOpen(false)}
          onSubmit={submitCourse}
          saving={saving}
          submitError={submitError}
        />
      )}

      {curriculumForm && (
        <CurriculumModal
          courseId={courseId}
          kind={curriculumForm.kind}
          initial={curriculumForm.module && curriculumForm.kind === 'module' ? curriculumForm.module : curriculumForm.lesson}
          title={`${curriculumForm.module || curriculumForm.lesson ? 'Sửa' : 'Thêm'} ${curriculumForm.kind === 'module' ? 'học phần' : 'bài học'}`}
          onClose={() => setCurriculumForm(null)}
          onSubmit={submitCurriculum}
          saving={saving}
          submitError={submitError}
        />
      )}
    </main>
  );
}

export default CourseCurriculumPage;
