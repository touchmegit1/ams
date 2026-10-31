import { useEffect, useState } from 'react';
import { SmoothLink as Link } from '../../components/common/WorkspaceNavigation.jsx';
import { toast } from 'react-toastify';
import { assignmentService, templateService } from '../../services/assignmentService.js';
import { PageHeading, StatusTag, Notice, ConfirmDialog, Pagination, statuses, sources, dateText, errorText } from '../../components/assignments/AssignmentUI.jsx';

const blank = { keyword: '', subjectId: '', source: '', status: '' };
export default function AssignmentListPage({ templates = false }) {
  const [filters, setFilters] = useState(blank), [search, setSearch] = useState(blank);
  const [subjects, setSubjects] = useState([]), [data, setData] = useState({ content: [] }), [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [refresh, setRefresh] = useState(0);
  const [action, setAction] = useState(null), [busy, setBusy] = useState(false);
  const base = templates ? '/teacher/assignment-templates' : '/teacher/assignments';
  useEffect(() => { let active = true; assignmentService.subjects().then((s) => { if (active) setSubjects(s); }).catch((e) => { if (active) setError(errorText(e)); }); return () => { active = false; }; }, []);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    const params = Object.fromEntries(Object.entries({ ...search, page, size: 10 }).filter(([, v]) => v !== ''));
    (templates ? templateService : assignmentService).list(params).then((result) => { if (active) setData(result); }).catch((e) => { if (active) setError(errorText(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [search, page, templates, refresh]);
  const change = (e) => setFilters({ ...filters, [e.target.name]: e.target.value });
  const confirm = async () => {
    setBusy(true);
    try { if (action.type === 'delete') await assignmentService.remove(action.id); else await assignmentService.transition(action.id, action.type); toast.success('Đã cập nhật bài tập'); setAction(null); setRefresh((v) => v + 1); }
    catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };
  return <>
    <PageHeading title={templates ? 'Thư viện mẫu bài tập' : 'Bài tập môn học'}>{!templates && <Link className="primary button" to={`${base}/new`}>+ Tạo bài tập</Link>}</PageHeading>
    <p className="assignment-intro">{templates ? 'Chọn một mẫu phù hợp, điều chỉnh nội dung và giao cho lớp của bạn.' : 'Soạn đề, thiết lập tiêu chí và xuất bản bài tập cho sinh viên.'}</p>
    <form className="assignment-filters" onSubmit={(e) => { e.preventDefault(); setPage(0); setSearch({ ...filters }); }}>
      <input aria-label="Tìm theo tên" name="keyword" placeholder={templates ? 'Tìm mẫu bài tập…' : 'Tìm tên bài tập…'} value={filters.keyword} onChange={change} />
      <select aria-label="Môn học" name="subjectId" value={filters.subjectId} onChange={change}><option value="">Tất cả môn học</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      {!templates && <><select aria-label="Nguồn tạo" name="source" value={filters.source} onChange={change}><option value="">Tất cả nguồn</option>{Object.entries(sources).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select><select aria-label="Trạng thái" name="status" value={filters.status} onChange={change}><option value="">Trạng thái hiện tại</option>{Object.entries(statuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></>}
      <button className="primary">Tìm kiếm</button><button type="button" onClick={() => { setFilters(blank); setSearch({ ...blank }); setPage(0); }}>Đặt lại</button>
    </form>
    <Notice error>{error}</Notice>
    <section className="assignment-card" aria-busy={loading}>
      {loading ? <p className="assignment-empty" role="status">Đang tải…</p> : error ? <div className="assignment-empty"><button onClick={() => setRefresh((v) => v + 1)}>Thử lại</button></div> : data.content.length === 0 ? <div className="assignment-empty"><h2>{templates ? 'Chưa có mẫu phù hợp' : 'Chưa có bài tập'}</h2><p>{templates ? 'Mẫu bài tập do quản trị viên cung cấp.' : 'Tạo bài tập đầu tiên hoặc thay đổi bộ lọc tìm kiếm.'}</p></div> : <div className="assignment-table-wrap"><table><thead><tr><th>{templates ? 'Tên mẫu' : 'Bài tập'}</th><th>Môn học</th><th>{templates ? 'Người tạo' : 'Nguồn'}</th><th>{templates ? 'Cập nhật' : 'Hạn nộp'}</th><th>{templates ? 'Lượt dùng' : 'Điểm tối đa'}</th>{!templates && <th>Trạng thái</th>}<th>Thao tác</th></tr></thead><tbody>{data.content.map((a) => <tr key={a.id}>
        <td><Link className="assignment-title-link" to={`${base}/${a.id}`}>{a.name || a.title}</Link>{!templates && <span className="assignment-kind">{a.assignmentType === 'QUIZ' ? 'Trắc nghiệm' : 'Tự luận / tài liệu'}</span>}</td><td>{a.subjectName}</td><td>{templates ? a.creator : sources[a.source]}</td><td>{dateText(templates ? a.updatedAt : a.dueDate)}</td><td>{templates ? a.usageCount : a.maxScore}</td>{!templates && <td><StatusTag status={a.status} /></td>}
        <td><div className="assignment-row-actions"><Link to={`${base}/${a.id}`}>Xem</Link>{templates ? <Link to={`/teacher/assignments/new?templateId=${a.id}`}>Dùng mẫu</Link> : <>
          {['DRAFT', 'PUBLISHED'].includes(a.status) && <Link to={`${base}/${a.id}/edit`}>Sửa</Link>}
          {a.status === 'DRAFT' && <button onClick={() => setAction({ id: a.id, type: 'delete', message: `Xóa bản nháp “${a.title}”?` })}>Xóa</button>}
          {a.status === 'PUBLISHED' && <button onClick={() => setAction({ id: a.id, type: 'close', message: `Đóng bài tập “${a.title}”?` })}>Đóng</button>}
          {a.status === 'CLOSED' && <button onClick={() => setAction({ id: a.id, type: 'archive', message: `Lưu trữ bài tập “${a.title}”?` })}>Lưu trữ</button>}
        </>}</div></td></tr>)}</tbody></table></div>}
      {!loading && !error && <Pagination data={data} page={page} onChange={setPage} />}
    </section><ConfirmDialog action={action} busy={busy} onCancel={() => setAction(null)} onConfirm={confirm} />
  </>;
}
