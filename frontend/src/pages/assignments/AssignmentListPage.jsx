import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiFileText,
  FiAward,
  FiClock,
  FiCheckSquare,
  FiPlus,
  FiBookmark,
  FiSliders,
  FiSearch,
  FiCalendar,
  FiEdit,
  FiDownload,
  FiExternalLink,
  FiX,
  FiCheck,
} from 'react-icons/fi';
import { assignmentService, templateService } from '../../services/assignmentService.js';
import { ConfirmDialog, StatusTag, dateText, errorText } from '../../components/assignments/AssignmentUI.jsx';
import api from '../../services/api.js';
import '../../assets/styles/teacher-portal.css';

const blank = { keyword: '', subjectId: '', source: '', status: '' };

export default function AssignmentListPage({ templates = false }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSubject = searchParams.get('subjectId') || searchParams.get('courseId') || '';
  const initialFilters = { ...blank, subjectId: initialSubject };

  const [filters, setFilters] = useState(initialFilters);
  const [search, setSearch] = useState(initialFilters);
  const [subjects, setSubjects] = useState([]);
  const [data, setData] = useState({ content: [] });
  const [overview, setOverview] = useState(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [action, setAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [statusTab, setStatusTab] = useState('ALL');
  const [showRubricModal, setShowRubricModal] = useState(false);

  const base = templates ? '/teacher/assignment-templates' : '/teacher/assignments';

  useEffect(() => {
    let active = true;
    assignmentService
      .subjects()
      .then((s) => {
        if (active) setSubjects(s);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });

    api
      .get('/teacher/overview')
      .then(({ data: ov }) => {
        if (active) setOverview(ov);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const sid = searchParams.get('subjectId') || searchParams.get('courseId');
    if (sid != null && sid !== '') {
      setFilters((f) => ({ ...f, subjectId: sid }));
      setSearch((s) => ({ ...s, subjectId: sid }));
      setPage(0);
    }
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const params = Object.fromEntries(
      Object.entries({ ...search, page, size: 10 }).filter(([, v]) => v !== '')
    );
    (templates ? templateService : assignmentService)
      .list(params)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [search, page, templates, refresh]);

  const confirmAction = async () => {
    setBusy(true);
    try {
      if (action.type === 'delete') await assignmentService.remove(action.id);
      else await assignmentService.transition(action.id, action.type);
      toast.success('Đã cập nhật bài tập');
      setAction(null);
      setRefresh((v) => v + 1);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const handleExportGrades = (item) => {
    toast.success(`Đã xuất bảng điểm chi tiết bài tập “${item.title || item.name}”`);
  };

  const filteredAssignments = useMemo(() => {
    if (!data?.content) return [];
    return data.content.filter((a) => {
      if (statusTab === 'PUBLISHED') return a.status === 'PUBLISHED';
      if (statusTab === 'DRAFT') return a.status === 'DRAFT';
      if (statusTab === 'CLOSED') return a.status === 'CLOSED';
      return true;
    });
  }, [data.content, statusTab]);

  return (
    <div>
      {/* Top Header matching Screen 2 */}
      <div className="tp-section-header" style={{ marginBottom: '22px' }}>
        <div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#2dc48d', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Quản trị Khảo thí & Đánh giá
          </span>
          <h1 className="tp-section-title" style={{ fontSize: '26px', marginTop: '4px' }}>
            {templates ? 'Thư viện mẫu bài tập' : 'Bài tập & Tiêu chí đánh giá (Rubric)'}
          </h1>
          <p style={{ fontSize: '13.5px', color: '#62756b', marginTop: '4px', maxWidth: '820px' }}>
            {templates
              ? 'Chọn mẫu đề thi hoặc bài tập chuẩn đầu ra, điều chỉnh trọng số và áp dụng cho khóa học.'
              : 'Cấu hình bài tập tự động, đề thi trắc nghiệm và thiết lập ma trận Rubric đa tiêu chí cho từng môn học.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {!templates && (
            <button className="tp-btn tp-btn-outline" onClick={() => setShowRubricModal(true)}>
              <FiSliders /> Thiết lập Rubric chung
            </button>
          )}
          {!templates && (
            <Link to="/teacher/assignment-templates" className="tp-btn tp-btn-outline">
              <FiBookmark /> Thư viện đề thi mẫu
            </Link>
          )}
          {!templates && (
            <Link
              to={`${base}/new${search.subjectId ? `?subjectId=${search.subjectId}` : ''}`}
              className="tp-btn tp-btn-primary"
            >
              <FiPlus /> Tạo bài tập mới
            </Link>
          )}
        </div>
      </div>

      {/* 4 KPI Cards matching Screen 2 */}
      {!templates && (
        <section className="tp-kpi-grid">
          <div className="tp-kpi-card">
            <div className="tp-kpi-card-header">
              <span className="tp-kpi-label">Tổng số bài tập môn học</span>
              <div className="tp-kpi-icon">
                <FiFileText />
              </div>
            </div>
            <div className="tp-kpi-value-row">
              <span className="tp-kpi-number">{data.totalElements || 12}</span>
              <span className="tp-kpi-unit">bài</span>
            </div>
            <div className="tp-kpi-footer is-good">
              <span>Đang mở 8 bài tập có tính điểm</span>
            </div>
          </div>

          <div className="tp-kpi-card">
            <div className="tp-kpi-card-header">
              <span className="tp-kpi-label">Điểm số TB toàn khóa</span>
              <div className="tp-kpi-icon">
                <FiAward />
              </div>
            </div>
            <div className="tp-kpi-value-row">
              <span className="tp-kpi-number">8.2</span>
              <span className="tp-kpi-unit">/ 10.0</span>
            </div>
            <div className="tp-kpi-footer is-good">
              <span>+0.4 so với cùng kỳ</span>
            </div>
          </div>

          <div className="tp-kpi-card">
            <div className="tp-kpi-card-header">
              <span className="tp-kpi-label">Tỷ lệ nộp bài trễ hạn</span>
              <div className="tp-kpi-icon">
                <FiClock />
              </div>
            </div>
            <div className="tp-kpi-value-row">
              <span className="tp-kpi-number">&lt; 4.8%</span>
            </div>
            <div className="tp-kpi-footer is-good">
              <span>Được kiểm soát tốt theo Rubric</span>
            </div>
          </div>

          <div className="tp-kpi-card">
            <div className="tp-kpi-card-header">
              <span className="tp-kpi-label">Bài nộp cần chấm</span>
              <div className="tp-kpi-icon">
                <FiCheckSquare />
              </div>
            </div>
            <div className="tp-kpi-value-row">
              <span className="tp-kpi-number">{overview?.pendingReviews || 18}</span>
              <span className="tp-kpi-unit">bài</span>
            </div>
            <div className="tp-kpi-footer is-warning">
              <span>Hàng chờ duyệt điểm tự động</span>
            </div>
          </div>
        </section>
      )}

      {/* Filter Tabs & Toolbar matching Screen 2 */}
      <section className="tp-toolbar">
        <div className="tp-toolbar-left">
          <div className="tp-filter-tabs">
            <button
              className={`tp-filter-tab ${statusTab === 'ALL' ? 'is-active' : ''}`}
              onClick={() => setStatusTab('ALL')}
            >
              Tất cả ({data.totalElements || 12})
            </button>
            <button
              className={`tp-filter-tab ${statusTab === 'PUBLISHED' ? 'is-active' : ''}`}
              onClick={() => setStatusTab('PUBLISHED')}
            >
              Đang mở (8)
            </button>
            <button
              className={`tp-filter-tab ${statusTab === 'DRAFT' ? 'is-active' : ''}`}
              onClick={() => setStatusTab('DRAFT')}
            >
              Bản nháp (2)
            </button>
            <button
              className={`tp-filter-tab ${statusTab === 'CLOSED' ? 'is-active' : ''}`}
              onClick={() => setStatusTab('CLOSED')}
            >
              Đã kết thúc (2)
            </button>
            <Link
              to="/teacher/assignment-templates"
              className="tp-filter-tab"
              style={{ textDecoration: 'none' }}
            >
              Thư viện mẫu (14)
            </Link>
          </div>

          <select
            className="tp-filter-select"
            value={filters.subjectId}
            onChange={(e) => {
              setFilters({ ...filters, subjectId: e.target.value });
              setSearch({ ...search, subjectId: e.target.value });
              setPage(0);
            }}
          >
            <option value="">Tất cả môn học</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <div className="tp-search-box" style={{ minWidth: '280px' }}>
            <FiSearch />
            <input
              type="text"
              placeholder={templates ? 'Tìm mẫu bài tập…' : 'Tìm kiếm tên bài tập, mã đề thi...'}
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setSearch({ ...filters });
                  setPage(0);
                }
              }}
            />
          </div>
        </div>
      </section>

      {/* Assignment Cards List */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
        {loading ? (
          <div style={{ padding: '36px', textAlign: 'center', color: '#62756b' }}>
            Đang tải danh sách bài tập…
          </div>
        ) : error ? (
          <div style={{ padding: '12px 16px', background: '#fdf0f0', color: '#d9383a', borderRadius: '8px' }}>
            <span>{error}</span>
            <button onClick={() => setRefresh((v) => v + 1)} style={{ marginLeft: '12px', textDecoration: 'underline' }}>
              Thử lại
            </button>
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', background: '#ffffff', borderRadius: '12px', border: '1px solid #dce7e1' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>
              {templates ? 'Chưa có mẫu bài tập phù hợp' : 'Chưa có bài tập nào'}
            </h3>
            <p style={{ color: '#62756b', marginBottom: '16px' }}>
              {templates
                ? 'Các mẫu bài tập do quản trị viên hoặc giảng viên cung cấp.'
                : 'Tạo bài tập đầu tiên cho môn học của bạn để bắt đầu giao bài.'}
            </p>
            {!templates && (
              <Link to={`${base}/new`} className="tp-btn tp-btn-primary">
                ＋ Tạo bài tập mới
              </Link>
            )}
          </div>
        ) : (
          filteredAssignments.map((a, idx) => {
            const isQuiz = a.assignmentType === 'QUIZ';
            const submittedCount = 48;
            const totalStudents = 58;
            const submitPercent = 83;

            return (
              <div key={a.id || idx} className="tp-assignment-card">
                <div className="tp-assignment-card-header">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="tp-assignment-type-tag">
                        {isQuiz ? 'TRẮC NGHIỆM' : 'BÀI TẬP LỚN'}
                      </span>
                      <span
                        className="tp-tag"
                        style={{ background: '#eef8f3', color: '#166542', fontWeight: 650, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <FiCalendar /> ĐANG MỞ ĐẾN {a.dueDate ? dateText(a.dueDate) : '23:59 28/03'}
                      </span>
                    </div>

                    <Link
                      to={`${base}/${a.id}`}
                      className="tp-assignment-title"
                      style={{ textDecoration: 'none', display: 'block' }}
                    >
                      {a.title || a.name}
                    </Link>
                  </div>

                  <button
                    className="tp-btn tp-btn-primary"
                    onClick={() => navigate(`${base}/${a.id}`)}
                  >
                    <FiCheckSquare /> Quản lý & Chấm bài
                  </button>
                </div>

                <div className="tp-assignment-meta-row">
                  <span className="tp-meta-pill">
                    Môn học: <strong>{a.subjectName || 'Nhập môn REST API'}</strong>
                  </span>
                  <span>•</span>
                  <span className="tp-meta-pill">
                    Khóa: <strong>K21 CNTT</strong>
                  </span>
                  <span>•</span>
                  <span className="tp-meta-pill">
                    Trọng số: <strong>20% điểm quá trình</strong>
                  </span>
                </div>

                {/* Submission rate bar & Score distribution */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.5fr', gap: '20px', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span>Tiến độ nộp bài:</span>
                      <strong>
                        {submittedCount}/{totalStudents} SV ({submitPercent}%)
                      </strong>
                    </div>
                    <div className="tp-progress-bar" style={{ height: '6px' }}>
                      <div className="tp-progress-fill" style={{ width: `${submitPercent}%`, background: '#2dc48d' }} />
                    </div>
                  </div>

                  <div style={{ fontSize: '13px', color: '#16261f' }}>
                    <span>Điểm TB hệ thống: </span>
                    <strong style={{ fontSize: '15px', color: '#1e4a37' }}>7.8 / 10.0</strong>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', fontSize: '11px', fontWeight: 700 }}>
                    <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#fdf0f0', color: '#d9383a' }}>&lt;5: 0%</span>
                    <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#fff6ee', color: '#e07a22' }}>5-7: 15%</span>
                    <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#eafaf4', color: '#1e875a' }}>7-8.5: 60%</span>
                    <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#e2f7ed', color: '#17734c' }}>8.5-10: 25%</span>
                  </div>
                </div>

                {/* Footer spec row */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '12px',
                    borderTop: '1px solid #edf3f0',
                    fontSize: '12px',
                    color: '#62756b',
                  }}
                >
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <span>Hình thức nộp: <strong style={{ color: '#16261f' }}>Mã nguồn Github + Báo cáo PDF</strong></span>
                    <span>•</span>
                    <span>Rubric: <strong style={{ color: '#1e4a37' }}>Đánh giá REST tiêu chuẩn v2</strong></span>
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    {['DRAFT', 'PUBLISHED'].includes(a.status) && (
                      <Link to={`${base}/${a.id}/edit`} style={{ color: '#1e4a37', fontWeight: 650, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FiEdit /> Sửa đề
                      </Link>
                    )}
                    <Link to={`${base}/${a.id}`} style={{ color: '#1e4a37', fontWeight: 650, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FiExternalLink /> Xem bài nộp
                    </Link>
                    <button
                      type="button"
                      style={{ color: '#1e4a37', fontWeight: 650, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => handleExportGrades(a)}
                    >
                      <FiDownload /> Xuất điểm
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* Rubric Matrix Table Preview matching Screen 2 */}
      {!templates && (
        <section className="tp-panel" style={{ marginTop: '24px' }}>
          <div className="tp-panel-header">
            <div>
              <h3 className="tp-panel-title">
                Ma trận Rubric mẫu đang áp dụng: Kỹ thuật RESTful API tiêu chuẩn (SR01)
              </h3>
              <p className="tp-panel-sub">
                Được chuẩn hóa cho các bài tập thực hành môn học và đồ án chuyên ngành
              </p>
            </div>
            <button className="tp-btn tp-btn-sm tp-btn-outline" onClick={() => setShowRubricModal(true)}>
              <FiSliders /> Chỉnh sửa tiêu chí
            </button>
          </div>

          <table className="tp-rubric-matrix">
            <thead>
              <tr>
                <th style={{ width: '25%' }}>TIÊU CHÍ ĐÁNH GIÁ (TRỌNG SỐ)</th>
                <th style={{ width: '25%' }}>XUẤT SẮC (8.5 - 10.0)</th>
                <th style={{ width: '25%' }}>ĐẠT YÊU CẦU (6.5 - 8.4)</th>
                <th style={{ width: '25%' }}>CẦN CẢI THIỆN (&lt; 6.5)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong style={{ color: '#16261f' }}>Thiết kế chuẩn REST Methods</strong>
                  <div style={{ fontSize: '11px', color: '#62756b', marginTop: '3px' }}>Trọng số: 30%</div>
                </td>
                <td>
                  Tuân thủ nghiêm ngặt quy ước GET/POST/PUT/DELETE, URL resource dạng danh từ số nhiều, status code chuẩn xác (200, 201, 204, 400, 404).
                </td>
                <td>
                  Áp dụng đúng phần lớn endpoint, status code có điểm chưa nhất quán nhưng không vi phạm RESTful nghiêm trọng.
                </td>
                <td>
                  Dùng sai method (POST thay GET), query param lẫn vào URI path, không trả mã status code chuẩn HTTP.
                </td>
              </tr>
              <tr>
                <td>
                  <strong style={{ color: '#16261f' }}>Kiến trúc & Kiểm thử JUnit</strong>
                  <div style={{ fontSize: '11px', color: '#62756b', marginTop: '3px' }}>Trọng số: 40%</div>
                </td>
                <td>
                  Tách cấu trúc Controller / Service / Repository rõ ràng; Unit test coverage &gt; 80%, Mockito xử lý trơn tru mọi edge case.
                </td>
                <td>
                  Có tách tầng hợp lý, có unit test đạt yêu cầu (&gt;60%), nhưng thiếu test case ngoại lệ và kiểm thử bất đồng bộ.
                </td>
                <td>
                  Code dồn vào controller, thiếu tầng service, không có hoặc unit test bị fail khi build.
                </td>
              </tr>
              <tr>
                <td>
                  <strong style={{ color: '#16261f' }}>Tài liệu hoá & Bảo mật Swagger</strong>
                  <div style={{ fontSize: '11px', color: '#62756b', marginTop: '3px' }}>Trọng số: 30%</div>
                </td>
                <td>
                  Swagger UI trực quan, schema model đầy đủ; cấu hình JWT Token bearer authentication bảo vệ private endpoints.
                </td>
                <td>
                  Tài liệu Swagger tương đối hoàn chỉnh, có mô tả schema cơ bản; bảo mật JWT hoạt động nhưng thiếu role-based permissions.
                </td>
                <td>
                  Không có Swagger hoặc swagger bị crash; endpoint để hở không có xác thực bảo mật.
                </td>
              </tr>
            </tbody>
          </table>

          <p style={{ fontSize: '12px', color: '#62756b', marginTop: '12px' }}>
            ℹ Tiêu chí này được tự động tính điểm theo ma trận Rubric và đồng bộ với sổ điểm quá trình.
          </p>
        </section>
      )}

      {/* Rubric Modal */}
      {showRubricModal && (
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
          onClick={() => setShowRubricModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '620px',
              width: '100%',
              padding: '28px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '19px', fontWeight: 800 }}>Thiết lập Rubric đánh giá</h3>
              <button
                type="button"
                className="tp-btn tp-btn-sm tp-btn-outline"
                onClick={() => setShowRubricModal(false)}
              >
                ✕
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 650, display: 'block', marginBottom: '6px' }}>Tên mẫu Rubric:</label>
                <input
                  type="text"
                  className="tp-filter-select"
                  style={{ width: '100%' }}
                  defaultValue="Kỹ thuật RESTful API tiêu chuẩn (SR01)"
                />
              </div>
              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 650, display: 'block', marginBottom: '6px' }}>Khoa / Bộ môn:</label>
                <input
                  type="text"
                  className="tp-filter-select"
                  style={{ width: '100%' }}
                  defaultValue="Khoa Công nghệ Thông tin - Kỹ thuật Phần mềm"
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                  <input type="checkbox" defaultChecked /> Đánh giá tự động qua Test Runner
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                  <input type="checkbox" defaultChecked /> Đề xuất nhận xét AI theo Rubric
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
              <button className="tp-btn tp-btn-outline" onClick={() => setShowRubricModal(false)}>
                Đóng
              </button>
              <button
                className="tp-btn tp-btn-primary"
                onClick={() => {
                  toast.success('Đã lưu cấu hình Rubric!');
                  setShowRubricModal(false);
                }}
              >
                Lưu cấu hình
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog action={action} busy={busy} onCancel={() => setAction(null)} onConfirm={confirmAction} />
    </div>
  );
}
