import { useEffect, useRef, useState } from 'react';
import { FiArrowLeft, FiBookOpen, FiCalendar, FiClipboard, FiFileText } from 'react-icons/fi';
import api from '../../services/api.js';
import './student-assignments.css';

const formatDate = (value) => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Chưa có hạn';

export default function StudentAssignments() {
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
      setSubmissionText(result.data?.submissionText || '');
      if (detail.data.assignmentType === 'QUIZ') {
        try { setAnswers(result.data?.submissionText ? JSON.parse(result.data.submissionText) : detail.data.questions.map(() => [])); }
        catch { setAnswers(detail.data.questions.map(() => [])); }
      }
    }).catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Không thể tải chi tiết bài tập.'); });
    return () => { active = false; };
  }, [selected?.id]);

  useEffect(() => {
    let active = true;
    api.get('/student/assignments').then(({ data }) => { if (active) setItems(Array.isArray(data) ? data : []); })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Không thể tải bài tập.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <p className="sa-message">Đang tải bài tập…</p>;
  if (error) return <p className="sa-message" role="alert">{error}</p>;
  const saveSubmission = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    const form = new FormData();
    form.append('submissionText', selected.assignmentType === 'QUIZ' ? JSON.stringify(answers) : submissionText);
    if (file) form.append('file', file);
    try {
      const { data } = await api.post(`/student/assignments/${selected.id}/submission`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSubmission(data); setFile(null); if (fileInput.current) fileInput.current.value = '';
    } catch (requestError) { setError(requestError.response?.data?.message || 'Không thể nộp bài.'); }
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

  if (selected) return <div className="student-assignments">
    <button className="sa-back" onClick={() => setSelected(null)}><FiArrowLeft /> Trở lại bài tập</button>
    <div className="sa-detail"><div className="sa-detail-head"><span>{selected.subjectName}</span><h2>{selected.title}</h2><p><FiCalendar /> Hạn nộp: {formatDate(selected.dueDate)}</p></div>
      {error && <p className="sa-error" role="alert">{error}</p>}
      <section><h3>Yêu cầu bài tập</h3><p className="sa-description">{selected.description}</p></section>
      <form className="sa-submit-form" onSubmit={saveSubmission}>
        {selected.assignmentType === 'QUIZ' ? <section><h3>Câu hỏi</h3>{selected.questions?.map((question, index) => <fieldset className="sa-question" key={index}><legend>{index + 1}. {question.text}</legend><p>{question.type === 'MULTIPLE' ? 'Chọn các đáp án phù hợp' : 'Chọn một đáp án'}</p>{question.options.map((option, optionIndex) => <label key={optionIndex}><input type={question.type === 'MULTIPLE' ? 'checkbox' : 'radio'} name={`question-${index}`} checked={(answers[index] || []).includes(optionIndex)} disabled={submission?.status === 'TEACHER_REVIEWED' || selected.status === 'CLOSED'} onChange={() => toggleAnswer(index, optionIndex, question.type)} />{option}</label>)}</fieldset>)}</section> : <section><h3>Bài làm</h3><p>Điểm tối đa: {selected.maxScore} · Định dạng cho phép: {selected.allowedFileTypes?.join(', ')}</p><label className="sa-field">Nội dung trả lời<textarea rows="7" maxLength="100000" value={submissionText} disabled={submission?.status === 'TEACHER_REVIEWED' || selected.status === 'CLOSED'} onChange={(event) => setSubmissionText(event.target.value)} placeholder="Nhập câu trả lời hoặc hướng dẫn tới tệp đính kèm." /></label><label className="sa-field">Tệp đính kèm<input ref={fileInput} type="file" accept={selected.allowedFileTypes?.map((type) => `.${type.toLowerCase()}`).join(',')} disabled={submission?.status === 'TEACHER_REVIEWED' || selected.status === 'CLOSED'} onChange={(event) => setFile(event.target.files?.[0] || null)} /></label></section>}
        {submission && <div className="sa-submission-state"><strong>{submission.status === 'TEACHER_REVIEWED' ? 'Đã chấm' : 'Đã nộp bài'}</strong>{submission.submittedAt && <span>Nộp lúc {formatDate(submission.submittedAt)}</span>}{submission.fileName && <button type="button" onClick={downloadSubmission}>{submission.fileName} · Tải xuống</button>}{submission.teacherScore != null && <p>Điểm: <b>{submission.teacherScore}/{selected.maxScore}</b></p>}{submission.teacherFeedback && <p>Nhận xét: {submission.teacherFeedback}</p>}</div>}
        {selected.status === 'PUBLISHED' && new Date(selected.dueDate).getTime() > Date.now() && submission?.status !== 'TEACHER_REVIEWED' && <button className="sa-submit-button" disabled={saving}>{saving ? 'Đang nộp…' : submission ? 'Cập nhật bài nộp' : 'Nộp bài'}</button>}
        {selected.status === 'CLOSED' && <p className="sa-note">Bài tập đã đóng, không thể nộp thêm hoặc sửa bài.</p>}
      </form>
    </div>
  </div>;
  return <div className="student-assignments"><div className="sa-heading"><div><p>BÀI TẬP KHÓA HỌC</p><h2>Danh sách bài tập</h2></div><span>{items.length} bài tập</span></div>
    {!items.length ? <div className="sa-empty"><FiClipboard /><h3>Chưa có bài tập</h3><p>Bài tập đã công bố của các khóa học bạn đang học sẽ xuất hiện tại đây.</p></div> : <div className="sa-list">{items.map((item) => <button className="sa-card" key={item.id} onClick={() => setSelected(item)}><span className="sa-card-icon">{item.assignmentType === 'QUIZ' ? <FiClipboard /> : <FiFileText />}</span><span className="sa-card-body"><small><FiBookOpen /> {item.subjectName}</small><strong>{item.title}</strong><span>{item.assignmentType === 'QUIZ' ? 'Trắc nghiệm' : 'Bài tập tài liệu'} · {item.status === 'CLOSED' ? 'Đã đóng' : 'Đang mở'}</span></span><span className="sa-card-due"><FiCalendar /> {formatDate(item.dueDate)}</span></button>)}</div>}
  </div>;
}
