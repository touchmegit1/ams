import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiBookOpen, FiClipboard, FiPlus, FiUsers } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../services/api.js';
import { formatCoursePrice } from '../course/courseUi.js';
import { selectTeacherDashboardCourses } from './teacherDashboard.js';
import './teacher-courses-home.css';

const statusLabel = { DRAFT: 'Bản nháp', PUBLISHED: 'Đang mở', ARCHIVED: 'Đã lưu trữ' };

export default function TeacherCoursesHome() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const summary = useMemo(() => courses.reduce((total, course) => ({
    courseCount: total.courseCount + 1,
    studentCount: total.studentCount + (Number(course.studentCount) || 0),
    pendingCount: total.pendingCount + (Number(course.pendingReviewCount) || 0),
  }), { courseCount: 0, studentCount: 0, pendingCount: 0 }), [courses]);
  const { reviewCourses, recentCourses } = useMemo(() => selectTeacherDashboardCourses(courses), [courses]);

  const load = () => {
    setLoading(true);
    setError('');
    api.get('/teacher/courses')
      .then(({ data }) => setCourses(Array.isArray(data) ? data : []))
      .catch((requestError) => setError(requestError.response?.data?.message || 'Không thể tải khóa học.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return <main className="teacher-dashboard-home" aria-labelledby="teacher-dashboard-title">
    <header className="teacher-dashboard-heading">
      <div>
        <p>Không gian giảng dạy</p>
        <h1 id="teacher-dashboard-title">Xin chào, {user?.fullName || 'Giảng viên'}</h1>
        <span>Đây là những lớp và công việc cần chú ý hôm nay.</span>
      </div>
      <Link className="teacher-dashboard-create" to="/courses?create=1"><FiPlus aria-hidden="true" /> Tạo khóa học</Link>
    </header>

    {error && <div className="teacher-dashboard-error" role="alert">{error}<button onClick={load}>Thử lại</button></div>}
    {!error && <>
      <section className="teacher-dashboard-stats" aria-label="Tổng quan giảng dạy">
        <div><FiBookOpen aria-hidden="true" /><span><strong>{loading ? '—' : summary.courseCount}</strong><small>Khóa học</small></span></div>
        <div><FiUsers aria-hidden="true" /><span><strong>{loading ? '—' : summary.studentCount}</strong><small>Sinh viên đang học</small></span></div>
        <div className={summary.pendingCount ? 'has-pending' : ''}><FiClipboard aria-hidden="true" /><span><strong>{loading ? '—' : summary.pendingCount}</strong><small>Bài cần chấm</small></span></div>
      </section>

      {loading ? <p className="teacher-dashboard-loading" role="status">Đang tải công việc giảng dạy…</p> : !courses.length ? (
        <section className="teacher-dashboard-empty">
          <FiBookOpen aria-hidden="true" />
          <h2>Bắt đầu với khóa học đầu tiên</h2>
          <p>Tạo một lớp để thêm học phần, giao bài tập và quản lý sinh viên.</p>
          <Link className="teacher-dashboard-create" to="/courses?create=1"><FiPlus aria-hidden="true" /> Tạo khóa học</Link>
        </section>
      ) : <>
        <section className="teacher-dashboard-section" aria-labelledby="teacher-review-title">
          <div className="teacher-dashboard-section-heading">
            <div><h2 id="teacher-review-title">Bài nộp cần chấm</h2><p>Các lớp có bài nộp đang chờ bạn xem.</p></div>
            <span>{summary.pendingCount} bài</span>
          </div>
          {!reviewCourses.length ? <div className="teacher-dashboard-quiet-empty"><span className="teacher-dashboard-done" aria-hidden="true">✓</span><div><strong>Không có bài cần chấm</strong><p>Bài nộp mới sẽ xuất hiện tại đây.</p></div></div> : <div className="teacher-dashboard-task-list">
            {reviewCourses.map((course) => <Link className="teacher-dashboard-task" to={`/courses/${course.courseId}?tab=assignments`} key={course.courseId}>
              <span className="teacher-dashboard-task-icon"><FiClipboard aria-hidden="true" /></span>
              <span className="teacher-dashboard-task-copy"><small>{course.courseCode || 'Khóa học'}</small><strong>{course.title}</strong></span>
              <span className="teacher-dashboard-pending-count">{course.pendingReviewCount} bài chờ chấm</span>
              <FiArrowRight className="teacher-dashboard-task-arrow" aria-hidden="true" />
            </Link>)}
          </div>}
        </section>

        <section className="teacher-dashboard-section teacher-dashboard-recent" aria-labelledby="teacher-recent-title">
          <div className="teacher-dashboard-section-heading">
            <div><h2 id="teacher-recent-title">Khóa học mới tạo</h2><p>Mở nhanh một lớp để tiếp tục quản lý.</p></div>
            <Link to="/courses">Tất cả khóa học <FiArrowRight aria-hidden="true" /></Link>
          </div>
          {!recentCourses.length ? <p className="teacher-dashboard-quiet-empty">Các khóa học gần đây đã có trong mục bài cần chấm.</p> : <div className="teacher-dashboard-course-list">
            {recentCourses.map((course) => <Link className="teacher-dashboard-course" to={`/courses/${course.courseId}`} key={course.courseId}>
              <span className="teacher-dashboard-course-mark"><FiBookOpen aria-hidden="true" /></span>
              <span className="teacher-dashboard-course-copy"><small>{course.courseCode || course.subject || 'Khóa học'}</small><strong>{course.title}</strong><span>{course.studentCount ?? 0} sinh viên · {formatCoursePrice(course.price)}</span></span>
              <span className={`teacher-dashboard-status status-${course.status?.toLowerCase()}`}>{statusLabel[course.status] || course.status}</span>
              <FiArrowRight className="teacher-dashboard-task-arrow" aria-hidden="true" />
            </Link>)}
          </div>}
        </section>
      </>}
    </>}
  </main>;
}
