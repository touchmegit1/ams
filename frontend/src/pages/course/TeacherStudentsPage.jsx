import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  FiUsers,
  FiAlertTriangle,
  FiAward,
  FiCheckCircle,
  FiDownload,
  FiSearch,
  FiChevronRight,
  FiX,
  FiBookOpen,
  FiLayers,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../../services/api.js';
import '../../assets/styles/teacher-portal.css';

export default function TeacherStudentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState(searchParams.get('courseId') || '');
  const [students, setStudents] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentProfile, setStudentProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    let active = true;
    api.get('/courses')
      .then(({ data }) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : [];
        setCourses(list);
        const selectedIsOwned = list.some((course) => String(course.courseId) === String(selectedCourseId));
        if (!selectedIsOwned) {
          const nextCourseId = list[0] ? String(list[0].courseId) : '';
          setSelectedCourseId(nextCourseId);
          if (nextCourseId) setSearchParams({ courseId: nextCourseId }, { replace: true });
          else setSearchParams({}, { replace: true });
        }
      })
      .catch(() => setCourses([]))
      .finally(() => { if (active) setCoursesLoading(false); });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedCourseId) return;
    let active = true;
    setLoading(true);

    Promise.all([
      api.get(`/courses/${selectedCourseId}/students`).catch(() => ({ data: [] })),
      api.get(`/courses/${selectedCourseId}/analytics`).catch(() => ({ data: null })),
    ]).then(([rosterRes, analyticsRes]) => {
      if (!active) return;
      setStudents(Array.isArray(rosterRes.data) ? rosterRes.data : []);
      setAnalytics(analyticsRes.data);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [selectedCourseId]);

  const currentCourse = courses.find((course) => String(course.courseId) === String(selectedCourseId));

  const visibleStudents = useMemo(() => {
    return students.filter((s) => {
      const q = search.trim().toLowerCase();
      const matchSearch = !q || `${s.fullName} ${s.email} ${s.studentCode || ''}`.toLowerCase().includes(q);
      const matchStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'OVERDUE'
          ? (s.overdueAssignments || 0) > 0
          : s.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [students, search, statusFilter]);

  const openProfile = async (student) => {
    setSelectedStudent(student);
    setStudentProfile(null);
    setProfileLoading(true);
    try {
      const { data } = await api.get(`/courses/${selectedCourseId}/students/${student.studentId}`);
      setStudentProfile(data);
    } catch {
      setStudentProfile(student);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleExportCSV = async () => {
    if (!selectedCourseId) return;
    try {
      const { data } = await api.get(`/courses/${selectedCourseId}/students/export.csv`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentCourse.courseCode || 'course'}-students.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Đã tải bảng điểm lớp CSV');
    } catch {
      toast.error('Không thể xuất danh sách sinh viên.');
    }
  };

  const activeStudentCount = analytics?.activeStudents ?? students.filter((student) => student.status === 'ACTIVE').length;
  const overdueCount = analytics?.studentsWithOverdueAssignments ?? students.filter((student) => (student.overdueAssignments || 0) > 0).length;
  const scoredStudents = students.filter((student) => student.averageScorePercent != null);
  const avgGrade = scoredStudents.length > 0
    ? `${Math.round(scoredStudents.reduce((sum, student) => sum + Number(student.averageScorePercent), 0) / scoredStudents.length)}%`
    : '—';
  const completionRate = analytics?.averageProgressPercent != null ? `${analytics.averageProgressPercent}%` : '—';

  if (coursesLoading) return <div className="tp-panel" role="status">Đang tải các khóa học bạn phụ trách…</div>;
  if (!currentCourse) return (
    <div className="tp-panel" role="status">
      <h2>Bạn chưa có khóa học được giao</h2>
      <p>Danh sách sinh viên chỉ hiển thị trong các khóa học bạn phụ trách.</p>
      <button className="tp-btn tp-btn-primary" onClick={() => navigate('/courses?action=create')}>Tạo khóa học</button>
    </div>
  );

  return (
    <div>
      {/* Breadcrumb matching Screen 4 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#62756b', marginBottom: '14px' }}>
        <Link to="/courses" style={{ color: '#1e4a37', textDecoration: 'none', fontWeight: 600 }}>Khóa học</Link>
        <span>/</span>
        <span>{currentCourse.courseCode || 'Khóa học'} - {currentCourse.title}</span>
        <span>/</span>
        <strong style={{ color: '#16261f' }}>Danh sách sinh viên</strong>
      </div>

      {/* Header section matching Screen 4 */}
      <div className="tp-section-header" style={{ marginBottom: '22px' }}>
        <div>
          <h1 className="tp-section-title" style={{ fontSize: '26px' }}>
            Quản lý Sinh viên & Lớp học
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
            <span className="tp-code-badge">
              Khóa học: {currentCourse.courseCode || '—'}
            </span>
            <span className="tp-tag" style={{ background: '#f0f5f2', color: '#335041' }}>
              Đang học: {activeStudentCount} SV
            </span>
            <span className="tp-tag" style={{ background: '#f0f5f2', color: '#335041' }}>
              Môn học: {currentCourse.subject || '—'}
            </span>
            <span className="tp-tag tp-tag-published">
              Tiến độ lớp: {completionRate}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="tp-btn tp-btn-outline" onClick={handleExportCSV}>
            <FiDownload /> Bảng điểm excel (.csv)
          </button>
        </div>
      </div>

      {/* Course Selector Dropdown if multiple */}
      {courses.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#16261f' }}>Chọn lớp học phần:</span>
          <select
            className="tp-filter-select"
            value={selectedCourseId}
            onChange={(e) => {
              setSelectedCourseId(e.target.value);
              setSearchParams({ courseId: e.target.value });
            }}
          >
            {courses.map((c) => (
              <option key={c.courseId} value={c.courseId}>
                {c.courseCode ? `[${c.courseCode}] ` : ''}
                {c.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 4 KPI cards matching Screen 4 */}
      <section className="tp-kpi-grid">
        <div className="tp-kpi-card">
          <div className="tp-kpi-card-header">
            <span className="tp-kpi-label">Sĩ số sinh viên hoạt động</span>
            <div className="tp-kpi-icon">
              <FiUsers />
            </div>
          </div>
          <div className="tp-kpi-value-row">
            <span className="tp-kpi-number">{activeStudentCount}</span>
            <span className="tp-kpi-unit">SV</span>
          </div>
          <div className="tp-kpi-footer is-good">
            <span>Sinh viên có ghi danh đang hoạt động</span>
          </div>
        </div>

        <div className="tp-kpi-card">
          <div className="tp-kpi-card-header">
            <span className="tp-kpi-label">Cảnh báo trễ hạn / Vắng</span>
            <div className="tp-kpi-icon">
              <FiAlertTriangle />
            </div>
          </div>
          <div className="tp-kpi-value-row">
            <span className="tp-kpi-number">{overdueCount}</span>
            <span className="tp-kpi-unit">sinh viên</span>
          </div>
          <div className="tp-kpi-footer is-warning">
            <span>Sinh viên còn bài tập quá hạn</span>
          </div>
        </div>

        <div className="tp-kpi-card">
          <div className="tp-kpi-card-header">
            <span className="tp-kpi-label">Điểm TB bài đã chấm</span>
            <div className="tp-kpi-icon">
              <FiAward />
            </div>
          </div>
          <div className="tp-kpi-value-row">
            <span className="tp-kpi-number">{avgGrade}</span>
            <span className="tp-kpi-unit">%</span>
          </div>
          <div className="tp-kpi-footer is-good">
            <span>Điểm các lần nộp mới nhất đã chấm</span>
          </div>
        </div>

        <div className="tp-kpi-card">
          <div className="tp-kpi-card-header">
            <span className="tp-kpi-label">Tỷ lệ hoàn thành bài học</span>
            <div className="tp-kpi-icon">
              <FiCheckCircle />
            </div>
          </div>
          <div className="tp-kpi-value-row">
            <span className="tp-kpi-number">{completionRate}</span>
          </div>
          <div className="tp-kpi-footer is-good">
            <span>Tiến độ lesson và assignment bình quân</span>
          </div>
        </div>
      </section>

      {/* Toolbar filters */}
      <section className="tp-toolbar">
        <div className="tp-toolbar-left">
          <div className="tp-search-box" style={{ minWidth: '320px' }}>
            <FiSearch />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên, MSSV, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="tp-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang học (ACTIVE)</option>
            <option value="PENDING">Chờ thanh toán (PENDING)</option>
            <option value="OVERDUE">Cảnh báo trễ hạn</option>
          </select>

          {search && (
            <button className="tp-btn tp-btn-sm tp-btn-outline" onClick={() => setSearch('')}>
              Đặt lại
            </button>
          )}
        </div>
      </section>

      {/* Student Roster Table matching Screen 4 */}
      <section className="tp-table-wrap">
        {loading ? (
          <div style={{ padding: '36px', textAlign: 'center', color: '#62756b' }}>
            Đang tải danh sách sinh viên…
          </div>
        ) : visibleStudents.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>Không tìm thấy sinh viên</h3>
            <p style={{ color: '#62756b' }}>Không có sinh viên nào phù hợp với bộ lọc hiện tại.</p>
          </div>
        ) : (
          <table className="tp-table">
            <thead>
              <tr>
                <th style={{ width: '4%' }}>
                  <input type="checkbox" aria-label="Chọn tất cả" />
                </th>
                <th style={{ width: '30%' }}>HỌC VIÊN / MSSV / EMAIL</th>
                <th style={{ width: '15%' }}>GHI DANH</th>
                <th style={{ width: '20%' }}>BÀI TẬP ĐÃ NỘP</th>
                <th style={{ width: '12%' }}>ĐIỂM TB</th>
                <th style={{ width: '12%' }}>TIẾN TRÌNH</th>
                <th style={{ width: '7%', textAlign: 'right' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {visibleStudents.map((s, idx) => {
                const initials = (s.fullName || 'SV')
                  .split(' ')
                  .map((n) => n[0])
                  .slice(-2)
                  .join('')
                  .toUpperCase();
                const totalAssn = s.requiredAssignments ?? 0;
                const submittedAssn = s.completedAssignments ?? 0;
                const assnPct = s.assignmentProgressPercent ?? 0;
                const grade = s.averageScorePercent != null ? `${Math.round(Number(s.averageScorePercent))}%` : '—';
                const isOverdue = (s.overdueAssignments ?? 0) > 0;

                return (
                  <tr key={s.studentId || idx}>
                    <td>
                      <input type="checkbox" aria-label={`Chọn ${s.fullName}`} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="tp-queue-avatar" style={{ width: '34px', height: '34px', fontSize: '12px' }}>
                          {initials}
                        </div>
                        <div>
                          <strong style={{ fontSize: '13.5px', color: '#16261f' }}>{s.fullName}</strong>
                          <div style={{ fontSize: '11px', color: '#62756b' }}>{s.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="tp-code-badge" style={{ background: '#f2f6f4', color: '#274b3a', borderColor: '#d7e4dc' }}>
                        {s.status === 'ACTIVE' ? 'Đang học' : s.status === 'PENDING' ? 'Chờ thanh toán' : s.status}
                      </span>
                    </td>
                    <td>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '3px' }}>
                          <span>{submittedAssn}/{totalAssn} bài</span>
                          <strong>{assnPct}%</strong>
                        </div>
                        <div className="tp-progress-bar" style={{ height: '5px' }}>
                          <div
                            className="tp-progress-fill"
                            style={{
                              width: `${assnPct}%`,
                              background: assnPct >= 75 ? '#2dc48d' : assnPct >= 40 ? '#e07a22' : '#d9383a',
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: '13.5px',
                          color: grade >= 8.0 ? '#1e875a' : grade >= 6.5 ? '#1e4a37' : '#d9383a',
                        }}
                      >
                        {grade}
                      </span>
                    </td>
                    <td>
                      {s.status !== 'ACTIVE' ? (
                        <span className="tp-tag tp-tag-draft">Chờ thanh toán</span>
                      ) : isOverdue ? (
                        <span className="tp-queue-tag is-late">
                          Trễ {s.overdueAssignments} bài
                        </span>
                      ) : (
                        <span>{s.overallProgressPercent ?? 0}% tổng tiến độ</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="tp-btn tp-btn-sm tp-btn-outline"
                        onClick={() => openProfile(s)}
                      >
                        Chi tiết <FiChevronRight />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div style={{ padding: '14px 20px', borderTop: '1px solid #edf3f0', fontSize: '12px', color: '#62756b' }}>
          <span>Hiển thị {visibleStudents.length} / {students.length} sinh viên</span>
        </div>
      </section>

      {/* Student Profile Drawer / Modal */}
      {selectedStudent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10, 28, 20, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 1000,
          }}
          onClick={() => setSelectedStudent(null)}
        >
          <div
            style={{
              background: '#ffffff',
              width: '100%',
              maxWidth: '520px',
              height: '100vh',
              overflowY: 'auto',
              padding: '30px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#16261f' }}>Hồ sơ học tập sinh viên</h2>
                <p style={{ fontSize: '13px', color: '#62756b', marginTop: '2px' }}>
                  {selectedStudent.fullName} • {selectedStudent.email}
                </p>
              </div>
              <button
                type="button"
                className="tp-btn tp-btn-sm tp-btn-outline"
                onClick={() => setSelectedStudent(null)}
              >
                <FiX />
              </button>
            </div>

            {profileLoading ? (
              <div style={{ padding: '36px', textAlign: 'center', color: '#62756b' }}>Đang tải chi tiết học tập…</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <div style={{ background: '#f5faf7', border: '1px solid #dce8e0', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#62756b' }}>Tiến độ bài học</div>
                    <strong style={{ fontSize: '17px', color: '#1e4a37' }}>
                      {studentProfile?.lessonProgressPercent ?? selectedStudent.lessonProgressPercent ?? 0}%
                    </strong>
                  </div>
                  <div style={{ background: '#f5faf7', border: '1px solid #dce8e0', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#62756b' }}>Tiến độ bài tập</div>
                    <strong style={{ fontSize: '17px', color: '#1e4a37' }}>
                      {studentProfile?.assignmentProgressPercent ?? selectedStudent.assignmentProgressPercent ?? 0}%
                    </strong>
                  </div>
                  <div style={{ background: '#f5faf7', border: '1px solid #dce8e0', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#62756b' }}>Điểm TB khóa</div>
                    <strong style={{ fontSize: '17px', color: '#2dc48d' }}>
                      {studentProfile?.averageScorePercent != null ? `${Math.round(Number(studentProfile.averageScorePercent))}%` : '--'}
                    </strong>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: '14.5px', fontWeight: 800, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FiLayers /> Chi tiết bài tập & Điểm số
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {studentProfile?.assignments && studentProfile.assignments.length > 0 ? (
                      studentProfile.assignments.map((a) => (
                        <div
                          key={a.assignmentId}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 14px',
                            background: '#f8faf9',
                            border: '1px solid #e7ede9',
                            borderRadius: '8px',
                          }}
                        >
                          <div>
                            <strong style={{ fontSize: '13px', color: '#16261f' }}>{a.title}</strong>
                            <div style={{ fontSize: '11px', color: '#62756b', marginTop: '2px' }}>
                              {a.lastSubmittedAt ? `Nộp gần nhất: ${new Date(a.lastSubmittedAt).toLocaleDateString('vi-VN')}` : a.status === 'OVERDUE' ? 'Quá hạn, chưa nộp' : 'Chưa nộp bài'}
                            </div>
                          </div>
                          <div>
                            {a.score != null ? (
                              <span style={{ fontWeight: 800, color: '#1e875a' }}>{a.score} / {a.maxScore ?? '—'}</span>
                            ) : a.status === 'SUBMITTED' ? (
                              <span className="tp-tag tp-tag-draft">Chờ chấm</span>
                            ) : (
                              <span className="tp-tag" style={{ background: '#fdf0f0', color: '#d9383a' }}>{a.status === 'OVERDUE' ? 'Quá hạn' : 'Chưa nộp'}</span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p style={{ fontSize: '12px', color: '#62756b' }}>Chưa có bài tập nào được ghi nhận.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: '14.5px', fontWeight: 800, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FiBookOpen /> Tiến độ hoàn thành bài học
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {studentProfile?.lessons && studentProfile.lessons.length > 0 ? (
                      studentProfile.lessons.map((l) => (
                        <div
                          key={l.lessonId}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 14px',
                            background: '#f8faf9',
                            border: '1px solid #e7ede9',
                            borderRadius: '8px',
                          }}
                        >
                          <span style={{ fontSize: '13px', color: '#16261f' }}>{l.title}</span>
                          {l.completed ? (
                            <span className="tp-queue-tag is-ontime">Đã hoàn thành</span>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#889990' }}>Chưa học</span>
                          )}
                        </div>
                      ))
                    ) : (
                      <p style={{ fontSize: '12px', color: '#62756b' }}>Chưa có dữ liệu bài học.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
              <button className="tp-btn tp-btn-outline" style={{ width: '100%' }} onClick={() => setSelectedStudent(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Modal */}
      {showNotifyModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10, 28, 20, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setShowNotifyModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '580px',
              width: '100%',
              padding: '28px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '19px', fontWeight: 800 }}>Gửi thông báo đến cả lớp</h3>
              <button
                type="button"
                className="tp-btn tp-btn-sm tp-btn-outline"
                onClick={() => setShowNotifyModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSendNotice}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 650, display: 'block', marginBottom: '6px' }}>
                  Nội dung thông báo (Email & Thông báo đẩy):
                </label>
                <textarea
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #dce7e1',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                  }}
                  rows={4}
                  placeholder="Nhập nội dung nhắc nhở bài tập, hạn nộp hoặc tài liệu học tập..."
                  value={noticeMessage}
                  onChange={(e) => setNoticeMessage(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="tp-btn tp-btn-outline"
                  onClick={() => setShowNotifyModal(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="tp-btn tp-btn-primary">
                  Gửi ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
