import { useEffect, useState } from 'react';
import api from '../../services/api.js';

export default function PaymentReviews() {
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(null);
  const load = async () => {
    try { const { data } = await api.get('/admin/payment-reviews'); setReviews(data); setError(''); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Không thể tải danh sách đối soát.'); }
  };
  useEffect(() => { load(); }, []);
  const close = async (id) => {
    setBusy(id);
    try { await api.post(`/admin/payment-reviews/${id}/close`, { note: notes[id] || '' }); await load(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Không thể đóng hồ sơ.'); }
    finally { setBusy(null); }
  };
  return <section className="admin-panel"><div className="admin-panel-head"><div><h2>Giao dịch cần đối soát</h2><p>Kiểm tra trên SePay hoặc ngân hàng trước khi ghi chú và đóng hồ sơ. Đóng hồ sơ không cấp quyền học.</p></div><button onClick={load}>Tải lại</button></div>
    {error && <p role="alert">{error}</p>}
    {!reviews.length && <p className="admin-empty">Không có giao dịch cần đối soát.</p>}
    {reviews.map((item) => <article className="payment-review" key={item.id}><h3>Giao dịch #{item.sepayTransactionId}</h3><p>Lý do: {item.reason} · Mã: {item.orderCode || '—'}</p><p>Tài khoản: {item.accountNumber || '—'} · Số tiền: {Number(item.amount || 0).toLocaleString('vi-VN')} đ</p><textarea value={notes[item.id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Ghi chú kết quả đối soát" maxLength={1000} aria-label={`Ghi chú giao dịch ${item.sepayTransactionId}`} /><button disabled={busy === item.id || !notes[item.id]?.trim()} onClick={() => close(item.id)}>Đóng hồ sơ</button></article>)}
  </section>;
}
