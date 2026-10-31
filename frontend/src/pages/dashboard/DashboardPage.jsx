import { useState } from 'react';
import { useWorkspaceNavigate as useNavigate } from '../../components/common/WorkspaceNavigation.jsx';
import { FiHome, FiBookOpen, FiLayers, FiClipboard, FiUsers, FiArrowRight } from 'react-icons/fi';
import WorkspaceHeader from '../../components/common/WorkspaceHeader.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const studentSections = [
  { id: 'home', label: 'Trang chủ', icon: FiHome, title: 'Bắt đầu từ đây', description: 'Theo dõi môn học, bài tập và tiến độ học tập trong một không gian.', detail: 'Xem tổng quan và chọn công việc bạn muốn tiếp tục.' },
  { id: 'courses', label: 'Khóa học', icon: FiBookOpen, title: 'Khóa học của bạn', description: 'Khám phá các khóa học, học phần và bài học đang mở.', detail: 'Các khóa học bạn tham gia sẽ xuất hiện tại đây.' },
  { id: 'enrollment', label: 'Đăng ký học', icon: FiLayers, title: 'Đăng ký khóa học', description: 'Chọn khóa học phù hợp và theo dõi quá trình ghi danh.', detail: 'Thông tin đăng ký và thanh toán sẽ xuất hiện tại đây.' },
  { id: 'assignments', label: 'Bài tập', icon: FiClipboard, title: 'Bài tập của bạn', description: 'Nộp bài và xem đánh giá để cải thiện từng bước.', detail: 'Bài tập được giao và kết quả đánh giá sẽ xuất hiện tại đây.' },
];

const teacherSections = [
  { id: 'home', label: 'Trang chủ', icon: FiHome, title: 'Tổ chức việc giảng dạy', description: 'Quản lý khóa học, nội dung và bài tập môn học tại một nơi.', detail: 'Xem tổng quan và chọn công việc bạn muốn tiếp tục.' },
  { id: 'courses', label: 'Khóa học', icon: FiBookOpen, title: 'Quản lý khóa học', description: 'Sắp xếp khóa học, học phần và bài học cho sinh viên.', detail: 'Các khóa học bạn phụ trách sẽ xuất hiện tại đây.' },
  { id: 'content', label: 'Học phần', icon: FiLayers, title: 'Học phần & bài học', description: 'Xây dựng lộ trình học tập rõ ràng cho từng môn.', detail: 'Nội dung học phần và bài học sẽ xuất hiện tại đây.' },
  { id: 'assignments', label: 'Bài tập', icon: FiClipboard, title: 'Quản lý bài tập', description: 'Tạo bài tập môn học và theo dõi kết quả nộp bài.', detail: 'Bài tập đã tạo và bài nộp của sinh viên sẽ xuất hiện tại đây.' },
  { id: 'students', label: 'Sinh viên', icon: FiUsers, title: 'Sinh viên của bạn', description: 'Theo dõi hoạt động học tập của lớp.', detail: 'Danh sách sinh viên trong các khóa học sẽ xuất hiện tại đây.' },
];

function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState(() => new URLSearchParams(window.location.search).get('section') || 'home');
  const isTeacher = ['TEACHER', 'ADMIN'].includes(user?.role?.toUpperCase());
  const openSection = (id) => {
    if (id === 'assignments' && isTeacher) navigate('/teacher/assignments');
    else setActiveId(id);
  };
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
              <p className="dashboard-hero-copy">{isTeacher ? 'Từ khóa học đến bài tập, mọi công việc giảng dạy đều có một nơi rõ ràng để bắt đầu.' : 'Từ khóa học đến bài tập, mọi bước tiến của bạn đều có một nơi rõ ràng để theo dõi.'}</p>
              <button className="dashboard-primary-action" onClick={() => setActiveId('courses')}>Xem khóa học <FiArrowRight aria-hidden="true" /></button>
            </section>
            <section className="dashboard-journey" aria-labelledby="journey-title">
              <div className="dashboard-section-heading"><p>KHÁM PHÁ AMS</p><h2 id="journey-title">{isTeacher ? 'Không gian làm việc của giảng viên' : 'Lộ trình học tập của bạn'}</h2></div>
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
          <section className="dashboard-detail" aria-labelledby="dashboard-detail-title">
            <button className="dashboard-back" onClick={() => setActiveId('home')}>Trang chủ <span aria-hidden="true">/</span> {active.label}</button>
            <div className="dashboard-detail-heading"><span className="dashboard-detail-icon"><active.icon aria-hidden="true" /></span><p>{isTeacher ? 'KHÔNG GIAN GIẢNG DẠY' : 'KHÔNG GIAN HỌC TẬP'}</p><h1 id="dashboard-detail-title">{active.title}</h1><span>{active.description}</span></div>
            <div className="dashboard-empty"><strong>Chưa có nội dung</strong><p>{active.detail}</p></div>
          </section>
        )}
      </main>
    </div>
  );
}

export default DashboardPage;
