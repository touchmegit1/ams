import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWorkspaceNavigate as useNavigate } from '../../components/common/WorkspaceNavigation.jsx';
import {
  FiHome,
  FiBookOpen,
  FiLayers,
  FiArrowRight,
  FiClipboard,
  FiUsers,
  FiClock,
  FiAlertCircle,
  FiPlus,
  FiCheckSquare,
  FiFileText,
} from 'react-icons/fi';
import WorkspaceHeader from '../../components/common/WorkspaceHeader.jsx';
import StudentCourses from './StudentCourses.jsx';
import StudentAssignments from './StudentAssignments.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../services/api.js';
import { courseStatusLabel } from '../course/courseUi.js';
import './teacher-dashboard.css';

const studentSections = [
  { id: 'home', label: 'Trang chủ', icon: FiHome, title: 'Bắt đầu từ đây', description: 'Theo dõi môn học, bài tập và tiến độ học tập trong một không gian.', detail: 'Xem tổng quan và chọn công việc bạn muốn tiếp tục.' },
  { id: 'courses', label: 'Khóa học', icon: FiBookOpen, title: 'Khóa học đang mở', description: 'Khám phá các khóa học đã xuất bản cùng nội dung học phần.', detail: 'Các khóa học đã xuất bản sẽ xuất hiện tại đây.' },
  { id: 'enrollment', label: 'Đăng ký học', icon: FiLayers, title: 'Khóa học của tôi', description: 'Theo dõi các khóa đã đăng ký và thanh toán đang chờ.', detail: 'Thông tin đăng ký và thanh toán sẽ xuất hiện tại đây.' },
  { id: 'assignments', label: 'Bài tập', icon: FiClipboard, title: 'Bài tập của tôi', description: 'Nộp bài và theo dõi kết quả đánh giá.', detail: 'Bài tập của các khóa đã ghi danh sẽ xuất hiện tại đây.' },
];

const teacherSections = [
  { id: 'home', label: 'Trang chủ', icon: FiHome, title: 'Tổ chức việc giảng dạy', description: 'Quản lý khóa học, bài học, bài kiểm tra và danh sách sinh viên theo từng khóa.', detail: 'Xem tổng quan và chọn công việc bạn muốn tiếp tục.' },
  { id: 'courses', label: 'Khóa học', icon: FiBookOpen, title: 'Quản lý khóa học', description: 'Sắp xếp khóa học, học phần và bài học cho sinh viên.', detail: 'Các khóa học bạn phụ trách sẽ xuất hiện tại đây.' },
  { id: 'assignments', label: 'Bài tập', icon: FiClipboard, title: 'Quản lý bài tập', description: 'Soạn đề tự luận & trắc nghiệm, duyệt điểm AI và theo dõi bài nộp.', detail: 'Bài tập môn học và hàng đợi duyệt bài nộp sẽ xuất hiện tại đây.' },
];

function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [teacherOverview, setTeacherOverview] = useState(null);
  const [teacherCourses, setTeacherCourses] = useState([]);
  const activeId = searchParams.get('section') || 'home';
  const isTeacher = user?.role?.toUpperCase() === 'TEACHER';

  useEffect(() => {
    if (!isTeacher) return;
    let active = true;
    api.get('/teacher/overview')
      .then(({ data }) => { if (active) setTeacherOverview(data); })
      .catch(() => { if (active) setTeacherOverview(null); });
    api.get('/courses')
      .then(({ data }) => { if (active && Array.isArray(data)) setTeacherCourses(data); })
      .catch(() => { if (active) setTeacherCourses([]); });
    return () => { active = false; };
  }, [isTeacher]);

  const openSection = (id) => {
    if (id === 'courses') navigate('/courses');
    else if (id === 'assignments') navigate('/teacher/assignments');
    else setSearchParams(id === 'home' ? {} : { section: id });
  };

  const openCourse = (courseId) => setSearchParams(courseId == null ? { section: activeId } : { section: activeId, course: String(courseId) });

  useEffect(() => {
    if (user?.role === 'ADMIN') navigate('/admin', { replace: true });
    else if (searchParams.get('section') === 'courses') navigate('/courses', { replace: true });
    else if (searchParams.get('section') === 'assignments' && isTeacher) navigate('/teacher/assignments', { replace: true });
}, [user?.role, searchParams, navigate, isTeacher]);

