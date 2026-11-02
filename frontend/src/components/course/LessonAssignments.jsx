import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../services/api.js';
import QuestionEditor from '../assignments/QuestionEditor.jsx';
import '../../assets/styles/lesson-assignments.css';

const futureDate = () => { const date = new Date(Date.now() + 7 * 86400000); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); };
const blankQuiz = (lessonTitle) => ({ title: `${lessonTitle} – Kiểm tra`, description: `Bài trắc nghiệm cho bài học: ${lessonTitle}`, dueDate: futureDate(), maxScore: 10, questions: [], rubric: [{ criteria: 'Độ chính xác', description: 'Chấm theo đáp án đúng của các câu hỏi.', weight: 100 }] });
const errorText = (error) => error.response?.data?.message || 'Không thể xử lý bài trắc nghiệm.';

export default function LessonAssignments({ courseId, lesson }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!lesson?.lessonId) return;
    setLoading(true); setError('');
    try { const { data } = await api.get('/assignments', { params: { lessonId: lesson.lessonId, size: 100 } }); setItems(data.content || []); }
    catch (requestError) { setError(errorText(requestError)); }
    finally { setLoading(false); }
  }, [lesson?.lessonId]);
  useEffect(() => { load(); }, [load]);
  const edit = async (item) => {
    try { const { data } = await api.get(`/assignments/${item.id}`); setForm({ ...blankQuiz(lesson.title), ...data, dueDate: data.dueDate?.slice(0, 16) || futureDate() }); }
    catch (requestError) { setError(errorText(requestError)); }
  };
  const save = async () => {
    setSaving(true); setError('');
    try {
      const payload = { subjectId: Number(courseId), lessonId: lesson.lessonId, assignmentType: 'QUIZ', source: form.source || 'MANUAL', title: form.title.trim(), description: form.description.trim(), dueDate: form.dueDate.length === 16 ? `${form.dueDate}:00` : form.dueDate, maxScore: Number(form.maxScore), allowedFileTypes: [], questions: form.questions, rubric: form.rubric || [{ criteria: 'Độ chính xác', description: 'Chấm theo đáp án đúng của các câu hỏi.', weight: 100 }], templateId: form.templateId || null, aiPrompt: form.aiPrompt || null };
      if (!payload.title || !payload.description || !payload.questions.length || payload.questions.some((q) => !q.text.trim() || q.options.length < 2 || q.options.some((o) => !o.trim()) || !q.correctAnswers.length || (q.type === 'SINGLE' && q.correctAnswers.length !== 1))) throw new Error('Nhập tiêu đề, mô tả và ít nhất một câu hỏi có đáp án đúng.');
      if (new Date(payload.dueDate) <= new Date()) throw new Error('Hạn làm bài phải ở tương lai.');
      if (form.id) await api.put(`/assignments/${form.id}`, payload); else await api.post('/assignments', payload);
      setForm(null); await load(); toast.success(form.id ? 'Đã cập nhật bài trắc nghiệm' : 'Đã tạo bản nháp trắc nghiệm');
    } catch (requestError) { setError(errorText(requestError)); }
    finally { setSaving(false); }
  };
  const transition = async (item, action) => {
    try { await api.post(`/assignments/${item.id}/${action}`); await load(); toast.success(action === 'publish' ? 'Đã xuất bản bài trắc nghiệm' : 'Đã đóng bài trắc nghiệm'); }
    catch (requestError) { toast.error(errorText(requestError)); }
  };
  const remove = async (item) => {
    if (!window.confirm(`Xóa bài trắc nghiệm “${item.title}”?`)) return;
    try { await api.delete(`/assignments/${item.id}`); await load(); toast.success('Đã xóa bài trắc nghiệm'); }
    catch (requestError) { toast.error(errorText(requestError)); }
  };

  if (!lesson?.lessonId) return <section className="lesson-quizzes"><h3>Bài trắc nghiệm</h3><p>Lưu bài học trước, sau đó có thể thêm bài trắc nghiệm cho bài học này.</p></section>;
  return <section className="lesson-quizzes"><div className="lesson-quizzes-heading"><div><h3>Bài trắc nghiệm</h3><p>Tạo bài kiểm tra để sinh viên làm trong bài học này.</p></div><button type="button" onClick={() => setForm(blankQuiz(lesson.title))}>＋ Thêm quiz</button></div>
    {error && <p className="lesson-quiz-error" role="alert">{error}</p>}
    {loading ? <p>Đang tải bài trắc nghiệm…</p> : !items.length ? <p>Chưa có bài trắc nghiệm cho bài học.</p> : <ul className="lesson-quiz-list">{items.map((item) => <li key={item.id}><div><strong>{item.title}</strong><small>{item.questions?.length || 0} câu · {item.status === 'PUBLISHED' ? 'Đã xuất bản' : item.status === 'CLOSED' ? 'Đã đóng' : 'Bản nháp'}</small></div><div className="lesson-quiz-actions"><button type="button" onClick={() => edit(item)}>Sửa</button>{item.status === 'DRAFT' && <button type="button" onClick={() => transition(item, 'publish')}>Xuất bản</button>}{item.status === 'PUBLISHED' && <button type="button" onClick={() => transition(item, 'close')}>Đóng bài</button>}{item.status === 'DRAFT' && <button type="button" onClick={() => remove(item)}>Xóa</button>}</div></li>)}</ul>}
    {form && <div className="lesson-quiz-form"><div className="lesson-quiz-form-heading"><h4>{form.id ? 'Sửa bài trắc nghiệm' : 'Tạo bài trắc nghiệm'}</h4><button type="button" onClick={() => setForm(null)} aria-label="Đóng">×</button></div><label>Tiêu đề<input required maxLength="200" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label><label>Mô tả<textarea required rows="3" maxLength="8000" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><div className="lesson-quiz-fields"><label>Hạn làm bài<input required type="datetime-local" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label><label>Điểm tối đa<input required type="number" min="0.01" max="999.99" step="0.01" value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: e.target.value })} /></label></div><QuestionEditor value={form.questions || []} onChange={(questions) => setForm({ ...form, questions })} /><button type="button" className="cm-button cm-button-primary" disabled={saving} onClick={save}>{saving ? 'Đang lưu…' : form.id ? 'Lưu bài trắc nghiệm' : 'Lưu bản nháp'}</button></div>}
  </section>;
}
