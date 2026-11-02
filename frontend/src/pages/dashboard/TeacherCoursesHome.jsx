import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiBookOpen, FiLayers, FiPlus, FiSearch, FiUsers } from 'react-icons/fi';
import api from '../../services/api.js';
import { formatCoursePrice } from '../course/courseUi.js';
import './teacher-courses-home.css';

const statusLabel = { DRAFT: 'Bản nháp', PUBLISHED: 'Đang mở', ARCHIVED: 'Đã lưu trữ' };
const normalizeSearch = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

export default function TeacherCoursesHome({ studentFocus = false }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const filteredCourses = useMemo(() => {
    const query = normalizeSearch(search.trim());
    if (!query) return courses;
    return courses.filter((course) => [course.title, course.courseCode, course.subject, course.description]
      .some((value) => normalizeSearch(value).includes(query)));
  }, [courses, search]);

  const load = () => {
    setLoading(true); setError('');
    api.get('/teacher/courses').then(({ data }) => setCourses(Array.isArray(data) ? data : []))
      .catch((requestError) => setError(requestError.response?.data?.message || 'Không thể tải khóa học.'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  return <section className="teacher-courses-home" aria-labelledby="teacher-courses-title">
    <div className="teacher-courses-heading">
      <div><p>Không gian giảng dạy</p><h1 id="teacher-courses-title">{studentFocus ? 'Sinh viên theo lớp' : 'Khóa học của bạn'}</h1><span>{studentFocus ? 'Chọn lớp để xem danh sách sinh viên và trạng thái ghi danh.' : 'Mở một lớp để quản lý nội dung, bài tập và sinh viên.'}</span></div>
      {!studentFocus && <Link className="teacher-courses-create" to="/courses?create=1"><FiPlus /> Tạo khóa học</Link>}
    </div>
    {error && <div className="teacher-courses-error" role="alert">{error}<button onClick={load}>Thử lại</button></div>}
    {!loading && !error && courses.length > 0 && <label className="teacher-courses-search"><FiSearch aria-hidden="true" /><span className="sr-only">Tìm khóa học</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tên khóa học, mã khóa hoặc môn học…" /></label>}
    {loading ? <p className="teacher-courses-message" role="status">Đang tải khóa học…</p> : !courses.length ?
      <div className="teacher-courses-empty"><FiBookOpen /><h2>Chưa có khóa học</h2><p>Tạo khóa học đầu tiên để bắt đầu xây dựng lớp học.</p><Link to="/courses?create=1">Tạo khóa học <FiArrowRight /></Link></div> :
      filteredCourses.length ? <div className="teacher-course-grid">{filteredCourses.map((course) => <Link className="teacher-course-card" to={`/courses/${course.courseId}${studentFocus ? '?tab=students' : ''}`} key={course.courseId}>
        <div className="teacher-course-art"><span className="teacher-course-code">{course.courseCode || 'AMS'}</span><span className={`teacher-course-status status-${course.status?.toLowerCase()}`}>{statusLabel[course.status] || course.status}</span><FiBookOpen aria-hidden="true" /><span className="teacher-course-subject">{course.subject || 'Khóa học'}</span></div>
        <div className="teacher-course-card-body"><h2>{course.title}</h2><p>{course.description || 'Thêm mô tả để giới thiệu khóa học.'}</p>
          <div className="teacher-course-metrics"><span><FiLayers /><b>{course.modulesCount ?? 0}</b> học phần</span><span><FiUsers /><b>{course.studentCount ?? 0}</b> sinh viên</span></div>
          <div className="teacher-course-card-footer"><span>{formatCoursePrice(course.price)}</span>{course.pendingReviewCount > 0 && <em>{course.pendingReviewCount} bài cần chấm</em>}<span className="teacher-course-enter">Vào lớp <FiArrowRight /></span></div>
        </div>
      </Link>)}</div> : <div className="teacher-courses-empty teacher-courses-no-results"><FiSearch /><h2>Không tìm thấy khóa học</h2><p>Thử tên khóa, mã khóa hoặc môn học khác.</p></div>}
  </section>;
}
