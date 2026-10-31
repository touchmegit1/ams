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
            <p className="cm-eyebrow">COURSE DETAILS</p>
            <h2 id="course-form-title">{editing ? 'Edit course' : 'Create a course'}</h2>
          </div>
          <button className="cm-icon-button" type="button" onClick={onClose} aria-label="Close">×</button>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="cm-modal-body">
            <div className="cm-form-grid">
              <label className="cm-field">
                <span>Course code <b>*</b></span>
                <input name="courseCode" required maxLength="32" defaultValue={initialCourse?.courseCode || ''} placeholder="e.g. CS304" />
              </label>
              <label className="cm-field">
                <span>Course title <b>*</b></span>
                <input name="title" required maxLength="200" defaultValue={initialCourse?.title || ''} placeholder="Enter a clear course title" />
              </label>
              <label className="cm-field">
                <span>Subject / department <b>*</b></span>
                <input name="subject" required maxLength="120" defaultValue={initialCourse?.subject || ''} placeholder="e.g. Software Engineering" />
              </label>
              <label className="cm-field">
                <span>Target audience</span>
                <input name="targetAudience" maxLength="200" defaultValue={initialCourse?.targetAudience || ''} placeholder="e.g. 3rd year students" />
              </label>
              <label className="cm-field cm-field-wide">
                <span>Course description</span>
                <textarea name="description" maxLength="10000" rows="4" defaultValue={initialCourse?.description || ''} placeholder="Describe what learners will study." />
              </label>
              <label className="cm-field">
                <span>Price (VND)</span>
                <input name="price" type="number" min="0" step="0.01" defaultValue={initialCourse?.price ?? 0} />
              </label>
              {editing && (
                <label className="cm-field">
                  <span>Status</span>
                  <select name="status" defaultValue={status}>
                    {(STATUS_OPTIONS[status] || [status]).map((option) => (
                      <option value={option} key={option}>{option}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {submitError && <p className="cm-form-error" role="alert">{submitError}</p>}
            <p className="cm-form-note">Courses start as drafts. You can publish them once the course structure is ready.</p>
          </div>
          <footer className="cm-modal-footer">
            <button className="cm-button cm-button-quiet" type="button" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="cm-button cm-button-primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create course'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default CourseForm;
