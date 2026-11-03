import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { SmoothLink as Link, useWorkspaceNavigate as useNavigate } from '../../components/common/WorkspaceNavigation.jsx';
import { toast } from 'react-toastify';
import api from '../../services/api.js';
import { assignmentService, templateService } from '../../services/assignmentService.js';
import { PageHeading, StatusTag, Notice, RubricTable, ConfirmDialog, sources, dateText, errorText } from '../../components/assignments/AssignmentUI.jsx';

export default function AssignmentDetailPage({ template = false }) {
  const { id } = useParams(), navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [item, setItem] = useState(null), [error, setError] = useState(''), [action, setAction] = useState(null), [busy, setBusy] = useState(false);
  const [submissions, setSubmissions] = useState([]), [gradingError, setGradingError] = useState(''), [submissionFilter, setSubmissionFilter] = useState('ALL');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null), [submissionSearch, setSubmissionSearch] = useState('');
  const base = template ? '/teacher/assignment-templates' : '/teacher/assignments';
  const courseId = searchParams.get('subjectId') || item?.subjectId;
  const returnPath = template ? base : courseId ? `/courses/${courseId}?tab=assignments` : '/courses';
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

  useEffect(() => {
    if (template || !submissions.some((row) => row.aiEvaluationStatus === 'PENDING')) return;
    const timer = window.setInterval(() => api.get(`/teacher/assignments/${id}/submissions`).then(({ data }) => setSubmissions(Array.isArray(data) ? data : [])).catch(() => {}), 5000);
    return () => window.clearInterval(timer);
  }, [id, template, submissions]);

  const submitGrade = async (event, submission, moveNext = false) => {
    event.preventDefault(); setGradingError('');
    const values = new FormData(event.currentTarget);
    try {
      const { data } = await api.patch(`/teacher/assignments/${id}/submissions/${submission.submissionId}/grade`, { score: Number(values.get('score')), feedback: values.get('feedback') });
      setSubmissions((rows) => rows.map((row) => row.submissionId === data.submissionId ? data : row));
      toast.success('Đã lưu điểm và nhận xét');
      if (moveNext) {
        const currentIndex = visibleSubmissions.findIndex((row) => row.submissionId === submission.submissionId);
        const next = visibleSubmissions[currentIndex + 1];
        if (next) setSelectedSubmissionId(next.submissionId);
      }
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
    try { if (action.type === 'delete') { await assignmentService.remove(id); navigate(returnPath); } else setItem(await assignmentService.transition(id, action.type)); toast.success('Đã cập nhật bài tập'); setAction(null); }
    catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };
  if (!item) return <><Link to={courseId ? returnPath : base}>← Quay lại</Link><Notice error>{error}</Notice>{!error && <Notice>Đang tải…</Notice>}</>;
  const editable = !template && ['DRAFT', 'PUBLISHED'].includes(item.status);
  const gradingMode = !template && item.status !== 'DRAFT';
  const pendingCount = submissions.filter((submission) => submission.status !== 'TEACHER_REVIEWED').length;
  const reviewedCount = submissions.length - pendingCount;
  const visibleSubmissions = submissions.filter((submission) => {
    const matchesFilter = submissionFilter === 'ALL' || (submissionFilter === 'PENDING' ? submission.status !== 'TEACHER_REVIEWED' : submission.status === 'TEACHER_REVIEWED');
    const query = submissionSearch.trim().toLocaleLowerCase('vi');
    const matchesSearch = !query || `${submission.studentName} ${submission.studentEmail}`.toLocaleLowerCase('vi').includes(query);
    return matchesFilter && matchesSearch;
  });
  const selectedSubmission = visibleSubmissions.find((submission) => submission.submissionId === selectedSubmissionId) || visibleSubmissions[0] || null;
  const selectedIndex = selectedSubmission ? visibleSubmissions.findIndex((submission) => submission.submissionId === selectedSubmission.submissionId) : -1;
  return <>
    <Link className="assignment-back" to={returnPath}>← {template ? 'Thư viện mẫu' : courseId ? 'Bài tập của khóa học' : 'Danh sách khóa học'}</Link>
    {gradingMode ? <section className="assignment-card teacher-grading-hero"><div><span className="assignment-eyebrow">{item.subjectName || 'Bài tập của khóa học'}</span><div className="teacher-grading-hero-title"><h1>{item.name || item.title}</h1><StatusTag status={item.status} /></div><p>{item.description}</p><div className="teacher-grading-hero-meta"><span>Hạn nộp: {dateText(item.dueDate)}</span><span>Thang điểm: {item.maxScore} điểm</span></div></div><div className="teacher-grading-hero-actions"><Link className="button" to={returnPath}>← Danh sách bài tập</Link>{editable && <Link className="button" to={`${base}/${id}/edit${courseId ? `?subjectId=${courseId}` : ''}`}>Sửa bài tập</Link>}</div></section> : <PageHeading title={item.name || item.title}>{!template && <StatusTag status={item.status} />}{template && <Link className="primary button" to={`/teacher/assignments/new?templateId=${id}`}>Dùng mẫu này</Link>}</PageHeading>}
    {!gradingMode && <section className="assignment-card"><h2>Thông tin chung</h2><dl className="assignment-info">
      <div><dt>Môn học</dt><dd>{item.subjectName}</dd></div><div><dt>Người tạo</dt><dd>{item.creator}</dd></div><div><dt>Cập nhật lần cuối</dt><dd>{dateText(item.updatedAt)}</dd></div><div><dt>Điểm tối đa</dt><dd>{item.maxScore ?? item.defaultMaxScore}</dd></div>
      {template ? <div><dt>Lượt sử dụng</dt><dd>{item.usageCount}</dd></div> : <><div><dt>Hạn nộp</dt><dd>{dateText(item.dueDate)}</dd></div><div><dt>Nguồn tạo</dt><dd>{sources[item.source]}</dd></div><div><dt>Mẫu bài tập</dt><dd>{item.templateName || '—'}</dd></div><div><dt>Định dạng nộp</dt><dd>{item.assignmentType === 'QUIZ' ? 'Trả lời trắc nghiệm' : item.allowedFileTypes?.join(', ') || 'Chưa giới hạn'}</dd></div></>}
    </dl></section>}
    {!gradingMode && item.assignmentType === 'QUIZ' && <section className="assignment-card"><h2>Trắc nghiệm · {item.questions?.length || 0} câu hỏi</h2>{item.questions?.map((q, i) => <div className="assignment-question" key={i}><h3>Câu {i + 1}: {q.text}</h3><p className="assignment-question-hint">{q.type === 'MULTIPLE' ? 'Chọn nhiều đáp án' : 'Chọn một đáp án'}</p><ol type="A">{q.options.map((o, j) => <li className={q.correctAnswers.includes(j) ? 'assignment-correct-answer' : ''} key={j}>{o}{q.correctAnswers.includes(j) && ' ✓'}</li>)}</ol></div>)}</section>}
    {!gradingMode && <section className="assignment-card"><h2>Nội dung bài tập</h2><p className="assignment-description">{item.description}</p></section>}
    {!gradingMode && !!item.rubric?.length && <section className="assignment-card"><div className="assignment-section-title"><h2>Tiêu chí chấm điểm</h2>{editable && <Link to={`${base}/${id}/edit${courseId ? `?subjectId=${courseId}` : ''}#rubric`}>Quản lý rubric</Link>}</div><RubricTable rubric={item.rubric} /></section>}
    {gradingMode && <section className="assignment-card teacher-grading-summary"><div><strong>{item.enrolledCount ?? '—'}</strong><span>Sinh viên ghi danh</span></div><div><strong>{item.submissionCount ?? submissions.length}</strong><span>Bài đã nộp</span></div><div className="is-pending"><strong>{pendingCount}</strong><span>Chờ chấm</span></div><div className="is-reviewed"><strong>{reviewedCount}</strong><span>Đã chấm</span></div></section>}
    {!template && item.status !== 'DRAFT' && <section className="assignment-card teacher-grading-panel teacher-grading-workspace">
      <div className="teacher-grading-heading"><div><p className="assignment-eyebrow">CHẤM BÀI</p><h2>Bài nộp của sinh viên</h2><p>Chọn một bài nộp để xem nội dung, nhập điểm và gửi phản hồi.</p></div>
        <div className="teacher-submission-filters" role="group" aria-label="Lọc bài nộp">{[['ALL', `Tất cả ${submissions.length}`], ['PENDING', `Chờ chấm ${pendingCount}`], ['REVIEWED', `Đã chấm ${reviewedCount}`]].map(([value, label]) => <button type="button" key={value} className={submissionFilter === value ? 'is-active' : ''} aria-pressed={submissionFilter === value} onClick={() => setSubmissionFilter(value)}>{label}</button>)}</div>
      </div>
      <Notice error>{gradingError}</Notice>
      {!submissions.length ? <div className="assignment-empty"><strong>Chưa có bài nộp</strong><p>Bài làm sẽ xuất hiện tại đây sau khi sinh viên nộp.</p></div> : <div className="teacher-grading-toolbar"><label className="teacher-submission-search"><span className="sr-only">Tìm sinh viên</span><input type="search" value={submissionSearch} onChange={(event) => setSubmissionSearch(event.target.value)} placeholder="Tìm theo tên hoặc email sinh viên" /></label><span>{visibleSubmissions.length} bài nộp</span></div>}
      {!!submissions.length && !visibleSubmissions.length ? <p className="assignment-empty">Không tìm thấy bài nộp phù hợp.</p> : !!selectedSubmission && <div className="teacher-grading-columns">
        <nav className="teacher-submission-queue" aria-label="Danh sách bài nộp">{visibleSubmissions.map((submission) => <button type="button" key={submission.submissionId} className={`teacher-submission-option${selectedSubmission.submissionId === submission.submissionId ? ' is-selected' : ''}`} aria-current={selectedSubmission.submissionId === submission.submissionId ? 'true' : undefined} onClick={() => setSelectedSubmissionId(submission.submissionId)}><span className="teacher-submission-avatar">{submission.studentName?.trim()?.charAt(0)?.toLocaleUpperCase('vi') || 'S'}</span><span className="teacher-submission-option-copy"><strong>{submission.studentName}</strong><small>{dateText(submission.submittedAt)}</small></span><StatusTag status={submission.status} /></button>)}</nav>
        <article className="teacher-grading-detail" key={selectedSubmission.submissionId}>
          <header className="teacher-grading-student"><div><span className="assignment-eyebrow">ĐANG CHẤM BÀI</span><h3>{selectedSubmission.studentName}</h3><p>{selectedSubmission.studentEmail} · Nộp lúc {dateText(selectedSubmission.submittedAt)}</p></div><div className="teacher-grading-stepper"><button type="button" aria-label="Bài nộp trước" disabled={selectedIndex <= 0} onClick={() => setSelectedSubmissionId(visibleSubmissions[selectedIndex - 1]?.submissionId)}>←</button><span>{selectedIndex + 1} / {visibleSubmissions.length}</span><button type="button" aria-label="Bài nộp tiếp theo" disabled={selectedIndex < 0 || selectedIndex >= visibleSubmissions.length - 1} onClick={() => setSelectedSubmissionId(visibleSubmissions[selectedIndex + 1]?.submissionId)}>→</button></div></header>
          <div className="teacher-submission-content"><div className="teacher-submission-content-heading"><h4>Tài liệu và nội dung nộp</h4><StatusTag status={selectedSubmission.status} /></div>
            {(selectedSubmission.autoScore != null || selectedSubmission.aiEvaluationStatus) && <aside className="teacher-ai-result"><strong>{item.assignmentType === 'QUIZ' ? 'Kết quả tự chấm trắc nghiệm' : 'Đánh giá tham khảo từ AI'}</strong>{selectedSubmission.autoScore != null ? <p>{selectedSubmission.autoScore}/{item.maxScore} · {selectedSubmission.autoFeedback}</p> : <p>{selectedSubmission.aiEvaluationStatus === 'PENDING' ? 'AI đang xử lý bài nộp…' : selectedSubmission.aiEvaluationStatus === 'COMPLETED' ? `${selectedSubmission.aiScore}/${item.maxScore} · ${selectedSubmission.aiFeedback}` : selectedSubmission.aiEvaluationStatus === 'UNSUPPORTED' ? 'Định dạng chưa được hỗ trợ; vui lòng chấm thủ công.' : selectedSubmission.aiEvaluationStatus === 'FAILED' ? 'AI chưa đánh giá được bài này; vui lòng chấm thủ công.' : 'Không cần đánh giá AI.'}</p>}</aside>}
            {selectedSubmission.submissionText && <pre className="teacher-submission-text">{(() => { if (item.assignmentType !== 'QUIZ') return selectedSubmission.submissionText; try { const answers = JSON.parse(selectedSubmission.submissionText); return answers.map((indices, index) => `${index + 1}. ${(indices || []).map((choice) => item.questions?.[index]?.options?.[choice]).filter(Boolean).join(', ')}`).join('\n'); } catch { return selectedSubmission.submissionText; } })()}</pre>}
            {selectedSubmission.fileName && <button className="teacher-submission-file" type="button" onClick={() => downloadFile(selectedSubmission)}>↓ Tải tệp · {selectedSubmission.fileName}</button>}
            {!selectedSubmission.submissionText && !selectedSubmission.fileName && <p className="teacher-submission-missing">Sinh viên chưa đính kèm nội dung hoặc tệp.</p>}
          </div>
          <form className="teacher-grade-form teacher-grade-form-detail" onSubmit={(event) => submitGrade(event, selectedSubmission)}><div className="teacher-grade-title"><div><h4>Đánh giá và cho điểm</h4><p>Điểm tối đa: {item.maxScore} điểm</p></div>{selectedSubmission.teacherScore != null && <strong>{selectedSubmission.teacherScore}<small> / {item.maxScore}</small></strong>}</div><label>Điểm số<input name="score" type="number" min="0" max={item.maxScore} step="0.01" required defaultValue={selectedSubmission.teacherScore ?? ''} placeholder={`0 – ${item.maxScore}`} /></label><label>Nhận xét cho sinh viên<textarea name="feedback" rows="5" maxLength="8000" defaultValue={selectedSubmission.teacherFeedback || ''} placeholder="Nêu điểm làm tốt và góp ý cụ thể để sinh viên cải thiện…" /></label><div className="teacher-grade-actions"><button className="primary">{selectedSubmission.status === 'TEACHER_REVIEWED' ? 'Lưu cập nhật' : 'Lưu điểm và nhận xét'}</button><button type="button" disabled={selectedIndex >= visibleSubmissions.length - 1} onClick={(event) => { const form = event.currentTarget.form; if (form?.reportValidity()) submitGrade({ preventDefault() {}, currentTarget: form }, selectedSubmission, true); }}>Lưu và chấm bài tiếp theo</button></div></form>
        </article>
      </div>}
    </section>}
    <div className="assignment-actions assignment-footer-actions">
      {item.status === 'DRAFT' && <button className="primary" onClick={() => setAction({ type: 'publish', message: 'Xuất bản để sinh viên đã ghi danh có thể xem bài tập?' })}>Xuất bản bài tập</button>}
      {editable && !gradingMode && <Link className="button" to={`${base}/${id}/edit${courseId ? `?subjectId=${courseId}` : ''}`}>Chỉnh sửa</Link>}
      {item.status === 'DRAFT' && <button className="assignment-danger" onClick={() => setAction({ type: 'delete', message: 'Xóa vĩnh viễn bản nháp này?' })}>Xóa bản nháp</button>}
      {item.status === 'PUBLISHED' && <button onClick={() => setAction({ type: 'close', message: 'Đóng bài tập này?' })}>Đóng bài tập</button>}
      {item.status === 'CLOSED' && <button onClick={() => setAction({ type: 'archive', message: 'Đưa bài tập vào lưu trữ?' })}>Lưu trữ</button>}
      {!gradingMode && <Link className="button" to={returnPath}>Quay lại</Link>}
    </div><ConfirmDialog action={action} busy={busy} onCancel={() => setAction(null)} onConfirm={confirm} />
  </>;
}
