import { useEffect, useState } from 'react';
import { FiBookOpen, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import api from '../../services/api.js';
import { formatCoursePrice } from '../course/courseUi.js';

function StudentCourses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [modules, setModules] = useState({});
  const [moduleError, setModuleError] = useState('');
  const [enrollments, setEnrollments] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [now, setNow] = useState(Date.now());

  const loadCourses = async () => {
    setLoading(true);
    setError('');
    try {
      const [{ data }, { data: registered }] = await Promise.all([api.get('/courses/published'), api.get('/enrollments')]);
      setCourses(Array.isArray(data) ? data : []);
      setEnrollments(Array.isArray(registered) ? registered : []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Không thể tải danh sách khóa học.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCourses(); }, []);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);

  const enroll = async (courseId) => {
    setBusyId(courseId);
    setError('');
    try {
      const { data } = await api.post(`/enrollments/courses/${courseId}`);
      setEnrollments((current) => [data, ...current.filter((item) => item.courseId !== courseId)]);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Không thể đăng ký khóa học.');
    } finally { setBusyId(null); }
  };

  const refreshEnrollment = async (id) => {
    try {
      const { data } = await api.get(`/enrollments/${id}`);
      setEnrollments((current) => current.map((item) => item.enrollmentId === id ? data : item));
      if (data.status === 'ACTIVE') setModules((current) => { const next = { ...current }; delete next[data.courseId]; return next; });
    } catch (requestError) { setError(requestError.response?.data?.message || 'Không thể cập nhật trạng thái.'); }
  };

  const toggleCourse = async (courseId) => {
    if (openId === courseId) { setOpenId(null); return; }
    setOpenId(courseId);
    setModuleError('');
    if (modules[courseId]) return;
    try {
      const { data } = await api.get(`/courses/published/${courseId}/modules`);
      setModules((current) => ({ ...current, [courseId]: Array.isArray(data) ? data : [] }));
    } catch (requestError) {
      setModuleError(requestError.response?.data?.message || 'Không thể tải nội dung khóa học.');
    }
  };

  if (loading) return <p className="student-courses-message">Đang tải khóa học…</p>;
  if (error) return <div className="student-courses-message" role="alert"><p>{error}</p><button onClick={loadCourses}>Thử lại</button></div>;
  if (!courses.length && !enrollments.length) return <div className="dashboard-empty"><strong>Chưa có khóa học được xuất bản</strong><p>Khóa học sẽ xuất hiện tại đây khi giảng viên xuất bản.</p></div>;

  const displayed = [...courses, ...enrollments.filter((item) => item.status === 'ACTIVE' && !courses.some((course) => course.courseId === item.courseId)).map((item) => ({ courseId: item.courseId, title: item.courseTitle, archived: true }))];

  return (
    <div className="student-courses">
      <p className="student-courses-count">{courses.length} khóa học đã xuất bản</p>
      <div className="student-courses-grid">
        {displayed.map((course) => {
          const registration = enrollments.find((item) => item.courseId === course.courseId);
          const remaining = registration?.expiresAt ? Math.max(0, Math.ceil((new Date(registration.expiresAt).getTime() - now) / 1000)) : 0;
          const status = registration?.status === 'PENDING' && remaining === 0 ? 'EXPIRED' : registration?.status;
          return (
          <article className="student-course-card" key={course.courseId}>
            <div className="student-course-icon"><FiBookOpen aria-hidden="true" /></div>
            <div className="student-course-main">
              <span className="student-course-code">{course.archived ? 'Đã lưu trữ' : `${course.courseCode || ''} · ${course.subject || ''}`}</span>
              <h2>{course.title}</h2>
              <p>{course.description || 'Giảng viên chưa thêm mô tả cho khóa học này.'}</p>
              {course.targetAudience && <span className="student-course-audience">Dành cho {course.targetAudience}</span>}
            </div>
            <div className="student-course-footer">
              <strong>{course.archived ? 'Đã đăng ký' : formatCoursePrice(course.price)}</strong>
              {status !== 'ACTIVE' && status !== 'PENDING' && <button disabled={busyId === course.courseId} onClick={() => enroll(course.courseId)}>{busyId === course.courseId ? 'Đang xử lý…' : status === 'EXPIRED' ? 'Tạo thanh toán mới' : 'Đăng ký khóa học'}</button>}
              <button onClick={() => toggleCourse(course.courseId)} aria-expanded={openId === course.courseId}>
                {openId === course.courseId ? 'Thu gọn' : 'Xem nội dung'}
                {openId === course.courseId ? <FiChevronUp aria-hidden="true" /> : <FiChevronDown aria-hidden="true" />}
              </button>
            </div>
            {status === 'PENDING' && <div className="student-payment"><h3>Chờ chuyển khoản</h3><p>Còn {Math.floor(remaining / 3600)} giờ {Math.floor(remaining % 3600 / 60)} phút {remaining % 60} giây</p><img src={registration.qrUrl} alt={`QR thanh toán khóa ${course.title}`} /><p>Ngân hàng: {registration.bank} · STK: {registration.accountNumber}</p><p>Số tiền: {formatCoursePrice(registration.amount)}</p><p>Nội dung: <strong>{registration.transferContent}</strong></p><button onClick={() => refreshEnrollment(registration.enrollmentId)}>Kiểm tra thanh toán</button></div>}
            {status === 'ACTIVE' && <p className="student-enrollment-active">Đã đăng ký · Có thể xem bài học</p>}
            {status === 'EXPIRED' && <p className="student-enrollment-expired">Đơn đã hết hạn. Tạo lượt thanh toán mới để tiếp tục.</p>}
            {openId === course.courseId && (
              <div className="student-course-modules">
                {moduleError ? <p role="alert">{moduleError}</p> : !modules[course.courseId] ? <p>Đang tải học phần…</p> : modules[course.courseId].length === 0 ? <p>Khóa học chưa có học phần.</p> : modules[course.courseId].map((module, index) => (
                  <div key={module.moduleId}><strong>{String(index + 1).padStart(2, '0')}. {module.title}</strong><span>{module.lessons?.length || 0} bài học</span>{module.lessons?.map((lesson) => <div key={lesson.lessonId}><strong>{lesson.title}</strong>{lesson.content && <p>{lesson.content}</p>}{lesson.videoUrl && <a href={lesson.videoUrl} target="_blank" rel="noreferrer">Xem video</a>}</div>)}</div>
                ))}
              </div>
            )}
          </article>
        ); })}
      </div>
    </div>
  );
}

export default StudentCourses;
