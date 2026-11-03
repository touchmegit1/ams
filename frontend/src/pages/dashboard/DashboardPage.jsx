import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWorkspaceNavigate as useNavigate } from '../../components/common/WorkspaceNavigation.jsx';
import { FiHome, FiBookOpen, FiLayers } from 'react-icons/fi';
import WorkspaceHeader from '../../components/common/WorkspaceHeader.jsx';
import StudentCourses from './StudentCourses.jsx';
import StudentHome from './StudentHome.jsx';
import TeacherCoursesHome from './TeacherCoursesHome.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const studentSections = [
  { id: 'home', label: 'Trang chủ', icon: FiHome, title: 'Bắt đầu từ đây', description: 'Theo dõi môn học, bài tập và tiến độ học tập trong một không gian.', detail: 'Xem tổng quan và chọn công việc bạn muốn tiếp tục.' },
  { id: 'enrollment', label: 'Khóa học của tôi', icon: FiBookOpen, title: 'Khóa học của tôi', description: 'Tiếp tục học trong các khóa bạn đã tham gia.', detail: 'Các khóa đã tham gia sẽ xuất hiện tại đây.' },
  { id: 'courses', label: 'Khám phá khóa học', icon: FiLayers, title: 'Khám phá khóa học', description: 'Tìm khóa học mới và xem trước nội dung trước khi tham gia.', detail: 'Các khóa học đã xuất bản sẽ xuất hiện tại đây.' },
];

const teacherSections = [
  { id: 'home', label: 'Trang chủ', icon: FiHome, title: 'Việc cần làm', description: 'Theo dõi công việc đang chờ và mở nhanh các lớp gần đây.', detail: 'Xem công việc cần xử lý và các khóa học gần đây.' },
  { id: 'courses', label: 'Khóa học', icon: FiBookOpen, title: 'Khóa học của bạn', description: 'Mở lớp để quản lý học phần, bài tập, sinh viên và thanh toán.', detail: 'Các khóa học bạn phụ trách sẽ xuất hiện tại đây.' },
];

function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeId = searchParams.get('section') || 'home';
  const isTeacher = user?.role?.toUpperCase() === 'TEACHER';
  const openSection = (id) => {
    if (isTeacher && id === 'courses') navigate('/courses');
    else setSearchParams(id === 'home' ? {} : { section: id });
  };
  const openCourse = (courseId, tab = 'lessons') => setSearchParams(courseId == null ? { section: activeId } : { section: activeId, course: String(courseId), courseTab: tab });
  const openStudentCourse = (courseId, tab = 'lessons') => setSearchParams({ section: 'enrollment', course: String(courseId), courseTab: tab });
  useEffect(() => { if (user?.role === 'ADMIN') navigate('/admin', { replace: true }); }, [user?.role, navigate]);
  const sections = isTeacher ? teacherSections : studentSections;
  const active = sections.find((section) => section.id === activeId) || sections[0];
  const name = user?.fullName || (isTeacher ? 'Giảng viên' : 'Sinh viên');
  return (
    <div className="dashboard-container">
      <WorkspaceHeader sections={sections} activeId={active.id} onSelect={openSection} />

      <main className="dashboard-content">
        {active.id === 'home' ? isTeacher ? <TeacherCoursesHome /> : <StudentHome name={name} onOpenSection={openSection} onOpenCourse={openStudentCourse} /> : (
          <section className={`dashboard-detail ${!isTeacher && (active.id === 'courses' || active.id === 'enrollment') ? 'dashboard-detail-courses' : ''}`} aria-labelledby="dashboard-detail-title">
            <button className="dashboard-back" onClick={() => openSection('home')}>Trang chủ <span aria-hidden="true">/</span> {active.label}</button>
            <div className="dashboard-detail-heading"><span className="dashboard-detail-icon"><active.icon aria-hidden="true" /></span><p>{isTeacher ? 'KHÔNG GIAN GIẢNG DẠY' : 'KHÔNG GIAN HỌC TẬP'}</p><h1 id="dashboard-detail-title">{active.title}</h1><span>{active.description}</span></div>
            {!isTeacher && (active.id === 'courses' || active.id === 'enrollment') ? <StudentCourses initialView={active.id === 'enrollment' ? 'enrollment' : 'catalog'} initialCourseId={searchParams.get('course')} initialCourseTab={searchParams.get('courseTab')} onCourseChange={openCourse} /> : <div className="dashboard-empty"><strong>Chưa có nội dung</strong><p>{active.detail}</p></div>}
          </section>
        )}
      </main>
    </div>
  );
}

export default DashboardPage;
