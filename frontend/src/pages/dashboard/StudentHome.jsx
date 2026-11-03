import { useEffect, useMemo, useState } from 'react';
import { FiArrowRight, FiBookOpen, FiCalendar, FiCheckCircle, FiClipboard, FiSearch, FiUser } from 'react-icons/fi';
import api from '../../services/api.js';
import { activeEnrollments, upcomingAssignments } from './studentLearning.js';
import './student-home.css';

const dateLabel = (value) => new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));

export default function StudentHome({ name, onOpenSection, onOpenCourse }) {
  const [enrollments, setEnrollments] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const courses = useMemo(() => activeEnrollments(enrollments), [enrollments]);
  const upcoming = useMemo(() => upcomingAssignments(assignments), [assignments]);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [enrollmentResponse, assignmentResponse] = await Promise.all([api.get('/enrollments'), api.get('/student/assignments')]);
      setEnrollments(Array.isArray(enrollmentResponse.data) ? enrollmentResponse.data : []);
      setAssignments(Array.isArray(assignmentResponse.data) ? assignmentResponse.data : []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Không thể tải thông tin học tập.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return <div className="student-home" aria-labelledby="student-home-title">
    {error && <div className="sh-error" role="alert"><span>{error}</span><button onClick={load}>Thử lại</button></div>}
    <section className="sh-welcome">
      <div className="sh-welcome-copy"><span className="sh-term"><i /> Học tập của bạn</span><h1 id="student-home-title">Chào {name},<br />tiếp tục học tập hôm nay.</h1><p>Chọn khóa học để tiếp tục bài giảng hoặc hoàn thành bài tập sắp đến hạn.</p><div className="sh-actions"><button className="sh-primary" onClick={() => onOpenSection('enrollment')}>Mở khóa học của tôi <FiArrowRight /></button><button className="sh-secondary" onClick={() => onOpenSection('courses')}>Khám phá khóa học</button></div></div>
      <div className="sh-stat-board" aria-label="Tổng quan học tập"><div><span className="sh-stat-icon"><FiBookOpen /></span><strong>{loading ? '—' : courses.length}</strong><small>Khóa học đang học</small></div><div><span className="sh-stat-icon is-coral"><FiCalendar /></span><strong>{loading ? '—' : upcoming.length}</strong><small>Bài tập sắp đến hạn</small></div><div><span className="sh-stat-icon is-mint"><FiCheckCircle /></span><strong>{loading ? '—' : assignments.length}</strong><small>Bài tập trong lớp</small></div></div>
    </section>

    <div className="sh-main-grid">
      <section className="sh-courses" aria-labelledby="sh-courses-title">
        <div className="sh-section-head"><div><p>HỌC TIẾP TỪ ĐÂY</p><h2 id="sh-courses-title">Khóa học đang học <span>{courses.length}</span></h2></div><button onClick={() => onOpenSection('enrollment')}>Xem tất cả <FiArrowRight /></button></div>
        {loading ? <p className="sh-state">Đang tải khóa học…</p> : courses.length === 0 ? <div className="sh-empty"><FiBookOpen /><h3>Bắt đầu với khóa học đầu tiên</h3><p>Khám phá các khóa học đã xuất bản và tham gia để xem bài giảng.</p><button className="sh-primary" onClick={() => onOpenSection('courses')}>Khám phá khóa học <FiArrowRight /></button></div> : <div className="sh-course-list">{courses.slice(0, 3).map((enrollment, index) => <article className="sh-course" key={enrollment.enrollmentId}><div className={`sh-course-art tone-${index % 3}`}><span>{enrollment.courseTitle?.slice(0, 2).toUpperCase() || 'AMS'}</span><FiBookOpen /></div><div className="sh-course-copy"><span className="sh-course-status"><i /> Đang học</span><h3>{enrollment.courseTitle}</h3><p><FiUser /> {enrollment.teacherName || 'Giảng viên AMS'}</p><button onClick={() => onOpenCourse(enrollment.courseId, 'lessons')}>Tiếp tục học <FiArrowRight /></button></div></article>)}</div>}
      </section>

      <aside className="sh-aside">
        <section className="sh-deadlines" aria-labelledby="sh-deadlines-title"><div className="sh-section-head"><div><p>ĐỪNG BỎ LỠ</p><h2 id="sh-deadlines-title">Bài tập sắp đến hạn</h2></div><FiClipboard /></div>
          {loading ? <p className="sh-state">Đang tải bài tập…</p> : upcoming.length === 0 ? <div className="sh-deadline-empty"><FiCheckCircle /><p>Bạn không có bài tập sắp đến hạn.</p></div> : <div className="sh-assignment-list">{upcoming.slice(0, 4).map((assignment) => <article className="sh-assignment" key={assignment.id}><div><small>{assignment.subjectName || 'Khóa học'}</small><h3>{assignment.title}</h3><span><FiCalendar /> Hạn {dateLabel(assignment.dueDate)}</span></div><button aria-label={`Mở bài tập ${assignment.title}`} onClick={() => onOpenCourse(assignment.subjectId, 'assignments')}><FiArrowRight /></button></article>)}</div>}
        </section>
        <section className="sh-discover"><div><span className="sh-discover-icon"><FiSearch /></span><div><h3>Tìm khóa học mới</h3><p>Duyệt các môn học đang mở và tham gia ngay.</p></div></div><button onClick={() => onOpenSection('courses')}>Khám phá khóa học <FiArrowRight /></button></section>
      </aside>
    </div>
  </div>;
}
