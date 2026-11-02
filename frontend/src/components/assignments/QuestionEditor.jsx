const newQuestion = () => ({ text: '', type: 'SINGLE', options: ['', ''], correctAnswers: [] });

export default function QuestionEditor({ value, onChange }) {
  const update = (index, patch) => onChange(value.map((q, i) => i === index ? { ...q, ...patch } : q));
  const removeOption = (index, optionIndex) => {
    const q = value[index];
    update(index, { options: q.options.filter((_, i) => i !== optionIndex), correctAnswers: q.correctAnswers.filter((i) => i !== optionIndex).map((i) => i > optionIndex ? i - 1 : i) });
  };
  return <section className="assignment-questions" aria-labelledby="questions-title">
    <div className="assignment-section-title"><h2 id="questions-title">Câu hỏi trắc nghiệm ({value.length}/100)</h2><button type="button" disabled={value.length >= 100} onClick={() => onChange([...value, newQuestion()])}>+ Thêm câu hỏi</button></div>
    <p className="assignment-question-hint">Đánh dấu đáp án đúng bên cạnh mỗi lựa chọn. Mỗi câu có thể có từ 2 đến 10 lựa chọn.</p>
    {!value.length && <div className="assignment-empty">Chưa có câu hỏi. Chọn “Thêm câu hỏi” để bắt đầu.</div>}
    {value.map((q, index) => <fieldset className="assignment-question" key={index}>
      <legend>Câu {index + 1}</legend>
      <div className="assignment-question-toolbar"><label>Kiểu trả lời <select value={q.type} onChange={(e) => update(index, { type: e.target.value, correctAnswers: e.target.value === 'SINGLE' ? q.correctAnswers.slice(0, 1) : q.correctAnswers })}><option value="SINGLE">Chọn một đáp án</option><option value="MULTIPLE">Chọn nhiều đáp án</option></select></label><button type="button" className="assignment-danger" onClick={() => onChange(value.filter((_, i) => i !== index))}>Xóa câu {index + 1}</button></div>
      <label className="assignment-field">Nội dung câu hỏi<textarea maxLength={2000} rows={3} value={q.text} onChange={(e) => update(index, { text: e.target.value })} placeholder="Nhập nội dung câu hỏi…" /></label>
      <div className="assignment-options">{q.options.map((option, optionIndex) => <div className={q.correctAnswers.includes(optionIndex) ? 'assignment-option is-correct' : 'assignment-option'} key={optionIndex}>
        <input type={q.type === 'SINGLE' ? 'radio' : 'checkbox'} name={`correct-${index}`} aria-label={`Câu ${index + 1}: đáp án ${optionIndex + 1} đúng`} checked={q.correctAnswers.includes(optionIndex)} onChange={(e) => update(index, { correctAnswers: q.type === 'SINGLE' ? [optionIndex] : e.target.checked ? [...q.correctAnswers, optionIndex] : q.correctAnswers.filter((i) => i !== optionIndex) })} />
        <span aria-hidden="true">{String.fromCharCode(65 + optionIndex)}</span><input type="text" maxLength={1000} aria-label={`Câu ${index + 1}: nội dung đáp án ${optionIndex + 1}`} value={option} placeholder="Nhập đáp án…" onChange={(e) => update(index, { options: q.options.map((o, i) => i === optionIndex ? e.target.value : o) })} />
        <button type="button" aria-label={`Xóa đáp án ${optionIndex + 1} câu ${index + 1}`} disabled={q.options.length <= 2} onClick={() => removeOption(index, optionIndex)}>×</button>
      </div>)}</div>
      <button type="button" disabled={q.options.length >= 10} onClick={() => update(index, { options: [...q.options, ''] })}>+ Thêm đáp án</button>
    </fieldset>)}
  </section>;
}
