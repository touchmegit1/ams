import { courseStatusLabel } from '../../pages/course/courseUi.js';

const STATUS_OPTIONS = {
  DRAFT: ['DRAFT', 'PUBLISHED'],
  PUBLISHED: ['PUBLISHED', 'ARCHIVED'],
  ARCHIVED: ['ARCHIVED', 'DRAFT'],
};

function CourseForm({ initialCourse, onClose, onSubmit, saving, submitError }) {
  const editing = Boolean(initialCourse);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await onSubmit({
      courseCode: form.get('courseCode').trim(),
      title: form.get('title').trim(),
      subject: form.get('subject').trim(),
      targetAudience: form.get('targetAudience').trim(),
      description: form.get('description').trim(),
      price: Number(form.get('price') || 0),
      status: form.get('status'),
    });
  };

  const status = initialCourse?.status || 'DRAFT';

  return (
    <div className="cm-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="cm-modal" role="dialog" aria-modal="true" aria-labelledby="course-form-title">
        <header className="cm-modal-header">
          <div>
            <p className="cm-eyebrow">THÔNG TIN KHÓA HỌC</p>
            <h2 id="course-form-title">{editing ? 'Sửa khóa học' : 'Tạo khóa học'}</h2>
          </div>
          <button className="cm-icon-button" type="button" onClick={onClose} aria-label="Đóng">×</button>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="cm-modal-body">
            <div className="cm-form-grid">
              <label className="cm-field">
                <span>Mã khóa học <b>*</b></span>
                <input name="courseCode" required maxLength="32" defaultValue={initialCourse?.courseCode || ''} placeholder="Ví dụ: CS304" />
              </label>
              <label className="cm-field">
                <span>Tên khóa học <b>*</b></span>
                <input name="title" required maxLength="200" defaultValue={initialCourse?.title || ''} placeholder="Nhập tên khóa học" />
              </label>
              <label className="cm-field">
                <span>Môn học / bộ môn <b>*</b></span>
                <input name="subject" required maxLength="120" defaultValue={initialCourse?.subject || ''} placeholder="Ví dụ: Kỹ thuật phần mềm" />
              </label>
              <label className="cm-field">
                <span>Đối tượng học</span>
                <input name="targetAudience" maxLength="200" defaultValue={initialCourse?.targetAudience || ''} placeholder="Ví dụ: Sinh viên năm 3" />
              </label>
              <label className="cm-field cm-field-wide">
                <span>Mô tả khóa học</span>
                <textarea name="description" maxLength="10000" rows="4" defaultValue={initialCourse?.description || ''} placeholder="Mô tả nội dung người học sẽ học." />
              </label>
              <label className="cm-field">
                <span>Học phí (VND)</span>
                <input name="price" type="number" min="0" step="0.01" defaultValue={initialCourse?.price ?? 0} />
              </label>
              {editing && (
                <label className="cm-field">
                  <span>Trạng thái</span>
                  <select name="status" defaultValue={status}>
                    {(STATUS_OPTIONS[status] || [status]).map((option) => (
                      <option value={option} key={option}>{courseStatusLabel[option] || option}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {submitError && <p className="cm-form-error" role="alert">{submitError}</p>}
            <p className="cm-form-note">Khóa học mới ở trạng thái bản nháp. Bạn có thể xuất bản sau khi hoàn thiện nội dung.</p>
          </div>
          <footer className="cm-modal-footer">
            <button className="cm-button cm-button-quiet" type="button" onClick={onClose} disabled={saving}>Hủy</button>
            <button className="cm-button cm-button-primary" type="submit" disabled={saving}>
              {saving ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Tạo khóa học'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default CourseForm;
