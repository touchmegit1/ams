import { useEffect, useRef, useState } from 'react';
import { FiArrowLeft, FiAward, FiBookOpen, FiCalendar, FiCheckCircle, FiClipboard, FiClock, FiDownload, FiFileText, FiMessageSquare } from 'react-icons/fi';
import api from '../../services/api.js';
import { filterAssignmentsByCourse } from './studentLearning.js';
import './student-assignments.css';

const DEFAULT_ALLOWED_TYPES = ['PDF', 'DOC', 'DOCX', 'ZIP', 'TXT', 'PPTX', 'XLSX', 'PNG', 'JPG'];

const formatDate = (value) => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Chưa có hạn';

const renderFeedbackInline = (line) => line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
  if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
  if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
  return part;
});

const renderFeedback = (feedback) => feedback.split(/\r?\n/).map((line, index) => {
  const text = line.trim();
  if (!text) return null;
  const heading = text.match(/^#{1,4}\s+(.+)$/);
  if (heading) return <h5 key={index}>{renderFeedbackInline(heading[1])}</h5>;
  const listItem = text.match(/^([-*]|\d+[.)])\s+(.+)$/);
  if (listItem) return <p className="sa-feedback-list-item" key={index}><span aria-hidden="true">{listItem[1]}</span><span>{renderFeedbackInline(listItem[2])}</span></p>;
  return <p key={index}>{renderFeedbackInline(text)}</p>;
});

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

  const loadAssignments = () => {
    setLoading(true);
    setError('');
    api.get('/student/assignments')
      .then(({ data }) => { setItems(Array.isArray(data) ? data : []); })
      .catch((requestError) => { setError(requestError.response?.data?.message || 'Không thể tải bài tập.'); })
      .finally(() => { setLoading(false); });
  };

  useEffect(() => {
    if (!selected?.id) return;
    let active = true;
    Promise.all([
      api.get(`/student/assignments/${selected.id}`),
      api.get(`/student/assignments/${selected.id}/submission`),
    ]).then(([detail, result]) => {
      if (!active) return;
      setSelected(detail.data);
      setSubmission(result.data);
      setItems((rows) => rows.map((row) => row.id === selected.id ? { ...row, submissionStatus: result.data?.status || null, submittedAt: result.data?.submittedAt || null, teacherScore: result.data?.teacherScore ?? null } : row));
      setSubmissionText(result.data?.submissionText || '');
      if (detail.data.assignmentType === 'QUIZ') {
        try { setAnswers(result.data?.submissionText ? JSON.parse(result.data.submissionText) : detail.data.questions.map(() => [])); }
        catch { setAnswers(detail.data.questions.map(() => [])); }
      }
    }).catch((requestError) => {
      if (active) setError(requestError.response?.data?.message || 'Không thể tải chi tiết bài tập.');
    });
    return () => { active = false; };
  }, [selected?.id]);

  useEffect(() => {
    if (!selected?.id || !submission || submission.status === 'TEACHER_REVIEWED' || submission.aiEvaluationStatus !== 'PENDING') return;
    const timer = window.setInterval(() => {
      api.get(`/student/assignments/${selected.id}/submission`)
        .then(({ data }) => { if (data) setSubmission(data); })
        .catch(() => {});
    }, 5000);
    return () => window.clearInterval(timer);
  }, [selected?.id, submission?.submissionId, submission?.status, submission?.aiEvaluationStatus]);

  useEffect(() => {
    setSelected(null);
    setError('');
    loadAssignments();
  }, [courseId]);

  const saveSubmission = async (event) => {
    event.preventDefault();
    setError('');

    const allowedTypes = (selected?.allowedFileTypes?.length ? selected.allowedFileTypes : DEFAULT_ALLOWED_TYPES).map((t) => t.toUpperCase());

    // Validate Quiz
    if (selected.assignmentType === 'QUIZ') {
      const questions = selected.questions || [];
      const unansweredIndex = questions.findIndex((_, idx) => !answers[idx] || answers[idx].length === 0);
      if (unansweredIndex !== -1) {
        setError(`Vui lòng trả lời câu hỏi số ${unansweredIndex + 1} trước khi nộp bài.`);
        return;
      }
    } else {
      // Validate Document Assignment
      const hasText = submissionText && submissionText.trim().length > 0;
      const hasFile = file != null;
      const hasExistingFile = submission?.fileName != null;
      if (!hasText && !hasFile && !hasExistingFile) {
        setError('Vui lòng nhập câu trả lời hoặc đính kèm tệp bài làm.');
        return;
      }
      if (file) {
        if (file.size > 20 * 1024 * 1024) {
          setError('Tệp không được vượt quá 20 MB.');
          return;
        }
        const ext = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.') + 1).toUpperCase() : '';
        if (!ext || !allowedTypes.includes(ext)) {
          setError(`Định dạng tệp .${ext || 'không xác định'} không được phép. Các định dạng được chấp nhận: ${allowedTypes.join(', ')}`);
          return;
        }
      }
    }

    setSaving(true);
    const form = new FormData();
    form.append('submissionText', selected.assignmentType === 'QUIZ' ? JSON.stringify(answers) : submissionText);
    if (file) form.append('file', file);

    try {
      const { data } = await api.post(`/student/assignments/${selected.id}/submission`, form);
      setSubmission(data);
      setItems((rows) => rows.map((row) => row.id === selected.id ? { ...row, submissionStatus: data.status, submittedAt: data.submittedAt, teacherScore: data.teacherScore ?? null } : row));
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Không thể nộp bài. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const toggleAnswer = (questionIndex, optionIndex, type) => setAnswers((current) => {
    const next = [...current];
    const selectedOptions = next[questionIndex] || [];
    next[questionIndex] = type === 'SINGLE' ? [optionIndex] : selectedOptions.includes(optionIndex) ? selectedOptions.filter((value) => value !== optionIndex) : [...selectedOptions, optionIndex];
    return next;
  });

  const downloadSubmission = async () => {
    try {
      const { data } = await api.get(`/student/assignments/${selected.id}/submission/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = submission.fileName || 'bai-nop';
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Không thể tải tệp bài nộp.');
    }
  };

  const downloadResourceFile = async () => {
    try {
      const { data } = await api.get(`/student/assignments/${selected.id}/resource-file`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = selected.resourceFileName || 'tai-lieu';
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Không thể tải tệp tài liệu. Vui lòng thử lại.');
    }
  };

  const visibleItems = filterAssignmentsByCourse(items, courseId);

  if (loading) return <p className="sa-message">Đang tải bài tập…</p>;
  if (!selected && error && !items.length) {
    return (
      <div className="sa-message" role="alert">
        <p>{error}</p>
        <button className="sa-back" style={{ margin: '12px auto' }} onClick={loadAssignments}>Thử lại</button>
      </div>
    );
  }

  if (selected) {
    const isPastDeadline = selected.dueDate && new Date(selected.dueDate).getTime() <= Date.now();
    const isLocked = submission?.status === 'TEACHER_REVIEWED' || selected.status === 'CLOSED' || isPastDeadline;
    const isReviewed = submission?.status === 'TEACHER_REVIEWED';
    const scorePercent = submission?.teacherScore != null && Number(selected.maxScore) > 0
      ? Math.max(0, Math.min(100, Number(submission.teacherScore) / Number(selected.maxScore) * 100))
      : null;
    const allowedTypes = selected.allowedFileTypes?.length ? selected.allowedFileTypes : DEFAULT_ALLOWED_TYPES;

    return (
      <div className="student-assignments">
        <button className="sa-back" onClick={() => { setSelected(null); setError(''); }}><FiArrowLeft /> Trở lại bài tập</button>
        <div className="sa-detail">
          <div className="sa-detail-head">
            <span>{selected.subjectName}</span>
            <h2>{selected.title}</h2>
            <p><FiCalendar /> Hạn nộp: {formatDate(selected.dueDate)}</p>
          </div>
          {error && <p className="sa-error" role="alert">{error}</p>}
          <section>
            <h3>Yêu cầu bài tập</h3>
            <p className="sa-description">{selected.description}</p>
          </section>
          {selected.resourceUrl && (
            <section className="sa-resource-section">
              <h3>Tài liệu tham khảo</h3>
              <a className="sa-resource-link" href={selected.resourceUrl} target="_blank" rel="noopener noreferrer">
                <FiDownload aria-hidden="true" /> Mở hoặc tải tài liệu
              </a>
              <p>Mở liên kết để xem tài liệu hoặc tải xuống từ nơi lưu trữ.</p>
            </section>
          )}
          {selected.resourceFileName && (
            <section className="sa-resource-section">
              <h3>Tệp tài liệu</h3>
              <button className="sa-resource-link" type="button" onClick={downloadResourceFile}>
                <FiDownload aria-hidden="true" /> Tải xuống {selected.resourceFileName}
              </button>
            </section>
          )}
          <form className="sa-submit-form" onSubmit={saveSubmission}>
            {selected.assignmentType === 'QUIZ' ? (
              <section>
                <h3>Câu hỏi</h3>
                {selected.questions?.map((question, index) => (
                  <fieldset className="sa-question" key={index}>
                    <legend>{index + 1}. {question.text}</legend>
                    <p>{question.type === 'MULTIPLE' ? 'Chọn các đáp án phù hợp' : 'Chọn một đáp án'}</p>
                    {question.options.map((option, optionIndex) => (
                      <label key={optionIndex}>
                        <input
                          type={question.type === 'MULTIPLE' ? 'checkbox' : 'radio'}
                          name={`question-${index}`}
                          checked={(answers[index] || []).includes(optionIndex)}
                          disabled={isLocked}
                          onChange={() => toggleAnswer(index, optionIndex, question.type)}
                        />
                        {option}
                      </label>
                    ))}
                  </fieldset>
                ))}
              </section>
            ) : (
              <section>
                <h3>Bài làm</h3>
                {isReviewed ? (
                  <div className="sa-submitted-work">
                    <p className="sa-work-hint">Bài nộp đã được chấm. Bạn có thể xem lại nội dung và nhận xét bên dưới.</p>
                    {submissionText?.trim() && <div><h4>Nội dung đã nộp</h4><p>{submissionText}</p></div>}
                    {submission?.fileName && <button type="button" className="sa-resource-link" onClick={downloadSubmission}><FiDownload aria-hidden="true" /> Tải bài đã nộp: {submission.fileName}</button>}
                    {!submissionText?.trim() && !submission?.fileName && <p>Không có nội dung bài nộp để hiển thị.</p>}
                  </div>
                ) : <>
                <p className="sa-work-hint">Điểm tối đa: {selected.maxScore} · Định dạng cho phép: {allowedTypes.join(', ')}</p>
                <label className="sa-field">
                  Nội dung trả lời
                  <textarea
                    rows="7"
                    maxLength="100000"
                    value={submissionText}
                    disabled={isLocked}
                    onChange={(event) => setSubmissionText(event.target.value)}
                    placeholder="Nhập câu trả lời hoặc hướng dẫn tới tệp đính kèm."
                  />
                </label>
                <label className="sa-field">
                  Tệp đính kèm
                  <input
                    ref={fileInput}
                    type="file"
                    accept={allowedTypes.map((type) => `.${type.toLowerCase()}`).join(',')}
                    disabled={isLocked}
                    onChange={(event) => {
                      setFile(event.target.files?.[0] || null);
                      setError('');
                    }}
                  />
                  {file && (
                    <span className="sa-file-chosen">
                      Đã chọn: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
                      <button
                        type="button"
                        className="sa-file-remove"
                        onClick={() => {
                          setFile(null);
                          if (fileInput.current) fileInput.current.value = '';
                        }}
                      >
                        ✕ Bỏ chọn
                      </button>
                    </span>
                  )}
                </label>
                </>}
              </section>
            )}

            {submission && (
              isReviewed ? (
                <section className="sa-reviewed-result" aria-labelledby="sa-reviewed-title">
                  <header className="sa-reviewed-header">
                    <div className="sa-reviewed-title-group">
                      <span className="sa-reviewed-badge">
                        <FiCheckCircle aria-hidden="true" /> Đã hoàn thành chấm điểm
                      </span>
                      <h3 id="sa-reviewed-title">Kết quả đánh giá từ Giảng viên</h3>
                      <p className="sa-reviewed-subtext">Bài làm đã được giảng viên kiểm tra, cho điểm và phản hồi chính thức.</p>
                    </div>
                    <div className="sa-reviewed-score-box">
                      <span className="sa-score-label">ĐIỂM ĐẠT ĐƯỢC</span>
                      <div className="sa-score-display">
                        <strong>{submission.teacherScore ?? '—'}</strong>
                        <small> / {selected.maxScore}</small>
                      </div>
                      {scorePercent != null && (
                        <div className="sa-score-track" title={`${scorePercent}% thang điểm`}>
                          <i style={{ width: `${scorePercent}%` }} />
                        </div>
                      )}
                      <span className="sa-score-percent">
                        {scorePercent != null ? `${scorePercent.toFixed(scorePercent % 1 === 0 ? 0 : 1)}% thang điểm` : 'Đã chấm'}
                      </span>
                    </div>
                  </header>

                  <div className="sa-reviewed-body">
                    <div className="sa-feedback-header">
                      <FiMessageSquare className="sa-feedback-icon" aria-hidden="true" />
                      <h4>Nhận xét của giảng viên</h4>
                      <span className="sa-feedback-tag">Đánh giá chính thức</span>
                    </div>
                    {submission.teacherFeedback ? (
                      <div className="sa-feedback-quote">
                        {renderFeedback(submission.teacherFeedback)}
                      </div>
                    ) : (
                      <p className="sa-feedback-empty">Giảng viên không để lại nhận xét thêm cho bài làm này.</p>
                    )}
                  </div>

                  <footer className="sa-reviewed-footer">
                    <div className="sa-footer-time">
                      <FiClock aria-hidden="true" />
                      <span>{submission.submittedAt ? `Nộp lúc ${formatDate(submission.submittedAt)}` : 'Đã nộp bài'}</span>
                    </div>
                    {submission.fileName && (
                      <button type="button" className="sa-footer-file-btn" onClick={downloadSubmission}>
                        <FiDownload aria-hidden="true" />
                        <span>{submission.fileName}</span>
                        <b>· Tải xuống</b>
                      </button>
                    )}
                  </footer>
                </section>
              ) : (
                <div className="sa-submission-state">
                  <strong>✓ Nộp bài thành công · Đang chờ giảng viên chấm</strong>
                  {submission.submittedAt && <span>Nộp lúc {formatDate(submission.submittedAt)}</span>}
                  {submission.fileName && <button type="button" onClick={downloadSubmission}>{submission.fileName} · Tải xuống</button>}
                </div>
              )
            )}

            {selected.status === 'PUBLISHED' && !isPastDeadline && submission?.status !== 'TEACHER_REVIEWED' && (
              <button className="sa-submit-button" disabled={saving}>
                {saving ? 'Đang nộp…' : submission ? 'Cập nhật bài nộp' : 'Nộp bài'}
              </button>
            )}
            {selected.status === 'CLOSED' && <p className="sa-note">Bài tập đã đóng, không thể nộp thêm hoặc sửa bài.</p>}
            {selected.status === 'PUBLISHED' && isPastDeadline && <p className="sa-note">Bài tập đã quá hạn, không thể nộp thêm hoặc sửa bài.</p>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="student-assignments">
      <div className="sa-heading">
        <div>
          <p>BÀI TẬP KHÓA HỌC</p>
          <h2>{courseId == null ? 'Danh sách bài tập' : 'Bài tập của khóa học'}</h2>
        </div>
        <span>{visibleItems.length} bài tập</span>
      </div>
      {!visibleItems.length ? (
        <div className="sa-empty">
          <FiClipboard />
          <h3>Chưa có bài tập</h3>
          <p>{courseId == null ? 'Bài tập đã công bố của các khóa học bạn đang học sẽ xuất hiện tại đây.' : 'Giảng viên chưa giao bài tập trong khóa học này.'}</p>
        </div>
      ) : (
        <div className="sa-list">
          {visibleItems.map((item) => (
            <button className="sa-card" key={item.id} onClick={() => { setSelected(item); setError(''); }}>
              <span className="sa-card-icon">{item.assignmentType === 'QUIZ' ? <FiClipboard /> : <FiFileText />}</span>
              <span className="sa-card-body">
                <small><FiBookOpen /> {item.subjectName}</small>
                <strong>{item.title}</strong>
                <span>{item.assignmentType === 'QUIZ' ? 'Trắc nghiệm' : 'Bài tập tài liệu'} · {item.submissionStatus === 'TEACHER_REVIEWED' ? `Đã chấm · ${item.teacherScore != null ? item.teacherScore : '—'}/${item.maxScore ?? 10} điểm` : item.submissionStatus ? 'Đã nộp' : item.status === 'CLOSED' ? 'Đã đóng' : 'Chưa nộp'}</span>
              </span>
              <div className="sa-card-meta">
                {item.submissionStatus === 'TEACHER_REVIEWED' && (
                  <span className="sa-card-score-badge">
                    <FiCheckCircle aria-hidden="true" /> {item.teacherScore != null ? `${item.teacherScore}/${item.maxScore ?? 10} điểm` : 'Đã chấm'}
                  </span>
                )}
                <span className="sa-card-due"><FiCalendar /> {formatDate(item.dueDate)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