const sections = isTeacher ? teacherSections : studentSections;
const active = sections.find((section) => section.id === activeId) || sections[0];
const name = user?.fullName || (isTeacher ? 'Giảng viên' : 'Sinh viên');

return (
  <div className="dashboard-container">
    <WorkspaceHeader sections={sections} activeId={active.id} onSelect={openSection} />

    <main className="dashboard-content">
      {active.id === 'home' ? (
        <div className="dashboard-home">
          <section className="dashboard-hero">
            <p className="dashboard-eyebrow">KHÔNG GIAN {isTeacher ? 'GIẢNG DẠY' : 'HỌC TẬP'} CỦA BẠN</p>
            <h1>Xin chào, {name}.<br /><span>{isTeacher ? 'Cùng xây dựng bài học tốt hơn.' : 'Tiếp tục hành trình học tập.'}</span></h1>
            <p className="dashboard-hero-copy">
              {isTeacher
                ? 'Từ khóa học đến bài tập, mọi công việc giảng dạy đều có một nơi rõ ràng để bắt đầu.'
                : 'Từ khóa học đến bài tập, mọi bước tiến của bạn đều có một nơi rõ ràng để theo dõi.'}
            </p>
            <button className="dashboard-primary-action" onClick={() => openSection('courses')}>
              Xem khóa học <FiArrowRight aria-hidden="true" />
            </button>
          </section>

          {isTeacher && teacherOverview && (
            <section className="teacher-overview-cards" aria-label="Tổng quan giảng dạy">
              {[
                { label: 'Khóa đang mở', value: teacherOverview.publishedCourses, icon: FiBookOpen, action: () => navigate('/courses?status=PUBLISHED') },
                { label: 'Sinh viên đang học', value: teacherOverview.activeStudents, icon: FiUsers, action: () => navigate('/courses') },
                { label: 'Bài cần duyệt', value: teacherOverview.submissionsToReview, icon: FiClipboard, action: () => navigate('/teacher/assignments'), highlight: teacherOverview.submissionsToReview > 0 },
                { label: 'Assignment sắp hạn', value: teacherOverview.upcomingAssignments, icon: FiClock, action: () => navigate('/teacher/assignments') },
                { label: 'Có bài quá hạn', value: teacherOverview.studentsWithOverdueAssignments, icon: FiAlertCircle, action: () => navigate('/courses'), warning: teacherOverview.studentsWithOverdueAssignments > 0 },
              ].map(({ label, value, icon: Icon, action, highlight, warning }) => (
                <button key={label} type="button" className={`teacher-overview-card ${warning ? 'is-warning' : ''} ${highlight ? 'is-highlight' : ''}`} onClick={action}>
                  <span className="toc-icon"><Icon aria-hidden="true" /></span>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </button>
              ))}
            </section>
          )}

          {isTeacher && (
            <section className="teacher-quick-actions" aria-label="Thao tác nhanh cho giảng viên">
              <button type="button" className="teacher-action-btn teacher-action-btn-primary" onClick={() => navigate('/courses')}>
                <FiPlus aria-hidden="true" /> Tạo khóa học mới
              </button>
              <button type="button" className="teacher-action-btn" onClick={() => navigate('/teacher/assignments/new')}>
                <FiPlus aria-hidden="true" /> Soạn bài tập mới
              </button>
              <button type="button" className="teacher-action-btn" onClick={() => navigate('/teacher/assignments')}>
                <FiCheckSquare aria-hidden="true" /> Duyệt bài nộp {teacherOverview?.submissionsToReview > 0 && `(${teacherOverview.submissionsToReview})`}
              </button>
              <button type="button" className="teacher-action-btn" onClick={() => navigate('/teacher/assignment-templates')}>
                <FiFileText aria-hidden="true" /> Thư viện mẫu bài tập
              </button>
            </section>
          )}

          {isTeacher && teacherOverview?.submissionsToReview > 0 && (
            <div className="teacher-review-alert">
              <div className="teacher-review-alert-text">
                <strong>Có {teacherOverview.submissionsToReview} bài nộp của sinh viên đang chờ duyệt điểm</strong>
                <span>Xem lại bài làm và phê duyệt điểm chính thức để đồng bộ kết quả học tập cho sinh viên.</span>
              </div>
              <button type="button" className="cm-button cm-button-primary cm-button-small" onClick={() => navigate('/teacher/assignments')}>
                Duyệt ngay →
              </button>
            </div>
          )}

          {isTeacher && teacherCourses.length > 0 && (
            <section className="teacher-section-wrap" aria-labelledby="teacher-courses-title">
              <div className="teacher-section-header">
                <h2 id="teacher-courses-title">Khóa học phụ trách gần đây</h2>
                <button type="button" onClick={() => navigate('/courses')}>Xem tất cả ({teacherCourses.length}) →</button>
              </div>
              <div className="teacher-courses-grid">
                {teacherCourses.slice(0, 3).map((course) => (
                  <article className="teacher-course-card" key={course.courseId}>
                    <div className="teacher-course-card-top">
                      <span className="teacher-course-card-code">{course.courseCode}</span>
                      <span className={`cm-status cm-status-${course.status.toLowerCase()}`}>
                        {courseStatusLabel[course.status] || course.status}
                      </span>
                    </div>
                    <div>
                      <h3 className="teacher-course-card-title">
                        <a href={`/courses/${course.courseId}`}>{course.title}</a>
                      </h3>
                      <p className="teacher-course-card-desc">{course.description || course.subject || 'Chưa có mô tả'}</p>
                    </div>
                    <div className="teacher-course-card-actions">
                      <button type="button" className="cm-button cm-button-small cm-button-primary" onClick={() => navigate(`/courses/${course.courseId}`)}>
                        Chương trình học
                      </button>
                      <button type="button" className="cm-button cm-button-small cm-button-quiet" onClick={() => navigate(`/courses/${course.courseId}?tab=students`)}>
                        Sinh viên & tiến độ
                      </button>
                      <button type="button" className="cm-button cm-button-small cm-button-quiet" onClick={() => navigate(`/courses/${course.courseId}?tab=assignments`)}>
                        Bài tập
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="dashboard-journey" aria-labelledby="journey-title">
            <div className="dashboard-section-heading">
              <p>KHÁM PHÁ AMS</p>
              <h2 id="journey-title">{isTeacher ? 'Không gian làm việc của giảng viên' : 'Lộ trình học tập của bạn'}</h2>
            </div>
            <div className="dashboard-steps">
              {sections.slice(1).map(({ id, label, icon: Icon, description }, index) => (
                <button className="dashboard-step" key={id} onClick={() => openSection(id)}>
                  <span className="dashboard-step-number">0{index + 1}</span>
                  <span className="dashboard-step-icon"><Icon aria-hidden="true" /></span>
                  <strong>{label}</strong>
                  <span>{description}</span>
                  <FiArrowRight className="dashboard-step-arrow" aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <section className={`dashboard-detail ${!isTeacher && (active.id === 'courses' || active.id === 'enrollment') ? 'dashboard-detail-courses' : ''}`} aria-labelledby="dashboard-detail-title">
          <button className="dashboard-back" onClick={() => openSection('home')}>Trang chủ <span aria-hidden="true">/</span> {active.label}</button>
          <div className="dashboard-detail-heading">
            <span className="dashboard-detail-icon"><active.icon aria-hidden="true" /></span>
            <p>{isTeacher ? 'KHÔNG GIAN GIẢNG DẠY' : 'KHÔNG GIAN HỌC TẬP'}</p>
            <h1 id="dashboard-detail-title">{active.title}</h1>
            <span>{active.description}</span>
          </div>
          {!isTeacher && (active.id === 'courses' || active.id === 'enrollment') ? (
            <StudentCourses initialView={active.id === 'enrollment' ? 'enrollment' : 'catalog'} initialCourseId={searchParams.get('course')} onCourseChange={openCourse} />
          ) : !isTeacher && active.id === 'assignments' ? (
            <StudentAssignments />
          ) : (
            <div className="dashboard-empty">
              <strong>Chưa có nội dung</strong>
              <p>{active.detail}</p>
            </div>
          )}
        </section>
      )}
    </main>
  </div>
);
}

export default DashboardPage;
