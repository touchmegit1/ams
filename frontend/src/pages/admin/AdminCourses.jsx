import { useState, useEffect, useMemo } from 'react';
import {
  FiBookOpen,
  FiCheckCircle,
  FiAlertCircle,
  FiDollarSign,
  FiSearch,
  FiDownload,
  FiPlus,
  FiChevronLeft,
  FiChevronRight,
  FiLayers,
  FiFileText,
  FiTrash2,
  FiX,
  FiPauseCircle
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { getCoursesOverview, updateCourseStatus, createCourse, deleteCourse } from '../../services/adminService.js';
import { formatCoursePrice } from '../course/courseUi.js';

export default function AdminCourses() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'PUBLISHED' | 'ARCHIVED' | 'DRAFT'
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('students');
  const [page, setPage] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCourse, setNewCourse] = useState({
    courseCode: '',
    title: '',
    subject: 'Kỹ thuật Phần mềm',
    targetAudience: 'Học kỳ I · Tín chỉ thực hành AMS',
    price: 10000,
    description: '',
    status: 'PUBLISHED'
  });

  const loadCourses = async () => {
    setLoading(true);
    try {
      const res = await getCoursesOverview();
      setData(res);
    } catch {
      toast.error('Không thể tải danh sách khóa học hệ thống.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const coursesList = useMemo(() => {
    return data?.courses || [];
  }, [data]);

  const summary = useMemo(() => {
    if (data?.summary) return data.summary;
    const total = coursesList.length;
    const open = coursesList.filter((c) => c.status === 'PUBLISHED').length;
    const paused = coursesList.filter((c) => c.status === 'ARCHIVED').length;
    const draft = coursesList.filter((c) => c.status === 'DRAFT').length;
    const paid = coursesList.filter((c) => c.price && Number(c.price) > 0).length;
    return {
      totalCourses: total,
      openCourses: open,
      pausedCourses: paused,
      pendingCourses: draft,
      paidCourses: paid
    };
  }, [data, coursesList]);

  const filteredCourses = useMemo(() => {
    return coursesList.filter((c) => {
      if (activeTab === 'PUBLISHED' && c.status !== 'PUBLISHED') return false;
      if (activeTab === 'ARCHIVED' && c.status !== 'ARCHIVED') return false;
      if (activeTab === 'DRAFT' && c.status !== 'DRAFT') return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const match =
          c.title?.toLowerCase().includes(q) ||
          c.courseCode?.toLowerCase().includes(q) ||
          c.subject?.toLowerCase().includes(q) ||
          c.teacherName?.toLowerCase().includes(q);
        if (!match) return false;
      }

      if (deptFilter !== 'ALL' && !c.subject?.includes(deptFilter)) return false;
      if (typeFilter === 'PAID' && !(c.price && Number(c.price) > 0)) return false;
      if (typeFilter === 'FREE' && c.price && Number(c.price) > 0) return false;

      return true;
    });
  }, [coursesList, activeTab, search, deptFilter, typeFilter]);

  const handleToggleStatus = async (course, newStatus) => {
    try {
      await updateCourseStatus(course.courseId, newStatus);
      const label = newStatus === 'PUBLISHED' ? 'Hoạt động' : newStatus === 'ARCHIVED' ? 'Tạm dừng' : 'Chờ duyệt';
      toast.success(`Đã chuyển trạng thái khóa học sang "${label}".`);
      loadCourses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể cập nhật trạng thái khóa học.');
    }
  };

  const handleDeleteCourse = async (course) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn khóa học "${course.title}"? Mọi nội dung, bài tập và ghi danh liên quan sẽ được dọn dẹp sạch sẽ.`)) return;
    try {
      await deleteCourse(course.courseId);
      toast.success(`Đã xóa khóa học "${course.title}" thành công.`);
      loadCourses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể xóa khóa học.');
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newCourse.courseCode.trim() || !newCourse.title.trim()) {
      toast.warning('Vui lòng điền mã và tên khóa học.');
      return;
    }
    try {
      await createCourse(newCourse);
      toast.success('Đã tạo khóa học mới thành công.');
      setShowCreateModal(false);
      setNewCourse({
        courseCode: '',
        title: '',
        subject: 'Kỹ thuật Phần mềm',
        targetAudience: 'Học kỳ I · Tín chỉ thực hành AMS',
        price: 10000,
        description: '',
        status: 'PUBLISHED'
      });
      loadCourses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể tạo khóa học.');
    }
  };

  const exportCsv = () => {
    const quote = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
    const rows = [
      ['Mã môn', 'Tên khóa học', 'Chuyên ngành', 'Giảng viên', 'Học phần', 'Bài tập', 'Học phí (VND)', 'Trạng thái'],
      ...filteredCourses.map((c) => [
        c.courseCode,
        c.title,
        c.subject,
        c.teacherName,
        c.moduleCount,
        c.assignmentCount,
        c.price,
        c.status === 'PUBLISHED' ? 'Đang hoạt động' : c.status === 'ARCHIVED' ? 'Tạm dừng' : 'Chờ duyệt'
      ])
    ];
    const csvContent = rows.map((r) => r.map(quote).join(',')).join('\r\n');
    const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `danh-sach-khoa-hoc-ams-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="admin-page-view">
      {/* Header Row */}
      <div className="admin-header-row">
        <div>
          <span className="admin-badge-kicker">QUẢN TRỊ ĐÀO TẠO & DUYỆT KHÓA HỌC</span>
          <h1 className="admin-main-title">Khóa học Hệ thống</h1>
          <p className="admin-subtitle">
            Giám sát toàn bộ danh mục khóa học trên toàn trường, phê duyệt xuất bản giáo trình mới, cấu hình học phí và trạng thái mở lớp của giảng viên theo tiêu chuẩn khảo thí AMS.
          </p>
        </div>
        <div className="admin-header-actions">
          <button className="admin-btn-secondary" onClick={exportCsv}>
            <FiDownload /> Xuất báo cáo khóa học
          </button>
          <button className="admin-btn-primary" onClick={() => setShowCreateModal(true)}>
            <FiPlus /> Tạo khóa học mới
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-header">
            <span className="admin-kpi-card-title">Tổng số khóa học</span>
            <span className="admin-kpi-icon-pill icon-book"><FiBookOpen /></span>
          </div>
          <div className="admin-kpi-number">{summary.totalCourses ?? 0}</div>
          <div className="admin-kpi-subtext">
            Phân bổ trên các chuyên ngành
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-card-header">
            <span className="admin-kpi-card-title">Đang mở đăng ký</span>
            <span className="admin-kpi-icon-pill icon-check"><FiCheckCircle /></span>
          </div>
          <div className="admin-kpi-number">{summary.openCourses ?? 0}</div>
          <div className="admin-kpi-subtext trend-positive">
            <span>{summary.totalCourses ? Math.round((summary.openCourses / summary.totalCourses) * 100) : 0}%</span> tổng danh mục đang giảng dạy
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-card-header">
            <span className="admin-kpi-card-title">Đã tạm dừng</span>
            <span className="admin-kpi-icon-pill icon-alert"><FiPauseCircle /></span>
          </div>
          <div className="admin-kpi-number">{summary.pausedCourses ?? 0}</div>
          <div className="admin-kpi-subtext text-warning">
            Khóa học tạm ngưng tuyển sinh
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-card-header">
            <span className="admin-kpi-card-title">Có thu phí (SePay)</span>
            <span className="admin-kpi-icon-pill icon-money"><FiDollarSign /></span>
          </div>
          <div className="admin-kpi-number">{summary.paidCourses ?? 0}</div>
          <div className="admin-kpi-subtext">
            Thanh toán tự động qua VietQR
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs-row">
        <div className="admin-pill-tabs">
          <button
            className={`admin-pill-tab ${activeTab === 'ALL' ? 'active' : ''}`}
            onClick={() => { setActiveTab('ALL'); setPage(0); }}
          >
            Tất cả khóa học <span className="tab-count">{summary.totalCourses ?? 0}</span>
          </button>
          <button
            className={`admin-pill-tab ${activeTab === 'PUBLISHED' ? 'active' : ''}`}
            onClick={() => { setActiveTab('PUBLISHED'); setPage(0); }}
          >
            Đang mở lớp <span className="tab-count">{summary.openCourses ?? 0}</span>
          </button>
          <button
            className={`admin-pill-tab ${activeTab === 'ARCHIVED' ? 'active' : ''}`}
            onClick={() => { setActiveTab('ARCHIVED'); setPage(0); }}
          >
            Tạm dừng / Đóng <span className="tab-count">{summary.pausedCourses ?? 0}</span>
          </button>
          <button
            className={`admin-pill-tab ${activeTab === 'DRAFT' ? 'active' : ''}`}
            onClick={() => { setActiveTab('DRAFT'); setPage(0); }}
          >
            Chờ Admin duyệt <span className="tab-count">{summary.pendingCourses ?? 0}</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="admin-filter-bar">
        <div className="admin-search-box">
          <FiSearch className="search-icon" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên khóa học, mã môn (CS-415, AI...)"
          />
        </div>

        <select
          className="admin-select"
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
        >
          <option value="ALL">Tất cả Chuyên ngành</option>
          <option value="Kỹ thuật Phần mềm">Kỹ thuật Phần mềm</option>
          <option value="Khoa CNTT">Khoa CNTT</option>
          <option value="AI & Data Science">AI & Data Science</option>
          <option value="An toàn Thông tin">An toàn Thông tin</option>
        </select>

        <select
          className="admin-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="ALL">Tất cả loại học</option>
          <option value="PAID">Khóa học có phí (VietQR)</option>
          <option value="FREE">Khóa học miễn phí</option>
        </select>

        <select
          className="admin-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="students">Học viên cao nhất</option>
          <option value="newest">Mới cập nhật</option>
          <option value="price">Học phí cao nhất</option>
        </select>
      </div>

      {/* Course Data Table */}
      <div className="admin-table-container">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th style={{ width: '45%' }}>THÔNG TIN KHÓA HỌC</th>
              <th style={{ width: '25%' }}>GIẢNG VIÊN PHỤ TRÁCH</th>
              <th style={{ width: '15%' }}>CẤU TRÚC NỘI DUNG</th>
              <th style={{ width: '15%', textAlign: 'right' }}>THAO TÁC</th>
            </tr>
          </thead>
          <tbody>
            {filteredCourses.map((c) => {
              const isPublished = c.status === 'PUBLISHED';
              return (
                <tr key={c.courseId}>
                  {/* Column 1: Course Info */}
                  <td>
                    <div className="admin-course-info-cell">
                      <div className="admin-course-thumb">
                        <span className="thumb-icon"><FiBookOpen /></span>
                      </div>
                      <div className="admin-course-details">
                        <div className="admin-course-tags">
                          <span className="course-code-tag">{c.courseCode}</span>
                          {c.status === 'PUBLISHED' && (
                            <span className="course-status-pill status-published">● Hoạt động</span>
                          )}
                          {c.status === 'ARCHIVED' && (
                            <span className="course-status-pill status-archived">⏸ Đã tạm dừng</span>
                          )}
                          {c.status === 'DRAFT' && (
                            <span className="course-status-pill status-draft">⏳ Chờ duyệt</span>
                          )}
                          <span className="course-subject-tag">{c.subject}</span>
                        </div>
                        <strong className="course-title-text">{c.title}</strong>
                        <span className="course-session-text">
                          {c.targetAudience || 'Học kỳ I · Tín chỉ thực hành AMS'}
                          {c.price > 0 && (
                            <span className="course-price-pill"> · {formatCoursePrice(c.price)}</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Column 2: Teacher Info */}
                  <td>
                    <div className="admin-teacher-cell">
                      <div className="admin-avatar-circle teacher-circle">
                        {c.teacherName ? c.teacherName.trim().split(/\s+/).slice(-1)[0][0] : 'T'}
                      </div>
                      <div className="teacher-info">
                        <strong className="teacher-name">{c.teacherName || 'Chưa phân công'}</strong>
                        <span className="teacher-dept">{c.teacherFaculty || 'Khoa CNTT'}</span>
                      </div>
                    </div>
                  </td>

                  {/* Column 3: Content Structure */}
                  <td>
                    <div className="admin-structure-cell">
                      <div className="structure-item">
                        <FiLayers className="struct-icon" />
                        <span>{c.moduleCount || 0} học phần</span>
                      </div>
                      <div className="structure-item">
                        <FiFileText className="struct-icon" />
                        <span>{c.assignmentCount || 0} bài tập nộp</span>
                      </div>
                    </div>
                  </td>

                  {/* Column 4: Actions (Toggle Hoạt động / Tạm dừng & Xóa) */}
                  <td style={{ textAlign: 'right' }}>
                    <div className="admin-row-actions">
                      {isPublished ? (
                        <button
                          className="admin-btn-pause"
                          onClick={() => handleToggleStatus(c, 'ARCHIVED')}
                          title="Bấm để Tạm dừng khóa học"
                        >
                          <FiPauseCircle /> Tạm dừng
                        </button>
                      ) : (
                        <button
                          className="admin-btn-activate"
                          onClick={() => handleToggleStatus(c, 'PUBLISHED')}
                          title="Bấm để Chuyển sang Hoạt động"
                        >
                          <FiCheckCircle /> Hoạt động
                        </button>
                      )}

                      <button
                        className="admin-btn-icon-danger"
                        onClick={() => handleDeleteCourse(c)}
                        title="Xóa khóa học vĩnh viễn"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredCourses.length === 0 && !loading && (
          <div className="admin-empty-state">
            <FiBookOpen className="empty-icon" />
            <p>Không tìm thấy khóa học nào phù hợp với bộ lọc hiện tại.</p>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="admin-pagination-footer">
          <span className="pagination-text">
            Hiển thị 1 - {filteredCourses.length} trong tổng số {summary.totalCourses ?? 0} khóa học hệ thống
          </span>
          <div className="pagination-controls">
            <button className="page-nav-btn" disabled><FiChevronLeft /></button>
            <button className="page-num-btn active">1</button>
            <button className="page-nav-btn"><FiChevronRight /></button>
          </div>
        </div>
      </div>

      {/* Create Course Modal */}
      {showCreateModal && (
        <div className="admin-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Tạo khóa học mới</h3>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleCreateSubmit} className="admin-modal-form">
              <div className="form-row-2">
                <label>
                  <span>Mã khóa học *</span>
                  <input
                    type="text"
                    placeholder="Ví dụ: CS-501"
                    value={newCourse.courseCode}
                    onChange={(e) => setNewCourse({ ...newCourse, courseCode: e.target.value })}
                    required
                  />
                </label>
                <label>
                  <span>Học phí (VNĐ)</span>
                  <input
                    type="number"
                    placeholder="0 nếu miễn phí"
                    value={newCourse.price}
                    onChange={(e) => setNewCourse({ ...newCourse, price: Number(e.target.value) })}
                  />
                </label>
              </div>

              <label>
                <span>Tên khóa học *</span>
                <input
                  type="text"
                  placeholder="Ví dụ: Lập trình Cloud Native & Kubernetes"
                  value={newCourse.title}
                  onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                  required
                />
              </label>

              <div className="form-row-2">
                <label>
                  <span>Chuyên ngành / Khoa</span>
                  <select
                    value={newCourse.subject}
                    onChange={(e) => setNewCourse({ ...newCourse, subject: e.target.value })}
                  >
                    <option value="Kỹ thuật Phần mềm">Kỹ thuật Phần mềm</option>
                    <option value="Khoa CNTT">Khoa CNTT</option>
                    <option value="AI & Data Science">AI & Data Science</option>
                    <option value="An toàn Thông tin">An toàn Thông tin</option>
                    <option value="Hệ thống Thông tin">Hệ thống Thông tin</option>
                  </select>
                </label>

                <label>
                  <span>Trạng thái ban đầu</span>
                  <select
                    value={newCourse.status}
                    onChange={(e) => setNewCourse({ ...newCourse, status: e.target.value })}
                  >
                    <option value="PUBLISHED">Mở đăng ký ngay (Hoạt động)</option>
                    <option value="ARCHIVED">Tạm dừng (Archived)</option>
                    <option value="DRAFT">Chờ kiểm duyệt (Draft)</option>
                  </select>
                </label>
              </div>

              <label>
                <span>Thông tin kỳ học / Đối tượng</span>
                <input
                  type="text"
                  placeholder="Ví dụ: Học kỳ I · Tín chỉ thực hành AMS"
                  value={newCourse.targetAudience}
                  onChange={(e) => setNewCourse({ ...newCourse, targetAudience: e.target.value })}
                />
              </label>

              <label>
                <span>Mô tả ngắn</span>
                <textarea
                  rows="3"
                  placeholder="Mô tả mục tiêu và nội dung cơ bản của môn học..."
                  value={newCourse.description}
                  onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                />
              </label>

              <div className="admin-modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowCreateModal(false)}>Hủy</button>
                <button type="submit" className="btn-submit">Lưu & Tạo khóa học</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
