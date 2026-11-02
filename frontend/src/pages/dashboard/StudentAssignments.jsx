import { useEffect, useState } from 'react';
import { FiArrowLeft, FiBookOpen, FiCalendar, FiClipboard, FiFileText } from 'react-icons/fi';
import api from '../../services/api.js';
import './student-assignments.css';

const formatDate = (value) => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Chưa có hạn';

export default function StudentAssignments() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/student/assignments').then(({ data }) => { if (active) setItems(Array.isArray(data) ? data : []); })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Không thể tải bài tập.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <p className="sa-message">Đang tải bài tập…</p>;
  if (error) return <p className="sa-message" role="alert">{error}</p>;
  if (selected) return <div className="student-assignments">
    <button className="sa-back" onClick={() => setSelected(null)}><FiArrowLeft /> Trở lại bài tập</button>
    <div className="sa-detail"><div className="sa-detail-head"><span>{selected.subjectName}</span><h2>{selected.title}</h2><p><FiCalendar /> Hạn nộp: {formatDate(selected.dueDate)}</p></div>
      <section><h3>Yêu cầu bài tập</h3><p className="sa-description">{selected.description}</p></section>
      {selected.assignmentType === 'QUIZ' ? <section><h3>Câu hỏi</h3>{selected.questions?.map((question, index) => <div className="sa-question" key={index}><strong>{index + 1}. {question.text}</strong><ul>{question.options.map((option, optionIndex) => <li key={optionIndex}>{option}</li>)}</ul></div>)}</section> : <section><h3>Thông tin nộp bài</h3><p>Điểm tối đa: {selected.maxScore} · Định dạng: {selected.allowedFileTypes?.join(', ') || 'Theo hướng dẫn của giảng viên'}</p></section>}
      <p className="sa-note">Chức năng nộp bài trực tuyến đang được phát triển. Hãy liên hệ giảng viên để biết cách nộp bài.</p>
    </div>
  </div>;
  return <div className="student-assignments"><div className="sa-heading"><div><p>BÀI TẬP KHÓA HỌC</p><h2>Danh sách bài tập</h2></div><span>{items.length} bài tập</span></div>
    {!items.length ? <div className="sa-empty"><FiClipboard /><h3>Chưa có bài tập</h3><p>Bài tập đã công bố của các khóa học bạn đang học sẽ xuất hiện tại đây.</p></div> : <div className="sa-list">{items.map((item) => <button className="sa-card" key={item.id} onClick={() => setSelected(item)}><span className="sa-card-icon">{item.assignmentType === 'QUIZ' ? <FiClipboard /> : <FiFileText />}</span><span className="sa-card-body"><small><FiBookOpen /> {item.subjectName}</small><strong>{item.title}</strong><span>{item.assignmentType === 'QUIZ' ? 'Trắc nghiệm' : 'Bài tập tài liệu'} · {item.status === 'CLOSED' ? 'Đã đóng' : 'Đang mở'}</span></span><span className="sa-card-due"><FiCalendar /> {formatDate(item.dueDate)}</span></button>)}</div>}
  </div>;
}
