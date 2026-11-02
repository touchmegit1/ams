import { useEffect, useState } from 'react';
import { FiArrowLeft, FiBookOpen, FiCalendar, FiClipboard, FiFileText } from 'react-icons/fi';
import { studentAssignmentService } from '../../services/assignmentService.js';
import { buildQuizAnswers, submissionStatusLabel, toSubmissionForm } from '../../utils/assignmentWorkflow.js';
import './student-assignments.css';

const formatDate = (value) => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Chưa có hạn';
const errorText = (error) => error.response?.data?.message || 'Không thể thực hiện thao tác. Vui lòng thử lại.';
const scoreText = (score, max) => score == null ? 'Chưa có điểm' : `${score} / ${max}`;

export default function StudentAssignments() {
  const [items, setItems] = useState([]), [selected, setSelected] = useState(null), [history, setHistory] = useState([]);
  const [answers, setAnswers] = useState({}), [notes, setNotes] = useState(''), [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const load = () => { setLoading(true); setError(''); studentAssignmentService.list().then(setItems).catch((e) => setError(errorText(e))).finally(() => setLoading(false)); };
  useEffect(load, []);

  const open = async (item) => {
    setSelected(null); setError(''); setAnswers({}); setNotes(''); setFiles([]); setBusy(true);
    try {
      const [detail, result] = await Promise.all([studentAssignmentService.get(item.id), studentAssignmentService.history(item.id)]);
      setSelected(detail); setHistory(result.attempts || []);
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };

  const submit = async (event) => {
    event.preventDefault(); if (!selected) return;
    setBusy(true); setError('');
    try {
      const quiz = selected.assignmentType === 'QUIZ';
      const payload = quiz ? buildQuizAnswers(answers).map((answer) => answer.selectedOptions) : null;
      const result = await studentAssignmentService.submit(selected.id, toSubmissionForm({ answers: payload, notes, files }));
      setHistory((current) => [...current, result]); setNotes(''); setFiles([]); setAnswers({});
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };

  if (loading) return <p className="sa-message">Đang tải bài tập…</p>;
  if (error && !items.length && !selected) return <div className="sa-message" role="alert"><p>{error}</p><button onClick={load}>Thử lại</button></div>;
  if (selected) {
    const latest = history.at(-1), isQuiz = selected.assignmentType === 'QUIZ';
    const canSubmit = selected.status === 'PUBLISHED' && (!selected.dueDate || new Date(selected.dueDate).getTime() > Date.now());
    return <div className="student-assignments">
      <button className="sa-back" onClick={() => { setSelected(null); setError(''); }}><FiArrowLeft /> Trở lại bài tập</button>
      {error && <p className="sa-error" role="alert">{error}</p>}
      <div className="sa-detail"><div className="sa-detail-head"><span>{selected.subjectName}</span><h2>{selected.title}</h2><p><FiCalendar /> Hạn nộp: {formatDate(selected.dueDate)} · Điểm tối đa: {selected.maxScore}</p></div>
        <section><h3>Yêu cầu bài tập</h3><p className="sa-description">{selected.description}</p></section>
        <form onSubmit={submit}>
          {isQuiz ? <section><h3>Câu hỏi</h3>{selected.questions?.map((question, index) => <fieldset className="sa-question" key={index}><legend>{index + 1}. {question.text}</legend><small>{question.type === 'MULTIPLE' ? 'Chọn tất cả đáp án đúng' : 'Chọn một đáp án'}</small>{question.options.map((option, optionIndex) => <label key={optionIndex}><input type={question.type === 'MULTIPLE' ? 'checkbox' : 'radio'} name={`q-${index}`} checked={(answers[index] || []).includes(optionIndex)} onChange={(event) => setAnswers((current) => {
            const previous = current[index] || [];
            const next = question.type === 'MULTIPLE' ? event.target.checked ? [...previous, optionIndex] : previous.filter((value) => value !== optionIndex) : [optionIndex];
            return { ...current, [index]: next };
          })} /> {option}</label>)}</fieldset>)}</section> : <section><h3>Nộp bài</h3><p>Định dạng được chấp nhận: {selected.allowedFileTypes?.join(', ') || 'Theo yêu cầu của giảng viên'} · Tối đa 5 tệp mỗi lần nộp.</p><label className="sa-field">Tệp bài làm<input type="file" multiple accept={selected.allowedFileTypes?.map((type) => `.${type.toLowerCase()}`).join(',')} onChange={(event) => setFiles([...event.target.files].slice(0, 5))} /></label>{files.length > 0 && <p>{files.map((file) => file.name).join(', ')}</p>}</section>}
          <label className="sa-field">Ghi chú cho giảng viên<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={8000} rows={3} /></label>
          <button className="sa-submit" disabled={!canSubmit || busy || (isQuiz && selected.questions?.some((_, index) => !(answers[index] || []).length)) || (!isQuiz && !files.length)}>{busy ? 'Đang gửi…' : isQuiz ? 'Nộp bài trắc nghiệm' : 'Nộp bài'}</button>
          {!canSubmit && <p className="sa-note">Bài tập đã đóng hoặc quá hạn, hiện không nhận bài mới.</p>}
        </form>
        <section><h3>Lịch sử nộp bài ({history.length})</h3>{!history.length ? <p>Chưa có lần nộp nào.</p> : history.map((attempt) => <article className="sa-attempt" key={attempt.id}><header><strong>Lần nộp {attempt.attemptNumber}</strong><span>{submissionStatusLabel(attempt.status)}</span><time>{formatDate(attempt.submittedAt)}</time></header><p>Điểm AI: {scoreText(attempt.aiScore, selected.maxScore)}{attempt.officialScore != null && ` · Điểm chính thức: ${scoreText(attempt.officialScore, selected.maxScore)}`}</p>{attempt.evaluationMessage && <p className="sa-error">{attempt.evaluationMessage}</p>}{attempt.aiFeedback?.summary && <p>{attempt.aiFeedback.summary}</p>}{attempt.aiFeedback?.items?.map((item, index) => <p className="sa-feedback-item" key={index}><strong>{item.criteria} ({item.score}/{item.maxScore}):</strong> {item.feedback}</p>)}{attempt.teacherFeedback && <p><strong>Nhận xét giảng viên:</strong> {attempt.teacherFeedback}</p>}{attempt.files?.map((file) => <p key={file.id}><FiFileText /> {file.name}</p>)}</article>)}</section>
        {latest?.status === 'AI_FAILED' && <p className="sa-note">Bài đã được lưu. Giảng viên có thể đánh giá thủ công hoặc chạy lại AI.</p>}
      </div>
    </div>;
  }
  return <div className="student-assignments"><div className="sa-heading"><div><p>BÀI TẬP KHÓA HỌC</p><h2>Danh sách bài tập</h2></div><span>{items.length} bài tập</span></div>
    {busy && <p className="sa-message">Đang mở bài tập…</p>}{error && <p className="sa-error" role="alert">{error}</p>}
    {!items.length ? <div className="sa-empty"><FiClipboard /><h3>Chưa có bài tập</h3><p>Bài tập đã công bố của các khóa học bạn đang học sẽ xuất hiện tại đây.</p></div> : <div className="sa-list">{items.map((item) => <button className="sa-card" key={item.id} onClick={() => open(item)}><span className="sa-card-icon">{item.assignmentType === 'QUIZ' ? <FiClipboard /> : <FiFileText />}</span><span className="sa-card-body"><small><FiBookOpen /> {item.subjectName}</small><strong>{item.title}</strong><span>{item.assignmentType === 'QUIZ' ? 'Trắc nghiệm' : 'Bài tập tài liệu'} · {item.status === 'CLOSED' ? 'Đã đóng' : 'Đang mở'}</span></span><span className="sa-card-due"><FiCalendar /> {formatDate(item.dueDate)}</span></button>)}</div>}
  </div>;
}
