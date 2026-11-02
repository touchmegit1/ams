import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { SmoothLink as Link, useWorkspaceNavigate as useNavigate } from '../../components/common/WorkspaceNavigation.jsx';
import { toast } from 'react-toastify';
import api from '../../services/api.js';
import { assignmentService, templateService } from '../../services/assignmentService.js';
import { PageHeading, StatusTag, Notice, RubricTable, ConfirmDialog, sources, dateText, errorText } from '../../components/assignments/AssignmentUI.jsx';

export default function AssignmentDetailPage({ template = false }) {
  const { id } = useParams(), navigate = useNavigate();
  const [item, setItem] = useState(null), [error, setError] = useState(''), [action, setAction] = useState(null), [busy, setBusy] = useState(false);
  const [submissions, setSubmissions] = useState([]), [grading, setGrading] = useState({}), [gradingError, setGradingError] = useState('');
  const base = template ? '/teacher/assignment-templates' : '/teacher/assignments';
  useEffect(() => {
    let active = true; setItem(null); setError(''); setSubmissions([]);
    (template ? templateService : assignmentService).get(id).then(async (value) => {
      if (!active) return; setItem(value);
      if (!template && value.status !== 'DRAFT') {
        try { const { data } = await api.get(`/teacher/assignments/${id}/submissions`); if (active) setSubmissions(Array.isArray(data) ? data : []); }
        catch (e) { if (active) setGradingError(errorText(e)); }
      }
    }).catch((e) => { if (active) setError(errorText(e)); });
    return () => { active = false; };
  }, [id, template]);

  const submitGrade = async (event, submission) => {
    event.preventDefault(); setGradingError('');
    const values = new FormData(event.currentTarget);
    try {
      const { data } = await api.patch(`/teacher/assignments/${id}/submissions/${submission.submissionId}/grade`, { score: Number(values.get('score')), feedback: values.get('feedback') });
      setSubmissions((rows) => rows.map((row) => row.submissionId === data.submissionId ? data : row));
      toast.success('Đã lưu điểm và nhận xét');
    } catch (e) { setGradingError(errorText(e)); }
  };

  const downloadFile = async (submission) => {
    try {
      const { data } = await api.get(submission.downloadUrl, { responseType: 'blob' });
      const url = URL.createObjectURL(data); const anchor = document.createElement('a'); anchor.href = url; anchor.download = submission.fileName || 'bai-nop'; anchor.click(); URL.revokeObjectURL(url);
    } catch (e) { toast.error(errorText(e)); }
  };
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
    {!template && item.status !== 'DRAFT' && <section className="assignment-card"><h2>Bài nộp và chấm điểm</h2><Notice error>{gradingError}</Notice>{!submissions.length ? <p className="assignment-empty">Chưa có bài nộp.</p> : <div className="teacher-submission-list">{submissions.map((submission) => {
      let answerText = submission.submissionText;
      if (item.assignmentType === 'QUIZ') {
        try { const answers = JSON.parse(submission.submissionText); answerText = answers.map((indices, index) => `${index + 1}. ${(indices || []).map((choice) => item.questions?.[index]?.options?.[choice]).filter(Boolean).join(', ')}`).join('\n'); } catch { /* display the stored answer when legacy data is malformed */ }
      }
      return <article className="teacher-submission-card" key={submission.submissionId}><div className="teacher-submission-heading"><div><strong>{submission.studentName}</strong><span>{submission.studentEmail} · {dateText(submission.submittedAt)}</span></div><StatusTag status={submission.status} /></div>
        {answerText && <pre className="teacher-submission-text">{answerText}</pre>}
        {submission.fileName && <button className="teacher-submission-file" type="button" onClick={() => downloadFile(submission)}>Tải tệp: {submission.fileName}</button>}
        <form className="teacher-grade-form" onSubmit={(event) => submitGrade(event, submission)}><label>Điểm<input name="score" type="number" min="0" max={item.maxScore} step="0.01" required defaultValue={submission.teacherScore ?? ''} /></label><label>Nhận xét<textarea name="feedback" rows="3" maxLength="8000" defaultValue={submission.teacherFeedback || ''} placeholder="Ghi nhận xét cho sinh viên" /></label><button className="primary">{submission.status === 'TEACHER_REVIEWED' ? 'Cập nhật điểm' : 'Lưu điểm và nhận xét'}</button></form>
      </article>;
    })}</div>}</section>}
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
