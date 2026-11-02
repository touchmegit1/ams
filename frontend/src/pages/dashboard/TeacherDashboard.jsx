import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiBookOpen,
  FiUsers,
  FiCheckSquare,
  FiClock,
  FiPlus,
  FiDownload,
  FiZap,
  FiArrowRight,
  FiAlertTriangle,
  FiCalendar,
  FiSettings,
  FiFileText,
  FiSliders,
  FiBarChart2,
  FiCheck,
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../services/api.js';
import { courseStatusLabel } from '../course/courseUi.js';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [overview, setOverview] = useState(null);
  const [courses, setCourses] = useState([]);
  const [courseFilter, setCourseFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.allSettled([api.get('/teacher/overview'), api.get('/courses')]).then(([overviewResult, coursesResult]) => {
      if (!active) return;
      if (overviewResult.status === 'fulfilled') setOverview(overviewResult.value.data);
      if (coursesResult.status === 'fulfilled' && Array.isArray(coursesResult.value.data)) setCourses(coursesResult.value.data);
      else setLoadError('Không tải được danh sách khóa học của bạn. Vui lòng thử tải lại.');
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const displayName = user?.fullName || 'Giảng viên';
  const displayCourses = courses;

  const filteredCourses = displayCourses.filter((c) => {
    if (courseFilter === 'PUBLISHED') return c.status === 'PUBLISHED';
    if (courseFilter === 'DRAFT') return c.status === 'DRAFT';
    return true;
  });

  const kpis = [
    {
      label: 'Khóa học của tôi',
      val: courses.length,
      unit: 'khóa',
      sub: `${overview?.publishedCourses ?? courses.filter((c) => c.status === 'PUBLISHED').length} khóa đang mở`,
      isGood: true,
      icon: FiBookOpen,
      link: '/courses',
    },
    {
      label: 'Tổng sinh viên theo học',
      val: overview?.activeStudents ?? 0,
      unit: 'sinh viên',
      sub: `${overview?.studentsWithOverdueAssignments ?? 0} sinh viên có bài quá hạn`,
      isGood: true,
      icon: FiUsers,
      link: '/teacher/students',
    },
    {
      label: 'Cần chấm / Duyệt điểm',
      val: overview?.submissionsToReview ?? 0,
      unit: 'bài nộp',
      sub: 'Bài nộp đang chờ giảng viên duyệt',
      isWarning: true,
      icon: FiClock,
      link: '/teacher/assignments?tab=grading',
    },
    {
      label: 'Bài tập sắp đến hạn',
      val: overview?.upcomingAssignments ?? 0,
      unit: 'bài tập',
      sub: 'Hạn nộp trong 7 ngày tới',
      icon: FiCalendar,
      link: '/teacher/assignments',
    },
  ];

  const pendingQueue = overview?.recentPendingSubmissions || [];

  const handleExportExcel = () => {
    const header = 'Mã khóa học,Tên khóa học,Môn học,Trạng thái,Học phí\n';
    const rows = displayCourses
      .map(
        (c) =>
          `"${c.courseCode || ''}","${c.title}","${c.subject || ''}","${c.status}","${c.price ?? 0}"`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `AMS_GiangVien_DanhSachKhoaHoc_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      {/* Hero Banner (Screen 1) */}
      <section className="tp-hero-banner">
        <div>
          <div className="tp-hero-eyebrow">
            <span>HỆ THỐNG QUẢN LÝ ĐÀO TẠO</span>
            <span>•</span>
            <span>Khoa Công nghệ Thông tin</span>
          </div>
          <h1 className="tp-hero-title">
            Xin chào, {displayName} 👋
          </h1>
          <p className="tp-hero-subtitle">
            {loading ? 'Đang tải dữ liệu giảng dạy…' : `${courses.length} khóa học do bạn phụ trách • ${overview?.activeStudents ?? 0} sinh viên đang học`}
          </p>
        </div>

        <div className="tp-hero-actions">
          <button
            className="tp-btn tp-btn-white"
            onClick={() => navigate('/courses?action=create')}
          >
            <FiPlus /> Tạo khóa học mới
          </button>
          <button
            className="tp-btn tp-btn-glass"
            onClick={handleExportExcel}
          >
            <FiDownload /> Xuất kết quả excel
          </button>
          <button
            className="tp-btn tp-btn-mint"
            onClick={() => navigate('/teacher/assignments?tab=grading')}
          >
            <FiZap /> Chấm bài nhanh
          </button>
        </div>
      </section>

      {/* 4 KPI Summary Cards */}
      <section className="tp-kpi-grid">
        {kpis.map((k, idx) => {
          const Icon = k.icon;
          return (
            <div
              key={idx}
              className={`tp-kpi-card ${k.isWarning ? 'is-warning' : k.isGood ? 'is-highlight' : ''}`}
              onClick={() => navigate(k.link)}
              role="button"
              tabIndex={0}
            >
              <div className="tp-kpi-card-header">
                <span className="tp-kpi-label">{k.label}</span>
                <div className="tp-kpi-icon">
                  <Icon />
                </div>
              </div>
              <div className="tp-kpi-value-row">
                <span className="tp-kpi-number">{k.val}</span>
                {k.unit && <span className="tp-kpi-unit">{k.unit}</span>}
              </div>
              <div className={`tp-kpi-footer ${k.isWarning ? 'is-warning' : k.isGood ? 'is-good' : ''}`}>
                {k.isWarning && <FiAlertTriangle />}
                <span>{k.sub}</span>
              </div>
            </div>
          );
        })}
      </section>

      {loadError && <div className="tp-panel" role="alert">{loadError}</div>}

      {/* Khóa học do giảng viên hiện tại phụ trách */}
      <section className="tp-courses-section">
        <div className="tp-section-header">
          <div>
            <h2 className="tp-section-title">Khóa học của tôi</h2>
            <p style={{ fontSize: '13px', color: '#62756b', marginTop: '4px' }}>
              Chỉ các khóa học do bạn tạo và phụ trách được hiển thị tại đây.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="tp-filter-tabs">
              <button
                className={`tp-filter-tab ${courseFilter === 'ALL' ? 'is-active' : ''}`}
                onClick={() => setCourseFilter('ALL')}
              >
                Tất cả ({displayCourses.length})
              </button>
              <button
                className={`tp-filter-tab ${courseFilter === 'PUBLISHED' ? 'is-active' : ''}`}
                onClick={() => setCourseFilter('PUBLISHED')}
              >
                Đang mở ({displayCourses.filter((c) => c.status === 'PUBLISHED').length})
              </button>
              <button
                className={`tp-filter-tab ${courseFilter === 'DRAFT' ? 'is-active' : ''}`}
                onClick={() => setCourseFilter('DRAFT')}
              >
                Bản nháp ({displayCourses.filter((c) => c.status === 'DRAFT').length})
              </button>
            </div>
            <Link to="/courses" className="tp-section-link">
              Xem tất cả môn <FiArrowRight />
            </Link>
          </div>
        </div>

        <div className="tp-courses-grid">
          {filteredCourses.slice(0, 3).map((c) => {
            const courseId = c.courseId;
            return (
              <div key={courseId} className="tp-course-card">
                <div className="tp-course-banner">
                  <div className="tp-course-badge-row">
                    <span className="tp-course-dept">{c.courseCode || 'Chưa có mã'}</span>
                    <span
                      className={`tp-tag ${c.status === 'PUBLISHED' ? 'tp-tag-published' : c.status === 'DRAFT' ? 'tp-tag-draft' : 'tp-tag-closed'}`}
                    >
                      {courseStatusLabel[c.status] || c.status}
                    </span>
                  </div>
                  <h3 className="tp-course-title-overlay">{c.title}</h3>
                </div>

                <div className="tp-course-body">
                  <div className="tp-course-stats-row">
                    <div className="tp-course-stat-col">
                      <span className="tp-course-stat-val">{c.subject || '—'}</span>
                      <span className="tp-course-stat-lbl">Môn học</span>
                    </div>
                    <div className="tp-course-stat-col">
                      <span className="tp-course-stat-val">{Number(c.price) > 0 ? `${Number(c.price).toLocaleString('vi-VN')} đ` : 'Miễn phí'}</span>
                      <span className="tp-course-stat-lbl">Học phí</span>
                    </div>
                    <div className="tp-course-stat-col">
                      <span className="tp-course-stat-val">{c.createdAt ? new Date(c.createdAt).toLocaleDateString('vi-VN') : '—'}</span>
                      <span className="tp-course-stat-lbl">Ngày tạo</span>
                    </div>
                  </div>

                  <div className="tp-course-actions">
                    <button
                      className="tp-btn tp-btn-primary"
                      style={{ flex: 1 }}
                      onClick={() => navigate(`/courses/${courseId}`)}
                    >
                      Vào lớp học
                    </button>
                    <button
                      className="tp-btn tp-btn-outline"
                      title="Lịch trình học"
                      onClick={() => navigate(`/courses/${courseId}`)}
                    >
                      <FiCalendar />
                    </button>
                    <button
                      className="tp-btn tp-btn-outline"
                      title="Danh sách sinh viên"
                      onClick={() => navigate(`/teacher/students?courseId=${courseId}`)}
                    >
                      <FiUsers />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {!loading && !loadError && filteredCourses.length === 0 && (
            <div className="tp-panel" role="status">
              <strong>{courses.length === 0 ? 'Bạn chưa tạo khóa học nào' : 'Không có khóa học ở trạng thái này'}</strong>
              <p>{courses.length === 0 ? 'Tạo khóa học đầu tiên để bắt đầu quản lý học viên và bài tập.' : 'Chọn bộ lọc khác để xem khóa học của bạn.'}</p>
              {courses.length === 0 && <button className="tp-btn tp-btn-primary" onClick={() => navigate('/courses?action=create')}><FiPlus /> Tạo khóa học</button>}
            </div>
          )}
        </div>
      </section>

      {/* Bottom 2-Column Grid */}
      <section className="tp-bottom-grid">
        {/* Assignment review queue for the teacher's courses */}
        <div className="tp-panel">
          <div className="tp-panel-header">
            <div className="tp-panel-title-group">
              <div className="tp-panel-icon">
                <FiFileText />
              </div>
              <div>
                <h3 className="tp-panel-title">Bài nộp cần duyệt</h3>
                <p className="tp-panel-sub">{overview?.submissionsToReview ?? 0} bài trong các khóa học bạn phụ trách đang chờ đánh giá</p>
              </div>
            </div>
            <span className="tp-tag tp-tag-draft">
              {overview?.studentsWithOverdueAssignments ?? 0} SV quá hạn
            </span>
          </div>

          <div className="tp-queue-list">
            {pendingQueue.length > 0 ? pendingQueue.map((item) => (
              <div key={item.submissionId} className="tp-queue-item">
                <div className="tp-queue-student">
                  <div className="tp-queue-avatar">{(item.studentName || 'SV').split(' ').map((part) => part[0]).slice(-2).join('').toUpperCase()}</div>
                  <div className="tp-queue-info">
                    <span className="tp-queue-name">{item.studentName}</span>
                    <span className="tp-queue-meta">{item.courseTitle} • {item.assignmentTitle} · {item.studentEmail}</span>
                  </div>
                </div>
                <button className="tp-btn tp-btn-sm tp-btn-primary" onClick={() => navigate(`/teacher/assignments/${item.assignmentId}`)}>
                  <FiCheckSquare /> Xem bài nộp
                </button>
              </div>
            )) : <p role="status">Chưa có bài nộp đang chờ duyệt trong các khóa học của bạn.</p>}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '16px',
              paddingTop: '14px',
              borderTop: '1px solid #edf3f0',
              fontSize: '12px',
              color: '#62756b',
            }}
          >
            <span>
              Tổng số bài cần duyệt: {overview?.submissionsToReview ?? 0}
            </span>
            <Link to="/teacher/assignments?tab=grading" className="tp-section-link">
              Xem tất cả danh sách <FiArrowRight />
            </Link>
          </div>
        </div>

        {/* Right column: Lịch trình & Lối tắt */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Upcoming assignment summary */}
          <div className="tp-panel">
            <div className="tp-panel-header">
              <div className="tp-panel-title-group">
                <div className="tp-panel-icon">
                  <FiCalendar />
                </div>
                <div>
                  <h4 className="tp-panel-title">Bài tập sắp đến hạn</h4>
                  <span className="tp-panel-sub">Trong các khóa học bạn phụ trách</span>
                </div>
              </div>
            </div>

            <div className="tp-timeline-list">
              <p><strong>{overview?.upcomingAssignments ?? 0}</strong> bài tập có hạn nộp trong 7 ngày tới.</p>
              <button className="tp-btn tp-btn-outline" onClick={() => navigate('/teacher/assignments')}>Xem bài tập của tôi</button>
            </div>
          </div>

          {/* Lối tắt giảng dạy */}
          <div className="tp-panel">
            <div className="tp-panel-header">
              <div className="tp-panel-title-group">
                <div className="tp-panel-icon">
                  <FiZap />
                </div>
                <div>
                  <h4 className="tp-panel-title">Lối tắt giảng dạy</h4>
                  <span className="tp-panel-sub">Công cụ soạn thảo & chuẩn hóa</span>
                </div>
              </div>
            </div>

            <div className="tp-shortcuts-grid">
              <Link to="/teacher/assignment-templates" className="tp-shortcut-link">
                <div>
                  <div style={{ fontWeight: 700 }}>Thư viện mẫu bài tập</div>
                  <div style={{ fontSize: '11px', color: '#62756b' }}>Kho bài Lab/Quiz & Rubric chuẩn</div>
                </div>
                <FiArrowRight style={{ color: '#7a9688' }} />
              </Link>

              <Link to="/teacher/assignments/new" className="tp-shortcut-link">
                <div>
                  <div style={{ fontWeight: 700 }}>Cấu hình bài thi tự động</div>
                  <div style={{ fontSize: '11px', color: '#62756b' }}>Hạ tầng chấm điểm theo Test Runner</div>
                </div>
                <FiArrowRight style={{ color: '#7a9688' }} />
              </Link>

              <div
                className="tp-shortcut-link"
                style={{ cursor: 'pointer' }}
                onClick={handleExportExcel}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>Báo cáo phổ điểm & Phân tích</div>
                  <div style={{ fontSize: '11px', color: '#62756b' }}>Xuất file Excel / CSV hội đồng khoa</div>
                </div>
                <FiArrowRight style={{ color: '#7a9688' }} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
