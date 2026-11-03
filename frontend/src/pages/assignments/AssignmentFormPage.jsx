import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { SmoothLink as Link, useWorkspaceNavigate as useNavigate } from '../../components/common/WorkspaceNavigation.jsx';
import { toast } from 'react-toastify';
import { assignmentService, templateService } from '../../services/assignmentService.js';
import { FiArrowLeft } from 'react-icons/fi';
import { PageHeading, Field, Notice, ConfirmDialog, errorText } from '../../components/assignments/AssignmentUI.jsx';

import QuestionEditor from '../../components/assignments/QuestionEditor.jsx';

const initial = () => ({ assignmentType: 'DOCUMENT', questions: [], subjectId: '', templateId: '', title: '', description: '', dueDate: '', maxScore: 10, allowedFileTypes: ['PDF', 'DOC', 'DOCX', 'ZIP'], source: 'MANUAL', aiPrompt: '', rubric: [] });
function validate(form) {
  const errors = {};
  if (!form.subjectId) errors.subjectId = 'Vui lòng chọn môn học';
  if (!form.title.trim() || form.title.length > 200) errors.title = 'Tiêu đề bắt buộc, tối đa 200 ký tự';
  if (!form.description.trim()) errors.description = 'Vui lòng nhập nội dung bài tập';
  if (!form.dueDate || !Number.isFinite(new Date(form.dueDate).getTime()) || new Date(form.dueDate) <= new Date()) errors.dueDate = 'Hạn nộp phải ở tương lai';
  if (!(Number(form.maxScore) > 0) || Number(form.maxScore) > 999.99 || !/^\d+(\.\d{1,2})?$/.test(String(form.maxScore))) errors.maxScore = 'Điểm từ 0.01 đến 999.99, tối đa 2 số thập phân';
  if (form.assignmentType === 'QUIZ' && (!form.questions?.length || form.questions.length > 100 || form.questions.some((q) => !q.text.trim() || q.options.length < 2 || q.options.some((o) => !o.trim()) || !q.correctAnswers.length || (q.type === 'SINGLE' && q.correctAnswers.length !== 1)))) errors.questions = 'Mỗi câu cần nội dung, ít nhất hai lựa chọn và đáp án đúng. Tối đa 100 câu.';
  if (form.assignmentType !== 'QUIZ' && !form.allowedFileTypes.length) errors.allowedFileTypes = 'Chọn ít nhất một định dạng nộp bài';
  return errors;
}
export default function AssignmentFormPage({ review = false }) {
  const { id } = useParams(), [query] = useSearchParams(), location = useLocation(), navigate = useNavigate();
  const resume = location.state?.form;
  const [form, setForm] = useState(resume || initial), [subjects, setSubjects] = useState([]), [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(''), [errors, setErrors] = useState({}), [error, setError] = useState('');
  const [saving, setSaving] = useState(false), [generating, setGenerating] = useState(false), [templateLoading, setTemplateLoading] = useState(false), [dirty, setDirty] = useState(Boolean(resume));
  const [topic, setTopic] = useState(location.state?.request?.topic || ''), [difficulty, setDifficulty] = useState(location.state?.request?.difficulty || 'Medium');
  const [action, setAction] = useState(null);
  const templateSequence = useRef(0);
  const editId = id;
  const courseSubjectId = query.get('subjectId') || form.subjectId;
  const returnToCourse = courseSubjectId ? `/courses/${courseSubjectId}?tab=assignments` : '/teacher/assignments';
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [s, t] = await Promise.all([assignmentService.subjects(), templateService.list({ size: 100 })]);
        if (!active) return; setSubjects(s); setTemplates(t.content);
        if (!resume && editId) {
          const item = await assignmentService.get(editId);
          if (!['DRAFT', 'PUBLISHED'].includes(item.status)) throw new Error('Chỉ sửa được bài nháp hoặc bài đang mở');
          if (active) setForm({ ...initial(), ...item, templateId: item.templateId || '', dueDate: item.dueDate?.slice(0, 16) || '' });
        } else if (!resume && query.get('templateId')) {
          const item = await templateService.get(query.get('templateId'));
          if (active) { setForm((f) => ({ ...f, templateId: item.id, subjectId: item.subjectId || '', title: item.name, description: item.description, maxScore: item.defaultMaxScore, rubric: item.rubric, source: 'TEMPLATE' })); setDirty(true); }
        } else if (!resume && query.get('subjectId') && s.some((subject) => String(subject.id) === query.get('subjectId'))) {
          if (active) setForm((f) => ({ ...f, subjectId: query.get('subjectId') }));
        }
      } catch (e) { if (active) setLoadError(e.response ? errorText(e) : e.message); }
      finally { if (active) setLoading(false); }
    }
    load(); return () => { active = false; };
  }, [editId, query, resume]);
  useEffect(() => { if (!dirty) return; const warn = (e) => { e.preventDefault(); e.returnValue = ''; }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
  const update = (name, value) => { setForm((f) => ({ ...f, [name]: value })); setDirty(true); setErrors((e) => ({ ...e, [name]: undefined })); };
  const selectTemplate = async (value) => {
    const sequence = ++templateSequence.current;
    if (!value) { setTemplateLoading(false); setForm((f) => ({ ...f, templateId: '', source: 'MANUAL' })); setDirty(true); return; }
    setTemplateLoading(true); setError('');
    try { const t = await templateService.get(value); if (sequence === templateSequence.current) { setForm((f) => ({ ...f, templateId: t.id, subjectId: t.subjectId || f.subjectId, title: t.name, description: t.description, maxScore: t.defaultMaxScore, rubric: t.rubric, source: 'TEMPLATE' })); setDirty(true); } }
    catch (e) { setError(errorText(e)); } finally { if (sequence === templateSequence.current) setTemplateLoading(false); }
  };
  const save = async (event) => {
    event.preventDefault(); setError(''); const issues = validate(form); setErrors(issues);
    if (Object.keys(issues).length) { toast.error('Vui lòng kiểm tra các trường được đánh dấu'); return; }
    setSaving(true);
    try {
      const payload = { ...form, assignmentType: form.assignmentType || 'DOCUMENT', questions: form.assignmentType === 'QUIZ' ? form.questions : [], allowedFileTypes: form.assignmentType === 'QUIZ' ? [] : form.allowedFileTypes, subjectId: Number(form.subjectId), templateId: form.templateId ? Number(form.templateId) : null, maxScore: Number(form.maxScore), dueDate: form.dueDate.length === 16 ? `${form.dueDate}:00` : form.dueDate, rubric: [] };
      const saved = await assignmentService.save(editId, payload); setDirty(false); toast.success(editId ? 'Đã cập nhật bài tập' : 'Đã lưu bản nháp'); navigate(`/teacher/assignments/${saved.id}?subjectId=${form.subjectId}`);
    } catch (e) { setError(errorText(e)); setErrors(Object.fromEntries((e.response?.data?.errors || []).map((issue) => [issue.field, issue.message]))); }
    finally { setSaving(false); }
  };
  const generate = async () => {
    if (!form.subjectId) {
      setError('Vui lòng chọn môn học ở mục Thông tin bài tập trước khi tạo đề AI');
      return;
    }
    if (!topic.trim()) {
      setError('Vui lòng nhập chủ đề / yêu cầu để AI tạo đề');
      return;
    }
    setGenerating(true);
    setError('');
    const request = {
      subjectId: Number(form.subjectId),
      topic: topic.trim(),
      difficulty,
      assignmentType: form.assignmentType || 'DOCUMENT',
    };
    try {
      const draft = await assignmentService.generate(request);
      setForm((current) => ({
        ...current,
        title: draft.title || current.title,
        description: draft.description || current.description,
        questions: (current.assignmentType === 'QUIZ' && Array.isArray(draft.questions) && draft.questions.length > 0)
          ? draft.questions
          : current.questions,
        source: 'AI',
        templateId: '',
        aiPrompt: JSON.stringify(request),
      }));
      setDirty(true);
      setErrors((e) => ({ ...e, title: undefined, description: undefined, questions: undefined }));
      toast.success('Đã tạo đề bài bằng AI và tự động điền vào thông tin bài tập!');
      if (review) {
        navigate(`/teacher/assignments/ai-review?subjectId=${form.subjectId}`, {
          replace: true,
          state: { ...location.state, request, model: draft.model },
        });
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setGenerating(false);
    }
  };
  if (review && !resume) return <Navigate to={`/teacher/assignments/new${query.get('subjectId') ? `?subjectId=${query.get('subjectId')}` : ''}`} replace />;
  if (loading || loadError) return <><Link to={returnToCourse}>← Quay lại khóa học</Link><Notice error={Boolean(loadError)}>{loadError || 'Đang tải biểu mẫu…'}</Notice></>;
  const disabled = saving || generating || templateLoading;
  return <>
    <Link className="assignment-back" to={returnToCourse}>
      <FiArrowLeft aria-hidden="true" /> {courseSubjectId ? 'Quay lại bài tập của khóa học' : 'Quay lại danh sách bài tập'}
    </Link>
    <PageHeading title={review ? 'Xem lại đề bài AI' : editId ? 'Chỉnh sửa bài tập' : 'Tạo bài tập mới'}>
      <Link className="button" to={returnToCourse}>
        <FiArrowLeft aria-hidden="true" /> {courseSubjectId ? 'Bài tập của lớp' : 'Danh sách bài tập'}
      </Link>
      {courseSubjectId && (
        <Link className="button" to="/teacher/assignments">
          Tất cả bài tập
        </Link>
      )}
    </PageHeading>
    {review && <Notice>Nội dung do AI tạo, chưa được lưu. Hãy kiểm tra đề bài trước khi lưu.</Notice>}
    {!subjects.length && <Notice>Chưa có khóa học được phân công. Cần có khóa học thuộc tài khoản giảng viên này để giao bài.</Notice>}
    <Notice error>{error}</Notice>
    <div className="assignment-form-layout"><form className="assignment-card assignment-form" onSubmit={save} noValidate>
      <fieldset disabled={disabled}><legend className="sr-only">Thông tin bài tập</legend>
      <div className="assignment-form-intro"><h2>Thông tin bài tập</h2><p>Chọn lớp, mô tả yêu cầu và thiết lập cách sinh viên sẽ nộp bài.</p></div>
      <div className="assignment-form-grid">
        <Field name="subjectId" label="Môn học *" errors={errors}><select id="subjectId" value={form.subjectId} onChange={(e) => { update('subjectId', e.target.value); if (form.templateId) { update('templateId', ''); update('source', 'MANUAL'); } }}><option value="">Chọn môn học</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        {!review && !editId && <Field name="templateId" label="Mẫu bài tập (tùy chọn)" errors={errors}><select id="templateId" value={form.templateId} onChange={(e) => selectTemplate(e.target.value)}><option value="">Soạn thủ công</option>{templates.filter((t) => !form.subjectId || !t.subjectId || String(t.subjectId) === String(form.subjectId)).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>}
      </div>
      <fieldset className="assignment-type-picker"><legend>Loại bài tập</legend><div className="assignment-type-options">{[['DOCUMENT', 'Bài tự luận / tài liệu', 'Sinh viên nộp tệp DOC, DOCX, PDF hoặc định dạng bạn chọn.'], ['QUIZ', 'Bài trắc nghiệm', 'Soạn câu hỏi với một hoặc nhiều đáp án đúng.']].map(([value, label, hint]) => <label key={value} className={(form.assignmentType || 'DOCUMENT') === value ? 'is-selected' : ''}><input type="radio" name="assignmentType" value={value} checked={(form.assignmentType || 'DOCUMENT') === value} onChange={() => update('assignmentType', value)} /><span><strong>{label}</strong><small>{hint}</small></span></label>)}</div></fieldset>
      <Field name="title" label="Tiêu đề *" errors={errors}><input id="title" value={form.title} maxLength={200} onChange={(e) => update('title', e.target.value)} placeholder="Ví dụ: Xây dựng REST API quản lý thư viện" /></Field>
      <Field name="description" label="Nội dung và yêu cầu *" errors={errors}><textarea id="description" rows={9} maxLength={8000} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Mô tả yêu cầu, kết quả cần đạt và định dạng nộp bài…" /></Field>
      <div className="assignment-form-grid"><Field name="dueDate" label="Hạn nộp *" errors={errors}><input id="dueDate" type="datetime-local" value={form.dueDate} onChange={(e) => update('dueDate', e.target.value)} /></Field><Field name="maxScore" label="Điểm tối đa *" errors={errors}><input id="maxScore" type="number" min="0.01" max="999.99" step="0.01" value={form.maxScore} onChange={(e) => update('maxScore', e.target.value)} /></Field></div>
      {form.assignmentType !== 'QUIZ' && <div className="assignment-field"><span>Định dạng được phép nộp</span><div className="assignment-file-types">{['PDF', 'DOC', 'DOCX', 'ZIP', 'TXT', 'PPTX', 'XLSX', 'PNG', 'JPG'].map((type) => <label key={type}><input type="checkbox" checked={form.allowedFileTypes.includes(type)} onChange={(e) => update('allowedFileTypes', e.target.checked ? [...form.allowedFileTypes, type] : form.allowedFileTypes.filter((v) => v !== type))} />{type}</label>)}</div><Notice error>{errors.allowedFileTypes}</Notice></div>}
      {form.assignmentType === 'QUIZ' && <><QuestionEditor value={form.questions || []} onChange={(value) => update('questions', value)} /><Notice error>{errors.questions || Object.entries(errors).filter(([k]) => k.startsWith('questions[')).map(([, v]) => v).join('; ')}</Notice></>}
      <div className="assignment-actions assignment-footer-actions"><button type="submit" className="primary" disabled={!subjects.length}>{saving ? 'Đang lưu…' : editId ? 'Lưu thay đổi' : 'Lưu bản nháp'}</button><button type="button" onClick={() => dirty ? setAction({ type: 'cancel', message: 'Bạn có thay đổi chưa lưu. Rời khỏi biểu mẫu?' }) : navigate(returnToCourse)}>{review ? 'Bỏ đề AI' : 'Hủy & Quay lại'}</button></div>
      </fieldset>
    </form><aside className="assignment-card assignment-ai"><p className="assignment-eyebrow">TRỢ LÝ SOẠN ĐỀ</p><h2>{review ? 'Yêu cầu tạo đề' : 'Bắt đầu cùng AI'}</h2><p>Nhập mục tiêu học tập để AI gợi ý tiêu đề và nội dung bài tập.</p>
      <Field name="topic" label="Chủ đề / yêu cầu"><textarea id="topic" rows={6} maxLength={4000} value={topic} readOnly={review} disabled={disabled} onChange={(e) => setTopic(e.target.value)} placeholder="Sinh viên thực hành thiết kế API, xác thực và kiểm thử…" /></Field>
      <Field name="difficulty" label="Độ khó"><select id="difficulty" value={difficulty} disabled={review || disabled} onChange={(e) => setDifficulty(e.target.value)}><option value="Easy">Cơ bản</option><option value="Medium">Trung bình</option><option value="Hard">Nâng cao</option></select></Field>
      {review && <p>Model: {location.state?.model}</p>}
      <button className="primary" type="button" disabled={disabled || !subjects.length} onClick={generate}>{generating ? 'Đang tạo đề bằng AI…' : review ? 'Tạo lại đề AI' : 'Tạo đề bằng AI'}</button>
      {form.assignmentType === 'QUIZ' ? (
        <small>AI sẽ tự động tạo tiêu đề, mô tả và các câu hỏi trắc nghiệm vào mục bên trái.</small>
      ) : (
        <small>Sau khi bấm tạo, AI sẽ tự động điền tiêu đề và nội dung vào mục Thông tin bài tập bên trái.</small>
      )}
      <small>Đề AI chỉ được lưu khi bạn chọn lưu bản nháp.</small>
    </aside></div>
    <ConfirmDialog action={action} onCancel={() => setAction(null)} onConfirm={() => { setDirty(false); if (review) navigate(location.state.returnEditId ? `/teacher/assignments/${location.state.returnEditId}/edit?subjectId=${form.subjectId}` : `/teacher/assignments/new?subjectId=${form.subjectId}`, { state: { form: location.state.originalForm } }); else navigate(returnToCourse); }} />
  </>;
}
