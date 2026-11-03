import { useEffect, useRef, useState } from 'react';
import { FiArrowLeft, FiBookOpen, FiCalendar, FiCheckCircle, FiClipboard, FiFileText } from 'react-icons/fi';
import api from '../../services/api.js';
import { filterAssignmentsByCourse } from './studentLearning.js';
import './student-assignments.css';

const formatDate = (value) => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Chưa có hạn';

export default function StudentAssignments({ courseId = null }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submission, setSubmission] = useState(null);
  const [submissionText, setSubmissionText] = useState('');
  const [answers, setAnswers] = useState([]);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef(null);

  useEffect(() => {
    if (!selected?.id) return;
    let active = true;
    Promise.all([api.get(`/student/assignments/${selected.id}`), api.get(`/student/assignments/${selected.id}/submission`)]).then(([detail, result]) => {
      if (!active) return;
      setSelected(detail.data); setSubmission(result.data);
      setItems((rows) => rows.map((row) => row.id === selected.id ? { ...row, submissionStatus: result.data?.status || null, submittedAt: result.data?.submittedAt || null } : row));
      setSubmissionText(result.data?.submissionText || '');
      if (detail.data.assignmentType === 'QUIZ') {
        try { setAnswers(result.data?.submissionText ? JSON.parse(result.data.submissionText) : detail.data.questions.map(() => [])); }
        catch { setAnswers(detail.data.questions.map(() => [])); }
      }
    }).catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Không thể tải chi tiết bài tập.'); });
    return () => { active = false; };
  }, [selected?.id]);

  useEffect(() => {
    if (!selected?.id || !submission || submission.status === 'TEACHER_REVIEWED' || submission.aiEvaluationStatus !== 'PENDING') return;
    const timer = window.setInterval(() => api.get(`/student/assignments/${selected.id}/submission`).then(({ data }) => { if (data) setSubmission(data); }).catch(() => {}), 5000);
    return () => window.clearInterval(timer);
  }, [selected?.id, submission?.submissionId, submission?.status, submission?.aiEvaluationStatus]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setSelected(null); setError('');
    api.get('/student/assignments').then(({ data }) => { if (active) setItems(Array.isArray(data) ? data : []); })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Không thể tải bài tập.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [courseId]);

  if (loading) return <p className="sa-message">Đang tải bài tập…</p>;
  if (error) return <p className="sa-message" role="alert">{error}</p>;
  const saveSubmission = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    const form = new FormData();
    form.append('submissionText', selected.assignmentType === 'QUIZ' ? JSON.stringify(answers) : submissionText);
    if (file) form.append('file', file);
    try {
      // api.js interceptor tự gắn token và refresh nếu cần.
      const { data } = await api.post(`/student/assignments/${selected.id}/submission`, form);
      setSubmission(data); setItems((rows) => rows.map((row) => row.id === selected.id ? { ...row, submissionStatus: data.status, submittedAt: data.submittedAt } : row)); setFile(null); if (fileInput.current) fileInput.current.value = '';
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Kh\u00f4ng th\u1ec3 n\u1ed9p b\u00e0i. Vui l\u00f2ng th\u1eed l\u1ea1i.');
    }
    finally { setSaving(false); }
  };

  const toggleAnswer = (questionIndex, optionIndex, type) => setAnswers((current) => {
    const next = [...current]; const selectedOptions = next[questionIndex] || [];
    next[questionIndex] = type === 'SINGLE' ? [optionIndex] : selectedOptions.includes(optionIndex) ? selectedOptions.filter((value) => value !== optionIndex) : [...selectedOptions, optionIndex];
    return next;
  });

  const downloadSubmission = async () => {
    try {
      const { data } = await api.get(`/student/assignments/${selected.id}/submission/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(data); const link = document.createElement('a'); link.href = url; link.download = submission.fileName || 'bai-nop'; link.click(); URL.revokeObjectURL(url);
    } catch (requestError) { setError(requestError.response?.data?.message || 'Không thể tải tệp bài nộp.'); }
  };

  const visibleItems = filterAssignmentsByCourse(items, courseId);

  if (selected) {
    const isPastDeadline = selected.dueDate && new Date(selected.dueDate).getTime() <= Date.now();
    const isLocked = submission?.status === 'TEACHER_REVIEWED' || selected.status === 'CLOSED' || isPastDeadline;
    const isReviewed = submission?.status === 'TEACHER_REVIEWED';
    const scorePercent = submission?.teacherScore != null && Number(selected.maxScore) > 0
      ? Math.max(0, Math.min(100, Number(submission.teacherScore) / Number(selected.maxScore) * 100))
      : null;
    return <div className="student-assignments">
    <button className="sa-back" onClick={() => setSelected(null)}><FiArrowLeft /> Trở lại bài tập</button>
    <div className="sa-detail"><div className="sa-detail-head"><span>{selected.subjectName}</span><h2>{selected.title}</h2><p><FiCalendar /> Hạn nộp: {formatDate(selected.dueDate)}</p></div>
      {error && <p className="sa-error" role="alert">{error}</p>}
      <section><h3>Yêu cầu bài tập</h3><p className="sa-description">{selected.description}</p></section>
      <form className="sa-submit-form" onSubmit={saveSubmission}>
        {selected.assignmentType === 'QUIZ' ? <section><h3>Câu hỏi</h3>{selected.questions?.map((question, index) => <fieldset className="sa-question" key={index}><legend>{index + 1}. {question.text}</legend><p>{question.type === 'MULTIPLE' ? 'Chọn các đáp án phù hợp' : 'Chọn một đáp án'}</p>{question.options.map((option, optionIndex) => <label key={optionIndex}><input type={question.type === 'MULTIPLE' ? 'checkbox' : 'radio'} name={`question-${index}`} checked={(answers[index] || []).includes(optionIndex)} disabled={isLocked} onChange={() => toggleAnswer(index, optionIndex, question.type)} />{option}</label>)}</fieldset>)}</section> : <section><h3>Bài làm</h3><p>Điểm tối đa: {selected.maxScore} · Định dạng cho phép: {selected.allowedFileTypes?.join(', ')}</p><label className="sa-field">Nội dung trả lời<textarea rows="7" maxLength="100000" value={submissionText} disabled={isLocked} onChange={(event) => setSubmissionText(event.target.value)} placeholder="Nhập câu trả lời hoặc hướng dẫn tới tệp đính kèm." /></label><label className="sa-field">Tệp đính kèm<input ref={fileInput} type="file" accept={selected.allowedFileTypes?.map((type) => `.${type.toLowerCase()}`).join(',')} disabled={isLocked} onChange={(event) => setFile(event.target.files?.[0] || null)} /></label></section>}
        {submission && (isReviewed ? <section className="sa-reviewed-result" aria-labelledby="sa-reviewed-title"><div className="sa-result-score"><span>KẾT QUẢ CHẤM CUỐI</span><strong>{submission.teacherScore ?? '—'}<small> / {selected.maxScore}</small></strong>{scorePercent != null && <div className="sa-score-track"><i style={{ width: `${scorePercent}%` }} /></div>}<b><FiCheckCircle /> Giảng viên đã đánh giá</b></div><div className="sa-result-feedback"><h3 id="sa-reviewed-title">Nhận xét của giảng viên</h3>{submission.teacherFeedback ? <blockquote>{submission.teacherFeedback}</blockquote> : <p>Giảng viên chưa để lại nhận xét.</p>}{submission.aiFeedback && <><h3>Đánh giá tham khảo từ AI · {submission.aiScore}/{selected.maxScore}</h3><blockquote>{submission.aiFeedback}</blockquote></>}<div className="sa-result-submission"><span>{submission.submittedAt ? `Đã nộp ${formatDate(submission.submittedAt)}` : 'Đã nộp bài'}</span>{submission.fileName && <button type="button" onClick={downloadSubmission}>{submission.fileName} · Tải xuống</button>}</div></div></section> : <div className="sa-submission-state"><strong>✓ Nộp bài thành công · Đang chờ giảng viên chấm</strong>{submission.submittedAt && <span>Nộp lúc {formatDate(submission.submittedAt)}</span>}{submission.aiEvaluationStatus === 'PENDING' && <span>AI đang đánh giá bài nộp. Kết quả tham khảo sẽ được gửi cho giảng viên.</span>}{submission.aiEvaluationStatus === 'COMPLETED' && <span>AI đã hoàn tất đánh giá và gửi kết quả tham khảo cho giảng viên. Điểm sẽ hiện sau khi giảng viên xác nhận.</span>}{submission.aiEvaluationStatus === 'FAILED' && <span>AI chưa thể đánh giá bài này; giảng viên sẽ chấm thủ công.</span>}{submission.aiEvaluationStatus === 'UNSUPPORTED' && <span>Định dạng chưa được AI hỗ trợ; giảng viên sẽ chấm thủ công.</span>}{submission.fileName && <button type="button" onClick={downloadSubmission}>{submission.fileName} · Tải xuống</button>}</div>)}
        {selected.status === 'PUBLISHED' && !isPastDeadline && submission?.status !== 'TEACHER_REVIEWED' && <button className="sa-submit-button" disabled={saving}>{saving ? 'Đang nộp…' : submission ? 'Cập nhật bài nộp' : 'Nộp bài'}</button>}
        {selected.status === 'CLOSED' && <p className="sa-note">Bài tập đã đóng, không thể nộp thêm hoặc sửa bài.</p>}
        {selected.status === 'PUBLISHED' && isPastDeadline && <p className="sa-note">Bài tập đã quá hạn, không thể nộp thêm hoặc sửa bài.</p>}
      </form>
    </div>
  </div>;
  }
  return <div className="student-assignments"><div className="sa-heading"><div><p>BÀI TẬP KHÓA HỌC</p><h2>{courseId == null ? 'Danh sách bài tập' : 'Bài tập của khóa học'}</h2></div><span>{visibleItems.length} bài tập</span></div>
    {!visibleItems.length ? <div className="sa-empty"><FiClipboard /><h3>Chưa có bài tập</h3><p>{courseId == null ? 'Bài tập đã công bố của các khóa học bạn đang học sẽ xuất hiện tại đây.' : 'Giảng viên chưa giao bài tập trong khóa học này.'}</p></div> : <div className="sa-list">{visibleItems.map((item) => <button className="sa-card" key={item.id} onClick={() => setSelected(item)}><span className="sa-card-icon">{item.assignmentType === 'QUIZ' ? <FiClipboard /> : <FiFileText />}</span><span className="sa-card-body"><small><FiBookOpen /> {item.subjectName}</small><strong>{item.title}</strong><span>{item.assignmentType === 'QUIZ' ? 'Trắc nghiệm' : 'Bài tập tài liệu'} · {item.submissionStatus === 'TEACHER_REVIEWED' ? 'Đã chấm' : item.submissionStatus ? 'Đã nộp' : item.status === 'CLOSED' ? 'Đã đóng' : 'Chưa nộp'}</span></span><span className="sa-card-due"><FiCalendar /> {formatDate(item.dueDate)}</span></button>)}</div>}
  </div>;
}
