import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiUsers, FiLogOut, FiChevronLeft, FiChevronRight, FiRefreshCw } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext.jsx';
import { getAccounts, updateAccount } from '../../services/adminService.js';
import './admin.css';

const roles = { ADMIN: 'Quản trị viên', TEACHER: 'Giảng viên', STUDENT: 'Sinh viên' };
const message = (error) => error.response?.data?.message || 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.';

export default function AdminPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('ALL');
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [reload, setReload] = useState(0);

  const refresh = useCallback(() => setReload((value) => value + 1), []);
  useEffect(() => { const timer = setTimeout(() => { setPage(0); setSearch(query); }, 300); return () => clearTimeout(timer); }, [query]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    getAccounts({ search, role, page }).then((result) => { if (active) setData(result); })
      .catch((error) => { if (active) toast.error(message(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [search, role, page, reload]);

  async function changeAccount(account, patch) {
    setSavingId(account.userId);
    try {
      await updateAccount(account.userId, { role: patch.role ?? account.role, enabled: patch.enabled ?? account.enabled });
      toast.success('Đã cập nhật tài khoản.');
      refresh();
    } catch (error) { toast.error(message(error)); }
    finally { setSavingId(null); }
  }

  async function signOut() { await logout(); navigate('/login'); }
  const accounts = data?.content ?? [];
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <div className="admin-brand"><span className="admin-brand-mark">A</span><div><strong>AMS</strong><small>ADMIN CONSOLE</small></div></div>
      <div className="admin-sidebar-caption">QUẢN LÝ HỆ THỐNG</div>
      <div className="admin-side-link active"><FiUsers /> Tài khoản</div>
      <div className="admin-sidebar-bottom"><div className="admin-side-user"><span>{user?.fullName?.[0]?.toUpperCase() || 'A'}</span><div><strong>{user?.fullName || 'Admin'}</strong><small>Quản trị viên</small></div></div><button onClick={signOut}><FiLogOut /> Đăng xuất</button></div>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar"><span>Quản trị / Tài khoản</span><span className="admin-top-user">{user?.email}</span></header>
      <div className="admin-content">
        <div className="admin-heading"><div><p className="admin-kicker">KHÔNG GIAN QUẢN TRỊ</p><h1>Quản lý tài khoản</h1><p>Theo dõi thành viên, phân quyền và trạng thái truy cập.</p></div><button className="admin-refresh" onClick={refresh} aria-label="Tải lại danh sách"><FiRefreshCw /> Tải lại</button></div>
        <div className="admin-stats"><div><span>Tổng tài khoản</span><strong>{data?.totalElements ?? '—'}</strong><small>Theo bộ lọc hiện tại</small></div><div><span>Đang hiển thị</span><strong>{accounts.length}</strong><small>Trang {page + 1}</small></div><div><span>Đã xác thực</span><strong>{accounts.filter((item) => item.verified).length}</strong><small>Trên trang hiện tại</small></div></div>
        <section className="admin-panel"><div className="admin-panel-head"><div><h2>Danh sách tài khoản</h2><p>Chọn vai trò hoặc khóa quyền truy cập trực tiếp trong bảng.</p></div></div>
          <div className="admin-filters"><label className="admin-search"><FiSearch /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên hoặc email" aria-label="Tìm tài khoản" /></label><select value={role} onChange={(event) => { setRole(event.target.value); setPage(0); }} aria-label="Lọc vai trò"><option value="ALL">Tất cả vai trò</option><option value="STUDENT">Sinh viên</option><option value="TEACHER">Giảng viên</option><option value="ADMIN">Quản trị viên</option></select></div>
          <div className="admin-table-wrap"><table><thead><tr><th>TÀI KHOẢN</th><th>VAI TRÒ</th><th>XÁC THỰC</th><th>TRUY CẬP</th><th>NGÀY TẠO</th></tr></thead><tbody>{accounts.map((account) => { const locked = savingId === account.userId || account.userId === user?.userId; return <tr key={account.userId}><td><div className="admin-person"><span className="admin-person-avatar">{account.fullName?.[0]?.toUpperCase() || '?'}</span><div><strong>{account.fullName}</strong><small>{account.email}</small></div></div></td><td><select value={account.role} disabled={locked} aria-label={`Vai trò của ${account.fullName}`} onChange={(event) => changeAccount(account, { role: event.target.value })}>{Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td><span className={account.verified ? 'admin-pill verified' : 'admin-pill pending'}>{account.verified ? 'Đã xác thực' : 'Chờ xác thực'}</span></td><td><button className={account.enabled ? 'admin-status enabled' : 'admin-status disabled'} disabled={locked} onClick={() => changeAccount(account, { enabled: !account.enabled })} aria-label={`${account.enabled ? 'Khóa' : 'Mở khóa'} ${account.fullName}`}>{account.enabled ? 'Hoạt động' : 'Đã khóa'}</button></td><td className="admin-date">{account.createdAt ? new Date(account.createdAt).toLocaleDateString('vi-VN') : '—'}</td></tr>; })}</tbody></table>{!loading && accounts.length === 0 && <div className="admin-empty">Không tìm thấy tài khoản phù hợp.</div>}{loading && <div className="admin-empty">Đang tải tài khoản...</div>}</div>
          <footer className="admin-pagination"><span>{data?.totalElements ?? 0} tài khoản</span><div><button disabled={page === 0 || loading} onClick={() => setPage(page - 1)} aria-label="Trang trước"><FiChevronLeft /></button><span>{page + 1} / {Math.max(data?.totalPages || 1, 1)}</span><button disabled={page + 1 >= (data?.totalPages || 1) || loading} onClick={() => setPage(page + 1)} aria-label="Trang sau"><FiChevronRight /></button></div></footer>
        </section>
      </div>
    </main>
  </div>;
}
