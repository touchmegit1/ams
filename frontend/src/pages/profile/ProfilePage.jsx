import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiArrowLeft, FiUser } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext.jsx';
import profileService from '../../services/profileService.js';

function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ fullName: user?.fullName || '', avatarUrl: user?.avatarUrl || '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    profileService.get().then(({ data }) => {
      if (!active) return;
      updateUser(data);
      setForm({ fullName: data.fullName || '', avatarUrl: data.avatarUrl || '' });
    }).catch(() => { if (active) setError('Không tải được hồ sơ. Vui lòng thử lại.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const save = async (event) => {
    event.preventDefault();
    const fullName = form.fullName.trim();
    if (!fullName) { setError('Vui lòng nhập họ tên.'); return; }
    setSaving(true);
    setError('');
    try {
      const { data } = await profileService.update({ fullName, avatarUrl: form.avatarUrl.trim() });
      updateUser(data);
      setForm({ fullName: data.fullName || '', avatarUrl: data.avatarUrl || '' });
      toast.success('Đã cập nhật hồ sơ');
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.fullName || err.response?.data?.avatarUrl || 'Không lưu được hồ sơ. Vui lòng thử lại.');
    } finally { setSaving(false); }
  };

  return <div className="profile-page">
    <header className="profile-topbar"><div><Link to="/dashboard" className="profile-brand">AMS <span>·</span> ASSIGNMENT MANAGEMENT SYSTEM</Link><Link to="/dashboard" className="profile-back"><FiArrowLeft aria-hidden="true" /> Trang chủ</Link></div></header>
    <main className="profile-layout">
      <div className="profile-intro"><p className="dashboard-eyebrow">TÀI KHOẢN CỦA BẠN</p><h1>Hồ sơ cá nhân</h1><p>Cập nhật thông tin hiển thị trên không gian học tập AMS.</p></div>
      <section className="profile-panel" aria-labelledby="profile-form-title">
        <div className="profile-panel-heading"><span className="profile-panel-icon"><FiUser aria-hidden="true" /></span><div><h2 id="profile-form-title">Thông tin cá nhân</h2><p>Những thay đổi của bạn sẽ xuất hiện trên dashboard.</p></div></div>
        {loading ? <p className="profile-status">Đang tải hồ sơ...</p> : <form onSubmit={save}>
          <div className="profile-preview"><span className="dashboard-avatar profile-avatar" aria-hidden="true">{user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : (user?.fullName || 'U').trim().split(/\s+/).map(word => word[0]).slice(-2).join('').toUpperCase()}</span><div><strong>{user?.fullName}</strong><span>{user?.role === 'TEACHER' ? 'Giảng viên' : 'Sinh viên'}</span></div></div>
          <label htmlFor="profile-name">Họ và tên</label><input id="profile-name" value={form.fullName} onChange={event => setForm({ ...form, fullName: event.target.value })} maxLength={100} required />
          <label htmlFor="profile-email">Email</label><input id="profile-email" value={user?.email || ''} readOnly aria-describedby="profile-email-note" /><small id="profile-email-note">Email hiện không thể thay đổi.</small>
          <label htmlFor="profile-avatar">URL ảnh đại diện</label><input id="profile-avatar" type="url" placeholder="https://example.com/avatar.jpg" value={form.avatarUrl} onChange={event => setForm({ ...form, avatarUrl: event.target.value })} maxLength={500} /><small>Dán liên kết ảnh HTTPS, hoặc để trống để dùng chữ viết tắt.</small>
          {error && <p className="profile-error" role="alert">{error}</p>}
          <button className="profile-save" type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
        </form>}
      </section>
    </main>
  </div>;
}

export default ProfilePage;
