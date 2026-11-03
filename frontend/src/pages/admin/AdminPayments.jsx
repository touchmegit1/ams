import { useEffect, useMemo, useState } from 'react';
import { FiDollarSign, FiUsers, FiBookOpen, FiCheckCircle, FiClock, FiSearch, FiDownload, FiRefreshCw } from 'react-icons/fi';
import api from '../../services/api.js';
import { formatCoursePrice } from '../course/courseUi.js';

export default function AdminPayments() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' | 'teachers' | 'courses'
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [teacherFilter, setTeacherFilter] = useState('ALL');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/admin/payments/overview');
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải dữ liệu thanh toán và doanh thu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const summary = data?.summary || {};
  const byTeacher = data?.byTeacher || [];
  const byCourse = data?.byCourse || [];
  const transactions = data?.transactions || [];

  // Filter transactions
  const visibleTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      const matchQuery = !q || [tx.orderCode, tx.studentName, tx.studentEmail, tx.courseTitle, tx.teacherName]
        .some((val) => String(val || '').toLowerCase().includes(q));
      const matchStatus = statusFilter === 'ALL' || tx.status === statusFilter;
      const matchTeacher = teacherFilter === 'ALL' || tx.teacherName === teacherFilter;
      return matchQuery && matchStatus && matchTeacher;
    });
  }, [transactions, search, statusFilter, teacherFilter]);

  const teacherNames = useMemo(() => {
    return Array.from(new Set(transactions.map((tx) => tx.teacherName).filter(Boolean)));
  }, [transactions]);

  // Export CSV
  const exportCsv = () => {
    const quote = (val) => `"${String(val ?? '').replaceAll('"', '""')}"`;
    const rows = [
      ['Mã giao dịch', 'Sinh viên', 'Email', 'Khóa học', 'Giảng viên', 'Số tiền (VND)', 'Trạng thái', 'Thời gian'],
      ...visibleTransactions.map((tx) => [
        tx.orderCode,
        tx.studentName,
        tx.studentEmail,
        tx.courseTitle,
        tx.teacherName,
        tx.amount,
        tx.status === 'PAID' ? 'Đã thanh toán' : tx.status === 'PENDING' ? 'Đang chờ' : tx.status,
        tx.paidAt ? new Date(tx.paidAt).toLocaleString('vi-VN') : tx.createdAt ? new Date(tx.createdAt).toLocaleString('vi-VN') : '—'
      ])
    ];
    const csvContent = rows.map((r) => r.map(quote).join(',')).join('\r\n');
    const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `doanh-thu-ams-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="admin-payments-panel">
      <div className="admin-heading">
        <div>
          <p className="admin-kicker">QUẢN LÝ TÀI CHÍNH</p>
          <h1>Thanh toán & Doanh thu</h1>
          <p>Thống kê tổng doanh thu, đối soát thanh toán theo giảng viên và khóa học.</p>
        </div>
        <button className="admin-refresh" onClick={loadData} aria-label="Tải lại dữ liệu">
          <FiRefreshCw /> Tải lại
        </button>
      </div>

      {error && <div className="admin-error-notice" role="alert">{error}</div>}

      {/* KPI Cards */}
      <div className="admin-stats admin-payment-kpi">
        <div className="admin-kpi-revenue">
          <div className="admin-kpi-icon"><FiDollarSign /></div>
          <div>
            <span>Tổng doanh thu hệ thống</span>
            <strong>{formatCoursePrice(summary.totalRevenue || 0)}</strong>
            <small>{summary.paidTransactions || 0} giao dịch thành công</small>
          </div>
        </div>
        <div>
          <div className="admin-kpi-icon"><FiClock /></div>
          <div>
            <span>Giao dịch đang chờ</span>
            <strong>{summary.pendingTransactions || 0}</strong>
            <small>Đang đợi sinh viên quét mã</small>
          </div>
        </div>
        <div>
          <div className="admin-kpi-icon"><FiUsers /></div>
          <div>
            <span>Giảng viên có khóa học</span>
            <strong>{summary.totalTeachers || byTeacher.length}</strong>
            <small>Đang giảng dạy tại AMS</small>
          </div>
        </div>
        <div>
          <div className="admin-kpi-icon"><FiBookOpen /></div>
          <div>
            <span>Tổng số khóa học</span>
            <strong>{summary.totalCourses || byCourse.length}</strong>
            <small>Khóa học trên hệ thống</small>
          </div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="admin-payment-tabs">
        <button
          className={activeTab === 'transactions' ? 'is-active' : ''}
          onClick={() => setActiveTab('transactions')}
        >
          Lịch sử giao dịch ({transactions.length})
        </button>
        <button
          className={activeTab === 'teachers' ? 'is-active' : ''}
          onClick={() => setActiveTab('teachers')}
        >
          Doanh thu theo Giảng viên ({byTeacher.length})
        </button>
        <button
          className={activeTab === 'courses' ? 'is-active' : ''}
          onClick={() => setActiveTab('courses')}
        >
          Doanh thu theo Khóa học ({byCourse.length})
        </button>
      </div>

      {/* 1. TRANSACTIONS TAB */}
      {activeTab === 'transactions' && (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <h2>Chi tiết các giao dịch thanh toán</h2>
              <p>Danh sách học viên đã quét mã VietQR và trạng thái tiền vào tài khoản.</p>
            </div>
            <button className="admin-btn-action" onClick={exportCsv} disabled={!visibleTransactions.length}>
              <FiDownload /> Xuất báo cáo CSV
            </button>
          </div>

          <div className="admin-filters">
            <label className="admin-search">
              <FiSearch />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm mã đơn, sinh viên, khóa học…"
                aria-label="Tìm kiếm giao dịch"
              />
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Lọc trạng thái"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PAID">Đã thanh toán (Thành công)</option>
              <option value="PENDING">Đang chờ quét mã</option>
              <option value="EXPIRED">Đã hết hạn</option>
            </select>
            {teacherNames.length > 0 && (
              <select
                value={teacherFilter}
                onChange={(e) => setTeacherFilter(e.target.value)}
                aria-label="Lọc theo giảng viên"
              >
                <option value="ALL">Tất cả giảng viên</option>
                {teacherNames.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
          </div>

          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>MÃ ĐƠN</th>
                  <th>SINH VIÊN</th>
                  <th>KHÓA HỌC</th>
                  <th>GIẢNG VIÊN</th>
                  <th>SỐ TIỀN</th>
                  <th>TRẠNG THÁI</th>
                  <th>THỜI GIAN</th>
                </tr>
              </thead>
              <tbody>
                {visibleTransactions.map((tx) => (
                  <tr key={tx.paymentId}>
                    <td>
                      <strong className="admin-order-code">{tx.orderCode}</strong>
                    </td>
                    <td>
                      <div className="admin-person">
                        <span className="admin-person-avatar">{tx.studentName?.[0]?.toUpperCase() || 'S'}</span>
                        <div>
                          <strong>{tx.studentName}</strong>
                          <small>{tx.studentEmail}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong>{tx.courseTitle}</strong>
                      <small style={{ display: 'block', color: '#6a7870' }}>{tx.courseCode}</small>
                    </td>
                    <td>{tx.teacherName}</td>
                    <td>
                      <strong className="admin-price-highlight">{formatCoursePrice(tx.amount)}</strong>
                    </td>
                    <td>
                      <span className={`admin-tx-status status-${tx.status?.toLowerCase()}`}>
                        {tx.status === 'PAID' ? '✓ Đã thanh toán' : tx.status === 'PENDING' ? '⏳ Đang chờ' : 'Đã hết hạn'}
                      </span>
                    </td>
                    <td className="admin-date">
                      {tx.paidAt ? new Date(tx.paidAt).toLocaleString('vi-VN') : tx.createdAt ? new Date(tx.createdAt).toLocaleString('vi-VN') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && visibleTransactions.length === 0 && (
              <div className="admin-empty">Không tìm thấy giao dịch nào phù hợp với bộ lọc.</div>
            )}
            {loading && <div className="admin-empty">Đang tải dữ liệu giao dịch…</div>}
          </div>
        </section>
      )}

      {/* 2. BY TEACHER TAB */}
      {activeTab === 'teachers' && (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <h2>Báo cáo doanh thu theo Giảng viên</h2>
              <p>Tổng hợp số lượng khóa học, lượt học viên mua và tổng tiền của từng giảng viên.</p>
            </div>
          </div>
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>GIẢNG VIÊN</th>
                  <th>SỐ KHÓA HỌC</th>
                  <th>LƯỢT ĐÃ THANH TOÁN</th>
                  <th>TỔNG DOANH THU</th>
                </tr>
              </thead>
              <tbody>
                {byTeacher.map((t) => (
                  <tr key={t.teacherId}>
                    <td>
                      <div className="admin-person">
                        <span className="admin-person-avatar">{t.teacherName?.[0]?.toUpperCase() || 'T'}</span>
                        <div>
                          <strong>{t.teacherName}</strong>
                          <small>{t.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>{t.courseCount} khóa học</td>
                    <td>
                      <strong>{t.paidCount}</strong> học viên
                    </td>
                    <td>
                      <strong className="admin-price-highlight admin-revenue-total">
                        {formatCoursePrice(t.revenue)}
                      </strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && byTeacher.length === 0 && (
              <div className="admin-empty">Chưa có dữ liệu giảng viên.</div>
            )}
            {loading && <div className="admin-empty">Đang tải dữ liệu giảng viên…</div>}
          </div>
        </section>
      )}

      {/* 3. BY COURSE TAB */}
      {activeTab === 'courses' && (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <h2>Báo cáo doanh thu theo Khóa học</h2>
              <p>Doanh số chi tiết cho từng lớp học được mở trên nền tảng AMS.</p>
            </div>
          </div>
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>KHÓA HỌC</th>
                  <th>GIẢNG VIÊN</th>
                  <th>HỌC PHÍ</th>
                  <th>ĐÃ THANH TOÁN</th>
                  <th>ĐANG CHỜ</th>
                  <th>TỔNG THU</th>
                </tr>
              </thead>
              <tbody>
                {byCourse.map((c) => (
                  <tr key={c.courseId}>
                    <td>
                      <strong>{c.courseTitle}</strong>
                      <small style={{ display: 'block', color: '#6a7870' }}>{c.courseCode}</small>
                    </td>
                    <td>{c.teacherName}</td>
                    <td>{formatCoursePrice(c.price)}</td>
                    <td>
                      <span className="admin-count-paid">{c.paidCount}</span>
                    </td>
                    <td>{c.pendingCount}</td>
                    <td>
                      <strong className="admin-price-highlight admin-revenue-total">
                        {formatCoursePrice(c.revenue)}
                      </strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && byCourse.length === 0 && (
              <div className="admin-empty">Chưa có dữ liệu khóa học.</div>
            )}
            {loading && <div className="admin-empty">Đang tải dữ liệu khóa học…</div>}
          </div>
        </section>
      )}
    </div>
  );
}
