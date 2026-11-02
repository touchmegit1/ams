import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiBookOpen,
  FiUsers,
  FiFileText,
  FiCheckCircle,
  FiDownload,
  FiPlus,
  FiSearch,
  FiEdit2,
  FiTrash2,
} from 'react-icons/fi';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import CourseForm from '../../components/course/CourseForm.jsx';
import { courseStatusLabel, formatCoursePrice } from './courseUi.js';
import '../../assets/styles/teacher-portal.css';

const errorMessage = (error) => error.response?.data?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.';

export default function CourseManagementPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [courses, setCourses] = useState([]);
  const [structures, setStructures] = useState({});
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(() =>
    ['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(searchParams.get('status')) ? searchParams.get('status') : 'ALL'
  );
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [pageSize, setPageSize] = useState(8);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingCourse, setEditingCourse] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [resCourses, resOverview] = await Promise.all([
        api.get('/courses'),
        api.get('/teacher/overview').catch(() => ({ data: null })),
      ]);
      const courseList = Array.isArray(resCourses.data) ? resCourses.data : [];
      setCourses(courseList);
      if (resOverview.data) setOverview(resOverview.data);

      const structureEntries = await Promise.all(
        courseList.map(async (course) => {
          try {
            const { data } = await api.get(`/courses/${course.courseId}/modules`);
            const modules = Array.isArray(data) ? data : [];
            return [
              course.courseId,
              {
                modules: modules.length,
                lessons: modules.reduce((sum, module) => sum + (module.lessons?.length || 0), 0),
              },
            ];
          } catch {
            return [course.courseId, { modules: null, lessons: null }];
          }
        })
      );
      setStructures(Object.fromEntries(structureEntries));
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    const status = searchParams.get('status');
    if (['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status)) {
      setStatusFilter(status);
    }
    if (searchParams.get('action') === 'create' || searchParams.get('create') === 'true') {
      setEditingCourse(null);
      setSubmitError('');
      setShowForm(true);
    }
  }, [searchParams]);

  const visibleCourses = useMemo(() => {
    return courses.filter((course) => {
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        [course.courseCode, course.title, course.subject, course.description].some((value) =>
          value?.toLowerCase().includes(query)
        );
      return (
        matchesSearch &&
        (statusFilter === 'ALL' || course.status === statusFilter) &&
        (subjectFilter === 'ALL' || course.subject === subjectFilter)
      );
    });
  }, [courses, search, statusFilter, subjectFilter]);

  const subjects = useMemo(() => [...new Set(courses.map((c) => c.subject).filter(Boolean))].sort(), [courses]);
  const totalPages = Math.max(1, Math.ceil(visibleCourses.length / pageSize));
  const pageCourses = useMemo(
    () => visibleCourses.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [visibleCourses, currentPage, pageSize]
  );

  const openCreate = () => {
    setEditingCourse(null);
    setSubmitError('');
    setShowForm(true);
  };

  const openEdit = (course) => {
    setEditingCourse(course);
    setSubmitError('');
    setShowForm(true);
  };

  const saveCourse = async (payload) => {
    setSaving(true);
    setSubmitError('');
    try {
      if (editingCourse) await api.put(`/courses/${editingCourse.courseId}`, payload);
      else await api.post('/courses', payload);
      setShowForm(false);
      await loadCourses();
      toast.success(editingCourse ? 'Đã cập nhật khóa học' : 'Đã tạo khóa học mới');
    } catch (error) {
      const message = error.response?.data?.message || 'Không thể lưu khóa học';
      setSubmitError(message);
    } finally {
      setSaving(false);
    }
  };

  const deleteCourse = async (course) => {
    if (!window.confirm(`Xóa khóa học “${course.title}” cùng toàn bộ học phần và bài học?`)) return;
    try {
      await api.delete(`/courses/${course.courseId}`);
      setCourses((current) => current.filter((item) => item.courseId !== course.courseId));
      toast.success('Đã xóa khóa học thành công');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const handleExportCourses = () => {
    const header = 'Mã khóa học,Tên khóa học,Môn học,Trạng thái,Số học phần,Số bài học,Học phí\n';
    const rows = visibleCourses
      .map(
        (c) =>
          `"${c.courseCode || ''}","${c.title}","${c.subject || ''}","${c.status}","${
            structures[c.courseId]?.modules || 0
          }","${structures[c.courseId]?.lessons || 0}","${c.price || 0}"`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AMS_DanhSachKhoaHoc_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Đã xuất danh sách khóa học CSV');
  };

  const totalCoursesCount = courses.length;
  const activeCoursesCount = courses.filter((c) => c.status === 'PUBLISHED').length;
  const totalStudents = overview?.activeStudents ?? 0;
  const submissionsToReview = overview?.submissionsToReview ?? 0;
  const completionRate = overview?.averageProgressPercent != null ? `${overview.averageProgressPercent}%` : '—';

  return (
    <div>
      {/* Top Header matching Screen 3 */}
      <div className="tp-section-header" style={{ marginBottom: '22px' }}>
        <div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#2dc48d', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            AMS • CÁC KHÓA HỌC BẠN PHỤ TRÁCH
          </span>
          <h1 className="tp-section-title" style={{ fontSize: '26px', marginTop: '4px' }}>
            Quản lý khóa học của tôi
          </h1>
          <p style={{ fontSize: '13.5px', color: '#62756b', marginTop: '4px', maxWidth: '820px' }}>
            Tạo và quản lý khóa học do bạn phụ trách, sắp xếp module, lesson và theo dõi sinh viên đã ghi danh.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="tp-btn tp-btn-outline" onClick={handleExportCourses}>
            <FiDownload /> Xuất danh sách (Excel)
          </button>
          <button className="tp-btn tp-btn-primary" onClick={openCreate}>
            <FiPlus /> Tạo khóa học mới
          </button>
        </div>
      </div>

      {/* Summary for the teacher's owned courses */}
      <section className="tp-kpi-grid">
        <div className="tp-kpi-card">
          <div className="tp-kpi-card-header">
            <span className="tp-kpi-label">Khóa học của tôi</span>
            <div className="tp-kpi-icon">
              <FiBookOpen />
            </div>
          </div>
          <div className="tp-kpi-value-row">
            <span className="tp-kpi-number">{totalCoursesCount}</span>
            <span className="tp-kpi-unit">khóa</span>
          </div>
          <div className="tp-kpi-footer is-good">
            <span>Đang giảng dạy {activeCoursesCount}</span>
          </div>
        </div>

        <div className="tp-kpi-card">
          <div className="tp-kpi-card-header">
            <span className="tp-kpi-label">Tổng sinh viên theo học</span>
            <div className="tp-kpi-icon">
              <FiUsers />
            </div>
          </div>
          <div className="tp-kpi-value-row">
            <span className="tp-kpi-number">{totalStudents}</span>
            <span className="tp-kpi-unit">người</span>
          </div>
          <div className="tp-kpi-footer">
            <span>Sinh viên đã kích hoạt ghi danh</span>
          </div>
        </div>

        <div className="tp-kpi-card">
          <div className="tp-kpi-card-header">
            <span className="tp-kpi-label">Bài nộp cần duyệt</span>
            <div className="tp-kpi-icon">
              <FiFileText />
            </div>
          </div>
          <div className="tp-kpi-value-row">
            <span className="tp-kpi-number">{submissionsToReview}</span>
            <span className="tp-kpi-unit">bài</span>
          </div>
          <div className="tp-kpi-footer is-warning">
            <span>Trong các khóa học bạn phụ trách</span>
          </div>
        </div>

        <div className="tp-kpi-card">
          <div className="tp-kpi-card-header">
            <span className="tp-kpi-label">Phổ hoàn thành TB</span>
            <div className="tp-kpi-icon">
              <FiCheckCircle />
            </div>
          </div>
          <div className="tp-kpi-value-row">
            <span className="tp-kpi-number">{completionRate}</span>
          </div>
          <div className="tp-kpi-footer is-good">
            <span>Trong các khóa học bạn phụ trách</span>
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
              placeholder="Tìm kiếm theo tên môn, mã học phần..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select className="tp-filter-select" defaultValue="K1-2025-2026">
            <option value="K1-2025-2026">Học kỳ 1 (2025 - 2026)</option>
            <option value="K2-2025-2026">Học kỳ 2 (2025 - 2026)</option>
            <option value="HE-2025">Học kỳ Hè 2025</option>
          </select>

          <select
            className="tp-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PUBLISHED">Đang mở (PUBLISHED)</option>
            <option value="DRAFT">Bản nháp (DRAFT)</option>
            <option value="ARCHIVED">Đã lưu trữ (ARCHIVED)</option>
          </select>

          <select
            className="tp-filter-select"
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
          >
            <option value="ALL">Tất cả môn học</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {(search || statusFilter !== 'ALL' || subjectFilter !== 'ALL') && (
            <button
              className="tp-btn tp-btn-sm tp-btn-outline"
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
                setSubjectFilter('ALL');
              }}
            >
              Đặt lại
            </button>
          )}
        </div>

        <div className="tp-filter-tabs">
          <button
            className={`tp-filter-tab ${statusFilter === 'ALL' ? 'is-active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            Tất cả ({courses.length})
          </button>
          <button
            className={`tp-filter-tab ${statusFilter === 'PUBLISHED' ? 'is-active' : ''}`}
            onClick={() => setStatusFilter('PUBLISHED')}
          >
            Đang dạy ({courses.filter((c) => c.status === 'PUBLISHED').length})
          </button>
          <button
            className={`tp-filter-tab ${statusFilter === 'DRAFT' ? 'is-active' : ''}`}
            onClick={() => setStatusFilter('DRAFT')}
          >
            Bản nháp ({courses.filter((c) => c.status === 'DRAFT').length})
          </button>
        </div>
      </section>

      {loadError && (
        <div style={{ padding: '12px 16px', background: '#fdf0f0', color: '#d9383a', borderRadius: '8px', marginBottom: '16px' }}>
          <span>{loadError}</span>
          <button onClick={loadCourses} style={{ marginLeft: '12px', textDecoration: 'underline' }}>Thử lại</button>
        </div>
      )}

      {/* Data Table */}
      <section className="tp-table-wrap">
        {loading ? (
          <div style={{ padding: '36px', textAlign: 'center', color: '#62756b' }}>
            Đang tải danh sách khóa học…
          </div>
        ) : pageCourses.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>Không tìm thấy khóa học</h3>
            <p style={{ color: '#62756b', marginBottom: '16px' }}>Không có khóa học nào phù hợp với bộ lọc hiện tại.</p>
            <button className="tp-btn tp-btn-primary" onClick={openCreate}>
              ＋ Tạo khóa học mới
            </button>
          </div>
        ) : (
          <table className="tp-table">
            <thead>
              <tr>
                <th style={{ width: '13%' }}>MÃ HỌC PHẦN</th>
                <th style={{ width: '25%' }}>TÊN KHÓA HỌC & GIẢNG VIÊN</th>
                <th style={{ width: '15%' }}>HỌC PHẦN / BÀI</th>
                <th style={{ width: '11%' }}>SINH VIÊN</th>
                <th style={{ width: '11%' }}>HỌC PHÍ</th>
                <th style={{ width: '12%' }}>TIẾN ĐỘ</th>
                <th style={{ width: '10%' }}>TRẠNG THÁI</th>
                <th style={{ width: '13%', textAlign: 'right' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {pageCourses.map((c) => {
                const struct = structures[c.courseId] || { modules: 0, lessons: 0 };
                const modules = struct.modules ?? 6;
                const lessons = struct.lessons ?? 12;
                const progressPct = c.status === 'PUBLISHED' ? 89 : 25;

                return (
                  <tr key={c.courseId}>
                    <td>
                      <div>
                        <span className="tp-code-badge">{c.courseCode || 'SE301.01'}</span>
                        <div style={{ fontSize: '11px', color: '#62756b', marginTop: '3px' }}>
                          {c.subject || 'Khoa CNTT'}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <Link
                          to={`/courses/${c.courseId}`}
                          style={{ fontWeight: 750, color: '#16261f', textDecoration: 'none', fontSize: '14px' }}
                        >
                          {c.title}
                        </Link>
                        <div style={{ display: 'flex', gap: '8px', fontSize: '11.5px', color: '#62756b', marginTop: '3px' }}>
                          <span style={{ color: '#1e4a37', fontWeight: 650 }}>TS. Mai Phương</span>
                          <span>•</span>
                          <span>Kỳ 1 • 2025-2026</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '4px' }}>
                          <span>{modules} Học phần</span>
                          <span>{lessons} Bài</span>
                        </div>
                        <div className="tp-progress-bar" style={{ height: '5px' }}>
                          <div
                            className="tp-progress-fill"
                            style={{ width: `${Math.min(100, (lessons / 12) * 100)}%`, background: '#2dc48d' }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <strong style={{ fontSize: '13.5px' }}>{c.status === 'PUBLISHED' ? '58 / 60' : '0 / 60'}</strong>
                        <div style={{ fontSize: '10.5px', color: '#62756b' }}>SV ghi danh</div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 650, color: '#16261f' }}>
                        {formatCoursePrice(c.price)}
                      </span>
                    </td>
                    <td>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '4px' }}>
                          <span>Hoàn thành</span>
                          <strong>{progressPct}%</strong>
                        </div>
                        <div className="tp-progress-bar" style={{ height: '5px' }}>
                          <div
                            className="tp-progress-fill"
                            style={{
                              width: `${progressPct}%`,
                              background: progressPct >= 75 ? '#1e875a' : '#e07a22',
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`tp-tag ${
                          c.status === 'PUBLISHED'
                            ? 'tp-tag-published'
                            : c.status === 'DRAFT'
                            ? 'tp-tag-draft'
                            : 'tp-tag-closed'
                        }`}
                      >
                        {courseStatusLabel[c.status] || c.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          className="tp-btn tp-btn-sm tp-btn-primary"
                          title="Vào lớp học"
                          onClick={() => navigate(`/courses/${c.courseId}`)}
                        >
                          Vào lớp
                        </button>
                        <button
                          className="tp-btn tp-btn-sm tp-btn-outline"
                          title="Quản lý sinh viên"
                          onClick={() => navigate(`/teacher/students?courseId=${c.courseId}`)}
                        >
                          <FiUsers />
                        </button>
                        <button
                          className="tp-btn tp-btn-sm tp-btn-outline"
                          title="Chỉnh sửa khóa học"
                          onClick={() => openEdit(c)}
                        >
                          <FiEdit2 />
                        </button>
                        <button
                          className="tp-btn tp-btn-sm tp-btn-danger"
                          title="Xóa khóa học"
                          onClick={() => deleteCourse(c)}
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
        )}

        {/* Pagination Footer */}
        <div
          style={{
            padding: '14px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid #edf3f0',
            fontSize: '12.5px',
            color: '#62756b',
          }}
        >
          <span>
            Hiển thị {visibleCourses.length ? (currentPage - 1) * pageSize + 1 : 0}–
            {Math.min(currentPage * pageSize, visibleCourses.length)} / {visibleCourses.length} khóa học
          </span>
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="tp-btn tp-btn-sm tp-btn-outline"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Trước
              </button>
              <span style={{ fontWeight: 700, color: '#16261f' }}>
                Trang {currentPage} / {totalPages}
              </span>
              <button
                className="tp-btn tp-btn-sm tp-btn-outline"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Sau
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Modal create / edit course */}
      {showForm && (
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
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '680px',
              width: '100%',
              padding: '28px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                paddingBottom: '14px',
                borderBottom: '1px solid #edf3f0',
              }}
            >
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#16261f' }}>
                {editingCourse ? 'Chỉnh sửa khóa học' : 'Tạo khóa học mới'}
              </h2>
              <button
                type="button"
                className="tp-btn tp-btn-sm tp-btn-outline"
                onClick={() => setShowForm(false)}
              >
                ✕
              </button>
            </div>
            <CourseForm
              initialValues={editingCourse || undefined}
              submitting={saving}
              error={submitError}
              onSubmit={saveCourse}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
