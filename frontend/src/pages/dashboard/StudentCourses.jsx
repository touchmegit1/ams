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

  const loadCourses = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/courses/published');
      setCourses(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Không thể tải danh sách khóa học.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCourses(); }, []);

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
  if (!courses.length) return <div className="dashboard-empty"><strong>Chưa có khóa học được xuất bản</strong><p>Khóa học sẽ xuất hiện tại đây khi giảng viên xuất bản.</p></div>;

  return (
    <div className="student-courses">
      <p className="student-courses-count">{courses.length} khóa học đã xuất bản</p>
      <div className="student-courses-grid">
        {courses.map((course) => (
          <article className="student-course-card" key={course.courseId}>
            <div className="student-course-icon"><FiBookOpen aria-hidden="true" /></div>
            <div className="student-course-main">
              <span className="student-course-code">{course.courseCode} · {course.subject}</span>
              <h2>{course.title}</h2>
              <p>{course.description || 'Giảng viên chưa thêm mô tả cho khóa học này.'}</p>
              {course.targetAudience && <span className="student-course-audience">Dành cho {course.targetAudience}</span>}
            </div>
            <div className="student-course-footer">
              <strong>{formatCoursePrice(course.price)}</strong>
              <button onClick={() => toggleCourse(course.courseId)} aria-expanded={openId === course.courseId}>
                {openId === course.courseId ? 'Thu gọn' : 'Xem nội dung'}
                {openId === course.courseId ? <FiChevronUp aria-hidden="true" /> : <FiChevronDown aria-hidden="true" />}
              </button>
            </div>
            {openId === course.courseId && (
              <div className="student-course-modules">
                {moduleError ? <p role="alert">{moduleError}</p> : !modules[course.courseId] ? <p>Đang tải học phần…</p> : modules[course.courseId].length === 0 ? <p>Khóa học chưa có học phần.</p> : modules[course.courseId].map((module, index) => (
                  <div key={module.moduleId}><strong>{String(index + 1).padStart(2, '0')}. {module.title}</strong><span>{module.lessons?.length || 0} bài học</span></div>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

export default StudentCourses;
