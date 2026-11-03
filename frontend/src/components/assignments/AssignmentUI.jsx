import { useEffect, useRef } from 'react';

export const statuses = { DRAFT: 'Bản nháp', PUBLISHED: 'Đang mở', CLOSED: 'Đã đóng', ARCHIVED: 'Lưu trữ', SUBMITTED: 'Chờ chấm', AI_EVALUATED: 'AI đã đánh giá', TEACHER_REVIEWED: 'Đã chấm', NOT_SUBMITTED: 'Chưa nộp' };
export const sources = { MANUAL: 'Thủ công', AI: 'AI', TEMPLATE: 'Mẫu bài tập' };
export const dateText = (date) => date ? new Date(date).toLocaleString('vi-VN') : '—';
export const errorText = (error) => error.response?.data?.message || (error.code === 'ECONNABORTED' ? 'Quá thời gian chờ. Vui lòng thử lại.' : 'Không thể kết nối máy chủ. Vui lòng thử lại.');
export function StatusTag({ status }) { return <span className={`assignment-status ${status}`}>{statuses[status] || status}</span>; }
export function PageHeading({ eyebrow = 'QUẢN LÝ GIẢNG DẠY', title, children }) { return <div className="assignment-heading"><div><p>{eyebrow}</p><h1>{title}</h1></div><div className="assignment-actions">{children}</div></div>; }
export function Notice({ children, error = false }) { return children ? <div className={`assignment-notice ${error ? 'is-error' : ''}`} role={error ? 'alert' : 'status'}>{children}</div> : null; }
export function Field({ name, label, errors = {}, children }) { return <div className="assignment-field"><label htmlFor={name}>{label}</label>{children}{errors[name] && <small role="alert">{errors[name]}</small>}</div>; }
export function RubricTable({ rubric = [] }) { return <div className="assignment-table-wrap"><table><thead><tr><th>Tiêu chí</th><th>Mô tả</th><th>Trọng số</th></tr></thead><tbody>{rubric.map((r, i) => <tr key={i}><td>{r.criteria}</td><td>{r.description}</td><td>{r.weight}%</td></tr>)}</tbody></table></div>; }
export function RubricEditor({ value, onChange }) {
  const total = value.reduce((sum, row) => sum + (Number(row.weight) || 0), 0);
  const change = (index, field, next) => onChange(value.map((r, i) => i === index ? { ...r, [field]: next } : r));
  return <div id="rubric" className="assignment-rubric"><div className="assignment-section-title"><h2>Rubric chấm điểm</h2><span className={Math.abs(total - 100) < 0.000001 ? 'valid' : 'invalid'}>Tổng: {Number(total.toFixed(2))}% / 100%</span></div>
    {value.map((r, i) => <div className="rubric-row" key={i}>
      <input aria-label={`Tiêu chí ${i + 1}`} placeholder="Tên tiêu chí" maxLength={200} value={r.criteria} onChange={(e) => change(i, 'criteria', e.target.value)} />
      <textarea aria-label={`Mô tả tiêu chí ${i + 1}`} placeholder="Mô tả cách đánh giá" maxLength={4000} value={r.description} onChange={(e) => change(i, 'description', e.target.value)} />
      <input aria-label={`Trọng số tiêu chí ${i + 1}`} type="number" min="0.01" max="100" step="0.01" value={r.weight} onChange={(e) => change(i, 'weight', e.target.value)} />
      <button type="button" className="assignment-danger" aria-label={`Xóa tiêu chí ${i + 1}`} onClick={() => onChange(value.filter((_, index) => index !== i))}>×</button>
    </div>)}<button type="button" disabled={value.length >= 30} onClick={() => onChange([...value, { criteria: '', description: '', weight: '' }])}>+ Thêm tiêu chí</button>
  </div>;
}
export function ConfirmDialog({ action, onConfirm, onCancel, busy }) {
  const ref = useRef(null);
  useEffect(() => { if (action) ref.current?.showModal(); else ref.current?.close(); }, [action]);
  return <dialog ref={ref} className="assignment-dialog" onCancel={(e) => { e.preventDefault(); if (!busy) onCancel(); }}><h2>Xác nhận thao tác</h2><p>{action?.message}</p><div className="assignment-actions"><button disabled={busy} onClick={onCancel}>Hủy</button><button className="primary" disabled={busy} onClick={onConfirm}>{busy ? 'Đang xử lý…' : 'Xác nhận'}</button></div></dialog>;
}
export function Pagination({ data, page, onChange }) { return <div className="assignment-pagination"><span>{data.totalElements || 0} kết quả · Trang {page + 1}/{Math.max(1, data.totalPages || 0)}</span><div className="assignment-actions"><button disabled={page === 0} onClick={() => onChange(page - 1)}>Trước</button><button disabled={page + 1 >= (data.totalPages || 0)} onClick={() => onChange(page + 1)}>Sau</button></div></div>; }
