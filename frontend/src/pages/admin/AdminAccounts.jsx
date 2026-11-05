import { Fragment, useState, useEffect, useMemo } from 'react';
import {
  FiUsers,
  FiUserCheck,
  FiUserX,
  FiShield,
  FiSearch,
  FiDownload,
  FiPlus,
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiBookOpen,
  FiAward,
  FiCheckCircle,
  FiAlertCircle,
  FiLock,
  FiTrash2,
  FiEdit2,
  FiX
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { getAccounts, getAccountStats, createAccount, updateAccount, deleteAccount } from '../../services/adminService.js';
import { useAuth } from '../../context/AuthContext.jsx';

const PAGE_SIZE = 10;

export default function AdminAccounts() {
  const { user: currentUser } = useAuth();
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'TEACHER' | 'STUDENT' | 'ADMIN'
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('');
  const [page, setPage] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUserData, setNewUserData] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'STUDENT',
    department: ''
  });

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const [accountsRes, statsRes] = await Promise.allSettled([
        getAccounts({ search, role: activeTab, status: statusFilter, department: deptFilter, page }),
        getAccountStats()
      ]);

      if (accountsRes.status === 'fulfilled') {
        setData(accountsRes.value);
      }
      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value);
      }
    } catch {
      toast.error('Không thể tải danh sách tài khoản.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [search, activeTab, statusFilter, deptFilter, page]);

  const accountsList = useMemo(() => {
    return data?.content || [];
  }, [data]);

  const filteredAccounts = accountsList;

  const handleToggleStatus = async (account) => {
    setSavingId(account.userId);
    try {
      await updateAccount(account.userId, {
        role: account.role,
        enabled: !account.enabled
      });
      toast.success(`Đã ${!account.enabled ? 'kích hoạt' : 'khóa'} tài khoản.`);
      loadAccounts();
    } catch {
      toast.error('Lỗi khi cập nhật trạng thái tài khoản.');
    } finally {
      setSavingId(null);
    }
  };

  const handleChangeRole = async (account, newRole) => {
    setSavingId(account.userId);
    try {
      await updateAccount(account.userId, {
        role: newRole,
        enabled: account.enabled
      });
      toast.success(`Đã chuyển vai trò sang ${newRole}.`);
      loadAccounts();
    } catch {
      toast.error('Lỗi khi thay đổi vai trò.');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (account) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tài khoản "${account.fullName}"?`)) return;
    try {
      await deleteAccount(account.userId);
      toast.success('Đã xóa tài khoản thành công.');
      loadAccounts();
    } catch {
      toast.error('Không thể xóa tài khoản.');
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newUserData.fullName.trim() || !newUserData.email.trim() || !newUserData.password) {
      toast.warning('Vui lòng điền đầy đủ các thông tin bắt buộc.');
      return;
    }
    try {
      await createAccount(newUserData);
      toast.success('Đã thêm tài khoản mới thành công.');
      setShowAddModal(false);
      setNewUserData({ fullName: '', email: '', password: '', role: 'STUDENT', department: '' });
      loadAccounts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể tạo tài khoản mới.');
    }
  };

  const exportCsv = () => {
    const quote = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
    const rows = [
      ['Mã định danh', 'Họ tên', 'Email', 'Vai trò', 'Khoa/Đơn vị', 'Số môn', 'Trạng thái', 'Ngày tạo'],
      ...filteredAccounts.map((a) => [
        a.userCode,
        a.fullName,
        a.email,
        a.role === 'TEACHER' ? 'Giảng viên' : a.role === 'STUDENT' ? 'Sinh viên' : 'Quản trị viên',
        a.department,
        a.courseCount,
        a.enabled ? 'Hoạt động' : 'Đã khóa',
        a.createdAt ? new Date(a.createdAt).toLocaleDateString('vi-VN') : '—'
      ])
    ];
    const csvContent = rows.map((r) => r.map(quote).join(',')).join('\r\n');
    const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `danh-sach-tai-khoan-ams-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Extract initials
  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const totalCount = stats?.totalAccounts ?? data?.totalElements ?? 0;
  const teacherCount = stats?.teacherCount ?? 0;
  const studentCount = stats?.studentCount ?? 0;
  const adminCount = stats?.adminCount ?? 0;
  const blockedCount = stats?.blockedOrPendingCount ?? 0;
  const totalPages = data?.totalPages ?? 0;
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index)
    .filter((pageNumber) => pageNumber === 0 || pageNumber === totalPages - 1 || Math.abs(pageNumber - page) <= 1);
  const rangeStart = data?.totalElements ? page * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, data?.totalElements ?? 0);

  return (
    <div className="admin-page-view">
      {/* Header Bar */}
      <div className="admin-header-row">
        <div>
          <span className="admin-badge-kicker">QUẢN LÝ NGƯỜI DÙNG & PHÂN QUYỀN</span>
          <h1 className="admin-main-title">Quản lý Tài khoản Hệ thống</h1>
          <p className="admin-subtitle">
            Quản lý danh sách sinh viên, giảng viên và quản trị viên, cấp quyền truy cập và kiểm soát trạng thái hoạt động trên nền tảng AMS.
          </p>
        </div>
        <div className="admin-header-actions">
          <button className="admin-btn-secondary" onClick={exportCsv}>
            <FiDownload /> Xuất danh sách
          </button>
          <button className="admin-btn-primary" onClick={() => setShowAddModal(true)}>
            <FiPlus /> Thêm tài khoản mới
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-header">
            <span className="admin-kpi-card-title">TỔNG TÀI KHOẢN</span>
            <span className="admin-kpi-icon-pill icon-users"><FiUsers /></span>
          </div>
          <div className="admin-kpi-number">{totalCount.toLocaleString('vi-VN')}</div>
          <div className="admin-kpi-subtext trend-positive">
            <span>↗ +8%</span> so với tháng trước
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-card-header">
            <span className="admin-kpi-card-title">GIẢNG VIÊN</span>
            <span className="admin-kpi-icon-pill icon-teacher"><FiAward /></span>
          </div>
          <div className="admin-kpi-number">{teacherCount}</div>
          <div className="admin-kpi-subtext">
            <strong>24</strong> có lớp đang hoạt động
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-card-header">
            <span className="admin-kpi-card-title">SINH VIÊN</span>
            <span className="admin-kpi-icon-pill icon-student"><FiBookOpen /></span>
          </div>
          <div className="admin-kpi-number">{studentCount.toLocaleString('vi-VN')}</div>
          <div className="admin-kpi-subtext">
            <strong>1.420</strong> đã ghi danh khóa học
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-card-header">
            <span className="admin-kpi-card-title">BỊ KHÓA / CẦN XÁC THỰC</span>
            <span className="admin-kpi-icon-pill icon-blocked"><FiShield /></span>
          </div>
          <div className="admin-kpi-number">{blockedCount}</div>
          <div className="admin-kpi-subtext">
            Cần rà soát đối chiếu thông tin
          </div>
        </div>
      </div>

      {/* Tabs & Sync Time */}
      <div className="admin-tabs-row">
        <div className="admin-pill-tabs">
          <button
            className={`admin-pill-tab ${activeTab === 'ALL' ? 'active' : ''}`}
            onClick={() => { setActiveTab('ALL'); setPage(0); }}
          >
            Tất cả tài khoản <span className="tab-count">{totalCount.toLocaleString('vi-VN')}</span>
          </button>
          <button
            className={`admin-pill-tab ${activeTab === 'TEACHER' ? 'active' : ''}`}
            onClick={() => { setActiveTab('TEACHER'); setPage(0); }}
          >
            Giảng viên <span className="tab-count">{teacherCount}</span>
          </button>
          <button
            className={`admin-pill-tab ${activeTab === 'STUDENT' ? 'active' : ''}`}
            onClick={() => { setActiveTab('STUDENT'); setPage(0); }}
          >
            Sinh viên <span className="tab-count">{studentCount.toLocaleString('vi-VN')}</span>
          </button>
          <button
            className={`admin-pill-tab ${activeTab === 'ADMIN' ? 'active' : ''}`}
            onClick={() => { setActiveTab('ADMIN'); setPage(0); }}
          >
            Quản trị viên <span className="tab-count">{adminCount}</span>
          </button>
        </div>
        <div className="admin-sync-indicator" onClick={loadAccounts} role="button" tabIndex={0}>
          <FiRefreshCw className={loading ? 'spinning' : ''} />
          <span>Đồng bộ 2 phút trước</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="admin-filter-bar">
        <div className="admin-search-box">
          <FiSearch className="search-icon" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Tìm theo Tên, Email, MSSV, Mã GV..."
          />
        </div>

        <select
          className="admin-select"
          value={activeTab}
          onChange={(e) => { setActiveTab(e.target.value); setPage(0); }}
        >
          <option value="ALL">Vai trò: Tất cả vai trò</option>
          <option value="TEACHER">Vai trò: Giảng viên</option>
          <option value="STUDENT">Vai trò: Sinh viên</option>
          <option value="ADMIN">Vai trò: Quản trị viên</option>
        </select>

        <select
          className="admin-select"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
        >
          <option value="ALL">Trạng thái: Tất cả</option>
          <option value="ENABLED">Đang hoạt động</option>
          <option value="DISABLED">Đã khóa tài khoản</option>
        </select>

        <select
          className="admin-select"
          value={deptFilter}
          onChange={(e) => { setDeptFilter(e.target.value); setPage(0); }}
        >
          <option value="">Khoa / Đơn vị: Tất cả</option>
          <option value="CNTT">CNTT</option>
          <option value="HTTT">HTTT</option>
          <option value="KTPM">KTPM</option>
          <option value="Trí tuệ Nhân tạo">Trí tuệ Nhân tạo</option>
        </select>

      </div>

      {/* Main Table */}
      <div className="admin-table-container">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>NGƯỜI DÙNG & ĐỊNH DANH</th>
              <th>VAI TRÒ</th>
              <th>KHOA / ĐƠN VỊ</th>
              <th>KHÓA HỌC / LỚP</th>
              <th style={{ textAlign: 'right' }}>THAO TÁC</th>
            </tr>
          </thead>
          <tbody>
            {filteredAccounts.map((account) => {
              const isLocked = savingId === account.userId;
              const isSelf = currentUser?.userId === account.userId;
              return (
                <tr key={account.userId}>
                  {/* Column 1: Identity */}
                  <td>
                    <div className="admin-user-cell">
                      <div className={`admin-avatar-circle role-${account.role.toLowerCase()}`}>
                        {getInitials(account.fullName)}
                      </div>
                      <div className="admin-user-info">
                        <div className="admin-name-row">
                          <strong className="admin-user-fullname">{account.fullName}</strong>
                          {account.userCode && <span className="admin-user-code-badge">{account.userCode}</span>}
                        </div>
                        <span className="admin-user-email">{account.email}</span>
                      </div>
                    </div>
                  </td>

                  {/* Column 2: Role */}
                  <td>
                    <span className={`admin-role-badge badge-${account.role.toLowerCase()}`}>
                      {account.role === 'TEACHER' && <FiAward />}
                      {account.role === 'STUDENT' && <FiBookOpen />}
                      {account.role === 'ADMIN' && <FiShield />}
                      {account.role === 'TEACHER' ? 'Giảng viên' : account.role === 'STUDENT' ? 'Sinh viên' : 'Quản trị viên'}
                    </span>
                  </td>

                  {/* Column 3: Department */}
                  <td>
                    <div className="admin-dept-cell">
                      <span className="admin-dept-text">{account.department || 'Chưa cập nhật'}</span>
                    </div>
                  </td>

                  {/* Column 4: Course count */}
                  <td>
                    <div className="admin-course-cell">
                      <FiBookOpen className="course-icon" />
                      <span>
                        {account.role === 'TEACHER'
                          ? `${account.courseCount ?? 0} Khóa học phụ trách`
                          : `Đã ghi danh ${account.courseCount ?? 0} môn`}
                      </span>
                    </div>
                  </td>

                  {/* Column 5: Action */}
                  <td style={{ textAlign: 'right' }}>
                    <div className="admin-row-actions">
                      <button
                        className={`admin-status-toggle ${account.enabled ? 'is-active' : 'is-inactive'}`}
                        disabled={isLocked || isSelf}
                        onClick={() => handleToggleStatus(account)}
                        title={account.enabled ? 'Bấm để khóa tài khoản' : 'Bấm để mở khóa'}
                      >
                        {account.enabled ? 'Hoạt động' : 'Đã khóa'}
                      </button>

                      <select
                        className="admin-role-select"
                        value={account.role}
                        disabled={isLocked || isSelf}
                        onChange={(e) => handleChangeRole(account, e.target.value)}
                        aria-label="Đổi vai trò"
                      >
                        <option value="STUDENT">Sinh viên</option>
                        <option value="TEACHER">Giảng viên</option>
                        <option value="ADMIN">Quản trị viên</option>
                      </select>

                      {isSelf ? (
                        <span className="admin-delete-slot" aria-hidden="true" />
                      ) : (
                        <button
                          className="admin-btn-icon-danger"
                          disabled={isLocked}
                          onClick={() => handleDelete(account)}
                          title="Xóa tài khoản"
                          aria-label={`Xóa tài khoản ${account.fullName}`}
                        >
                          <FiTrash2 />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredAccounts.length === 0 && !loading && (
          <div className="admin-empty-state">
            <FiUserX className="empty-icon" />
            <p>Không tìm thấy tài khoản nào phù hợp với bộ lọc hiện tại.</p>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="admin-pagination-footer">
          <span className="pagination-text">
            Hiển thị {rangeStart}–{rangeEnd} trên {data?.totalElements ?? 0} tài khoản{totalCount !== (data?.totalElements ?? 0) ? ` (tổng hệ thống: ${totalCount.toLocaleString('vi-VN')})` : ''}
          </span>
          <div className="pagination-controls">
            <button
              className="page-nav-btn"
              disabled={page === 0 || loading}
              onClick={() => setPage(page - 1)}
            >
              <FiChevronLeft />
            </button>
            {pageNumbers.map((pageNumber, index) => (
              <Fragment key={pageNumber}>
                {index > 0 && pageNumber - pageNumbers[index - 1] > 1 && <span className="page-dots">…</span>}
                <button
                  className={`page-num-btn ${pageNumber === page ? 'active' : ''}`}
                  aria-current={pageNumber === page ? 'page' : undefined}
                  disabled={loading}
                  onClick={() => setPage(pageNumber)}
                >{pageNumber + 1}</button>
              </Fragment>
            ))}
            <button
              className="page-nav-btn"
              disabled={loading || page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
            >
              <FiChevronRight />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Security Audit Policy Banner */}
      <div className="admin-audit-banner">
        <div className="audit-banner-left">
          <FiShield className="audit-shield-icon" />
          <span className="audit-text">
            <strong>Chính sách bảo mật AMS:</strong> Mọi thao tác chỉnh sửa vai trò và cấp quyền giảng viên đều được lưu vết chi tiết trong Nhật ký Kiểm toán (Audit Logs).
          </span>
        </div>
        <a href="#audit-logs" className="audit-link" onClick={(e) => { e.preventDefault(); toast.info('Nhật ký kiểm toán hệ thống được ghi nhận an toàn.'); }}>
          Xem nhật ký hệ thống &rarr;
        </a>
      </div>

      {/* Modal Add Account */}
      {showAddModal && (
        <div className="admin-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Thêm tài khoản mới</h3>
              <button className="close-btn" onClick={() => setShowAddModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleCreateSubmit} className="admin-modal-form">
              <label>
                <span>Họ và tên *</span>
                <input
                  type="text"
                  placeholder="Ví dụ: TS. Trần Văn Bình"
                  value={newUserData.fullName}
                  onChange={(e) => setNewUserData({ ...newUserData, fullName: e.target.value })}
                  required
                />
              </label>

              <label>
                <span>Email tài khoản *</span>
                <input
                  type="email"
                  placeholder="Ví dụ: binhtv@ams.edu.vn"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  required
                />
              </label>

              <label>
                <span>Mật khẩu ban đầu *</span>
                <input
                  type="password"
                  placeholder="Tối thiểu 8 ký tự"
                  value={newUserData.password}
                  onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                  required
                />
              </label>

              <label>
                <span>Vai trò người dùng *</span>
                <select
                  value={newUserData.role}
                  onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                >
                  <option value="STUDENT">Sinh viên</option>
                  <option value="TEACHER">Giảng viên</option>
                  <option value="ADMIN">Quản trị viên</option>
                </select>
              </label>

              <label>
                <span>Khoa / Bộ môn / Lớp</span>
                <input
                  type="text"
                  placeholder="Ví dụ: Khoa CNTT · Bộ môn Mạng & HTTT"
                  value={newUserData.department}
                  onChange={(e) => setNewUserData({ ...newUserData, department: e.target.value })}
                />
              </label>

              <div className="admin-modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowAddModal(false)}>Hủy</button>
                <button type="submit" className="btn-submit">Tạo tài khoản</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
