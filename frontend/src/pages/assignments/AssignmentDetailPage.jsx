import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { SmoothLink as Link, useWorkspaceNavigate as useNavigate } from '../../components/common/WorkspaceNavigation.jsx';
import { toast } from 'react-toastify';
import { assignmentService, templateService } from '../../services/assignmentService.js';
import { PageHeading, StatusTag, Notice, RubricTable, ConfirmDialog, sources, dateText, errorText } from '../../components/assignments/AssignmentUI.jsx';

export default function AssignmentDetailPage({ template = false }) {
  const { id } = useParams(), navigate = useNavigate();
  const [item, setItem] = useState(null), [error, setError] = useState(''), [action, setAction] = useState(null), [busy, setBusy] = useState(false);
  const base = template ? '/teacher/assignment-templates' : '/teacher/assignments';
  useEffect(() => { let active = true; setItem(null); setError(''); (template ? templateService : assignmentService).get(id).then((v) => { if (active) setItem(v); }).catch((e) => { if (active) setError(errorText(e)); }); return () => { active = false; }; }, [id, template]);
  const confirm = async () => {
    setBusy(true);
    try { if (action.type === 'delete') { await assignmentService.remove(id); navigate(base); } else setItem(await assignmentService.transition(id, action.type)); toast.success('Đã cập nhật bài tập'); setAction(null); }
    catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };
  if (!item) return <><Link to={base}>← Quay lại danh sách</Link><Notice error>{error}</Notice>{!error && <Notice>Đang tải…</Notice>}</>;
  const editable = !template && ['DRAFT', 'PUBLISHED'].includes(item.status);
  return <>
    <Link className="assignment-back" to={base}>← {template ? 'Thư viện mẫu' : 'Danh sách bài tập'}</Link>
    <PageHeading title={item.name || item.title}>{!template && <StatusTag status={item.status} />}{template && <Link className="primary button" to={`/teacher/assignments/new?templateId=${id}`}>Dùng mẫu này</Link>}</PageHeading>
    <section className="assignment-card"><h2>Thông tin chung</h2><dl className="assignment-info">
      <div><dt>Môn học</dt><dd>{item.subjectName}</dd></div><div><dt>Người tạo</dt><dd>{item.creator}</dd></div><div><dt>Cập nhật lần cuối</dt><dd>{dateText(item.updatedAt)}</dd></div><div><dt>Điểm tối đa</dt><dd>{item.maxScore ?? item.defaultMaxScore}</dd></div>
      {template ? <div><dt>Lượt sử dụng</dt><dd>{item.usageCount}</dd></div> : <><div><dt>Hạn nộp</dt><dd>{dateText(item.dueDate)}</dd></div><div><dt>Nguồn tạo</dt><dd>{sources[item.source]}</dd></div><div><dt>Mẫu bài tập</dt><dd>{item.templateName || '—'}</dd></div><div><dt>Định dạng nộp</dt><dd>{item.assignmentType === 'QUIZ' ? 'Trả lời trắc nghiệm' : item.allowedFileTypes?.join(', ') || 'Chưa giới hạn'}</dd></div></>}
    </dl></section>
    {item.assignmentType === 'QUIZ' && <section className="assignment-card"><h2>Trắc nghiệm · {item.questions?.length || 0} câu hỏi</h2>{item.questions?.map((q, i) => <div className="assignment-question" key={i}><h3>Câu {i + 1}: {q.text}</h3><p className="assignment-question-hint">{q.type === 'MULTIPLE' ? 'Chọn nhiều đáp án' : 'Chọn một đáp án'}</p><ol type="A">{q.options.map((o, j) => <li className={q.correctAnswers.includes(j) ? 'assignment-correct-answer' : ''} key={j}>{o}{q.correctAnswers.includes(j) && ' ✓'}</li>)}</ol></div>)}</section>}
    <section className="assignment-card"><h2>Nội dung bài tập</h2><p className="assignment-description">{item.description}</p></section>
    <section className="assignment-card"><div className="assignment-section-title"><h2>Tiêu chí chấm điểm</h2>{editable && <Link to={`${base}/${id}/edit#rubric`}>Quản lý rubric</Link>}</div><RubricTable rubric={item.rubric} /></section>
    {!template && item.status !== 'DRAFT' && <section className="assignment-card"><h2>Tình hình nộp bài</h2><p>{item.submissionCount ?? 'Chưa kết nối'} bài nộp / {item.enrolledCount ?? 'Chưa kết nối'} sinh viên ghi danh</p></section>}
    <div className="assignment-actions assignment-footer-actions">
      {item.status === 'DRAFT' && <button className="primary" onClick={() => setAction({ type: 'publish', message: 'Xuất bản để sinh viên đã ghi danh có thể xem bài tập?' })}>Xuất bản bài tập</button>}
      {editable && <Link className="button" to={`${base}/${id}/edit`}>Chỉnh sửa</Link>}
      {item.status === 'DRAFT' && <button className="assignment-danger" onClick={() => setAction({ type: 'delete', message: 'Xóa vĩnh viễn bản nháp này?' })}>Xóa bản nháp</button>}
      {item.status === 'PUBLISHED' && <button onClick={() => setAction({ type: 'close', message: 'Đóng bài tập này?' })}>Đóng bài tập</button>}
      {item.status === 'CLOSED' && <button onClick={() => setAction({ type: 'archive', message: 'Đưa bài tập vào lưu trữ?' })}>Lưu trữ</button>}
      <Link className="button" to={base}>Quay lại danh sách</Link>
    </div><ConfirmDialog action={action} busy={busy} onCancel={() => setAction(null)} onConfirm={confirm} />
  </>;
}
