import { useEffect, useRef, useState } from 'react';
import { FiArrowLeft, FiArrowRight, FiBookOpen, FiCheckCircle, FiChevronDown, FiChevronLeft, FiChevronRight, FiClock, FiLock, FiSearch, FiX } from 'react-icons/fi';
import './student-courses.css';
import api from '../../services/api.js';
import { formatCoursePrice } from '../course/courseUi.js';

function StudentCourses({ initialView = 'catalog', initialCourseId, onCourseChange }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [modules, setModules] = useState({});
  const [moduleError, setModuleError] = useState('');
  const [enrollments, setEnrollments] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [selectedId, setSelectedId] = useState(() => initialCourseId ? Number(initialCourseId) : null);
  const [category, setCategory] = useState('Tất cả');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('default');
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [expanded, setExpanded] = useState({});
  const [enrollmentFilter, setEnrollmentFilter] = useState('all');
  const [successCourse, setSuccessCourse] = useState(null);
  const enrollmentsRef = useRef([]);
  const announcedIds = useRef(new Set());
  const closeModalRef = useRef(null);

  useEffect(() => { enrollmentsRef.current = enrollments; }, [enrollments]);
  useEffect(() => {
    if (!successCourse) return undefined;
    closeModalRef.current?.focus();
    const onEscape = (event) => { if (event.key === 'Escape') setSuccessCourse(null); };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [successCourse]);

  const loadCourses = async () => {
    setLoading(true);
    setError('');
    try {
      const [{ data }, { data: registered }] = await Promise.all([api.get('/courses/published'), api.get('/enrollments')]);
      setCourses(Array.isArray(data) ? data : []);
      setEnrollments(Array.isArray(registered) ? registered : []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Không thể tải danh sách khóa học.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCourses(); }, []);
  useEffect(() => {
    const courseId = initialCourseId ? Number(initialCourseId) : null;
    setSelectedId(courseId);
    if (courseId) {
      api.get(`/courses/published/${courseId}/modules`)
        .then(({ data }) => setModules((current) => ({ ...current, [courseId]: Array.isArray(data) ? data : [] })))
        .catch((requestError) => setModuleError(requestError.response?.data?.message || 'Không thể tải nội dung khóa học.'));
    }
  }, [initialCourseId]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);

  const enroll = async (courseId) => {
    setBusyId(courseId);
    setError('');
    try {
      const { data } = await api.post(`/enrollments/courses/${courseId}`);
      setEnrollments((current) => [data, ...current.filter((item) => item.courseId !== courseId)]);
      if (data.status === 'ACTIVE' && !announcedIds.current.has(data.enrollmentId)) {
        announcedIds.current.add(data.enrollmentId);
        setSuccessCourse({ courseId: data.courseId, title: data.courseTitle });
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Không thể đăng ký khóa học.');
    } finally { setBusyId(null); }
  };

  const pendingIds = enrollments.filter((item) => item.status === 'PENDING').map((item) => item.enrollmentId).filter(Boolean).join(',');
  useEffect(() => {
    if (!pendingIds) return undefined;
    let stopped = false;
    let checking = false;
    const checkPending = async () => {
      if (checking || document.visibilityState === 'hidden') return;
      checking = true;
      try {
        const latest = await Promise.all(pendingIds.split(',').map((id) => api.get(`/enrollments/${id}`)));
        if (stopped) return;
        const updates = latest.map(({ data }) => data);
        const newlyActive = updates.find((item) => item.status === 'ACTIVE' &&
          enrollmentsRef.current.some((previous) => previous.enrollmentId === item.enrollmentId && previous.status === 'PENDING') &&
          !announcedIds.current.has(item.enrollmentId));
        if (newlyActive) {
          announcedIds.current.add(newlyActive.enrollmentId);
          setSuccessCourse({ courseId: newlyActive.courseId, title: newlyActive.courseTitle });
        }
        setEnrollments((current) => current.map((item) => updates.find((update) => update.enrollmentId === item.enrollmentId) || item));
        for (const item of updates.filter((update) => update.status === 'ACTIVE')) {
          try {
            const { data } = await api.get(`/courses/published/${item.courseId}/modules`);
            if (!stopped) setModules((current) => ({ ...current, [item.courseId]: Array.isArray(data) ? data : [] }));
          } catch { /* The course status is still updated if lessons fail to load. */ }
        }
      } catch { /* A transient network failure is retried on the next interval. */ }
      finally { checking = false; }
    };
    checkPending();
    const timer = setInterval(checkPending, 5000);
    document.addEventListener('visibilitychange', checkPending);
    return () => { stopped = true; clearInterval(timer); document.removeEventListener('visibilitychange', checkPending); };
  }, [pendingIds]);

  const toggleCourse = async (courseId) => {
    if (openId === courseId) { setOpenId(null); return; }
    setOpenId(courseId);
    setModuleError('');
    if (modules[courseId]) return;
    try {
      const { data } = await api.get(`/courses/published/${courseId}/modules`);
      setModules((current) => ({ ...current, [courseId]: Array.isArray(data) ? data : [] }));
    } catch (requestError) {
      setModuleError(requestError.response?.data?.message || 'Không thể tải nội dung khóa học.');
    }
  };

  const displayed = [...courses, ...enrollments.filter((item) => item.status === 'ACTIVE' && !courses.some((course) => course.courseId === item.courseId)).map((item) => ({ courseId: item.courseId, title: item.courseTitle, teacherName: item.teacherName, archived: true, price: 0 }))];
  const categories = ['Tất cả', 'Khóa học miễn phí', 'Khóa học có phí', ...new Set(displayed.map((course) => course.subject).filter(Boolean))];
  const matchesCategory = (course) => category === 'Tất cả' || (category === 'Khóa học miễn phí' && !course.archived && Number(course.price) === 0) || (category === 'Khóa học có phí' && !course.archived && Number(course.price) > 0) || course.subject === category;
  const visible = displayed.filter((course) => matchesCategory(course) && (initialView !== 'enrollment' || enrollments.some((item) => item.courseId === course.courseId)) && [course.title, course.courseCode, course.subject, course.teacherName].join(' ').toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === 'newest' ? String(b.createdAt || '').localeCompare(String(a.createdAt || '')) : sort === 'price' ? Number(a.price || 0) - Number(b.price || 0) : a.courseId - b.courseId);
  const catalogGroups = (category === 'Tất cả' ? [
    { title: 'Khóa học miễn phí', courses: visible.filter((course) => !course.archived && Number(course.price) === 0) },
    { title: 'Khóa học có phí', courses: visible.filter((course) => !course.archived && Number(course.price) > 0) },
    { title: 'Khóa đã lưu trữ', courses: visible.filter((course) => course.archived) },
  ] : [{ title: category, courses: visible }]).filter((group) => group.courses.length);
  const featured = courses.slice(0, 5);
  const selected = displayed.find((course) => course.courseId === selectedId);
  const statusFor = (registration) => registration?.status === 'PENDING' && registration.expiresAt && new Date(registration.expiresAt).getTime() <= now ? 'EXPIRED' : registration?.status;
  const countdown = (registration) => { const n = Math.max(0, Math.ceil((new Date(registration?.expiresAt || 0).getTime() - now) / 1000)); return [Math.floor(n / 3600), Math.floor(n % 3600 / 60), n % 60].map((value) => String(value).padStart(2, '0')).join(':'); };
  const enter = (id) => { toggleCourse(id); setSelectedId(id); onCourseChange?.(id); };
  const successModal = successCourse && <div className="sc-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSuccessCourse(null); }}>
    <div className="sc-success-modal" role="dialog" aria-modal="true" aria-labelledby="sc-success-title" aria-describedby="sc-success-description">
      <button ref={closeModalRef} className="sc-modal-close" aria-label="Đóng thông báo" onClick={() => setSuccessCourse(null)}><FiX /></button>
      <span className="sc-success-icon"><FiCheckCircle aria-hidden="true" /></span>
      <p className="sc-success-eyebrow">ĐĂNG KÝ THÀNH CÔNG</p>
      <h2 id="sc-success-title">Bạn đã đăng ký khóa học thành công!</h2>
      <p id="sc-success-description">Khóa học <strong>{successCourse.title}</strong> đã sẵn sàng. Bạn có thể bắt đầu học ngay bây giờ.</p>
      <button className="sc-success-action" onClick={() => { if (selectedId !== successCourse.courseId) enter(successCourse.courseId); setSuccessCourse(null); }}>Bắt đầu học <FiArrowRight aria-hidden="true" /></button>
    </div>
  </div>;
  const action = (course, registration) => { const status = statusFor(registration); return status === 'ACTIVE' ? <p className="sc-active"><FiCheckCircle /> Đã đăng ký · Có thể học</p> : status === 'PENDING' ? <p className="sc-waiting"><FiClock /> Đang chờ thanh toán</p> : <button className="sc-primary" disabled={busyId === course.courseId || course.archived} onClick={() => enroll(course.courseId)}>{busyId === course.courseId ? 'Đang xử lý…' : status === 'EXPIRED' ? 'Tạo thanh toán mới' : Number(course.price) === 0 ? 'Học miễn phí' : 'Đăng ký khóa học'} <FiArrowRight /></button>; };
  if (loading) return <p className="student-courses-message">Đang tải khóa học…</p>;
  if (error && !displayed.length) return <div className="student-courses-message" role="alert"><p>{error}</p><button onClick={loadCourses}>Thử lại</button></div>;
  if (selected) { const registration = enrollments.find((item) => item.courseId === selected.courseId); const status = statusFor(registration); const lessons = modules[selected.courseId] || []; return <div className="student-courses sc-detail"><button className="sc-back" onClick={() => { setSelectedId(null); onCourseChange?.(null); }}><FiArrowLeft /> Trở lại danh sách</button>{error && <p className="sc-error" role="alert">{error}</p>}<div className="sc-detail-grid"><div className="sc-detail-main"><p className="sc-kicker">{selected.subject || 'KHÓA HỌC'} / {selected.courseCode || 'AMS'}</p><h2>{selected.title}</h2><div className="sc-meta"><span><FiBookOpen /> {lessons.length} học phần</span>{selected.targetAudience && <span>{selected.targetAudience}</span>}</div>{selected.teacherName && <p className="sc-instructor">Giảng viên đứng lớp: <strong>{selected.teacherName}</strong></p>}<p className="sc-description">{selected.description || 'Khám phá kiến thức và nội dung học tập của khóa học này.'}</p><section className="sc-curriculum"><div className="sc-section-heading"><div><p>NỘI DUNG HỌC TẬP</p><h3>Chương trình khóa học</h3></div><span>{lessons.length} học phần</span></div>{moduleError ? <p className="sc-error" role="alert">{moduleError}</p> : !modules[selected.courseId] ? <p>Đang tải học phần…</p> : !lessons.length ? <p>Khóa học chưa có học phần.</p> : <div className="sc-module-list">{lessons.map((module, index) => <div className="sc-module" key={module.moduleId}><button className="sc-module-heading" aria-expanded={!!expanded[module.moduleId]} onClick={() => setExpanded((value) => ({ ...value, [module.moduleId]: !value[module.moduleId] }))}><b>{String(index + 1).padStart(2, '0')}</b><span><strong>{module.title}</strong><small>{module.lessons?.length || 0} bài học</small></span><FiChevronDown /></button>{expanded[module.moduleId] && <div className="sc-lessons">{module.lessons?.map((lesson) => <div className="sc-lesson" key={lesson.lessonId}><FiBookOpen /><div><strong>{lesson.title}</strong>{status === 'ACTIVE' ? <>{lesson.content && <p>{lesson.content}</p>}{lesson.videoUrl && <a href={lesson.videoUrl} target="_blank" rel="noreferrer">Xem video <FiArrowRight /></a>}</> : <small>Nội dung mở sau khi đăng ký</small>}</div>{status !== 'ACTIVE' && <FiLock />}</div>)}</div>}</div>)}</div>}</section></div><aside className="sc-purchase"><div className="sc-cover sc-cover-large"><span>{selected.courseCode || 'AMS'}</span><FiBookOpen /><strong>{selected.subject || 'KHÓA HỌC'}</strong></div><div className="sc-purchase-body"><small>HỌC PHÍ KHÓA HỌC</small><strong className="sc-price">{selected.archived ? 'Đã đăng ký' : formatCoursePrice(selected.price)}</strong>{action(selected, registration)}<p>{status === 'ACTIVE' ? 'Bạn có thể xem toàn bộ bài học.' : 'Xem trước học phần trước khi đăng ký.'}</p></div>{status === 'PENDING' && <div className="sc-payment"><p>Thời gian còn lại <strong>{countdown(registration)}</strong></p><img src={registration.qrUrl} alt={'QR thanh toán khóa ' + selected.title} /><dl><div><dt>Ngân hàng</dt><dd>{registration.bank}</dd></div><div><dt>Số tài khoản</dt><dd>{registration.accountNumber}</dd></div><div><dt>Số tiền</dt><dd>{formatCoursePrice(registration.amount)}</dd></div><div><dt>Nội dung</dt><dd>{registration.transferContent}</dd></div></dl><span className="sc-auto-check" role="status">Hệ thống tự cập nhật khi nhận được thanh toán.</span></div>}{status === 'EXPIRED' && <p className="sc-expired">Yêu cầu thanh toán đã hết hạn. Tạo lượt mới để tiếp tục.</p>}</aside></div>{successModal}</div>; }
  if (initialView === 'enrollment') {
    const registered = enrollments.map((item) => ({ enrollment: item, course: displayed.find((course) => course.courseId === item.courseId) })).filter((item) => item.course);
    const activeCount = registered.filter(({ enrollment }) => statusFor(enrollment) === 'ACTIVE').length;
    const pendingCount = registered.filter(({ enrollment }) => statusFor(enrollment) === 'PENDING').length;
    const filtered = registered.filter(({ enrollment }) => enrollmentFilter === 'all' || statusFor(enrollment)?.toLowerCase() === enrollmentFilter);
    return <div className="student-courses sc-my-courses">
      {error && <p className="sc-error" role="alert">{error}</p>}
      <div className="sc-my-heading"><div><p>HÀNH TRÌNH CỦA BẠN</p><h2>Khóa học của tôi</h2><span>Theo dõi các khóa đã đăng ký và tiếp tục học.</span></div><div className="sc-my-stats"><span><strong>{activeCount}</strong> đang học</span><span><strong>{pendingCount}</strong> chờ thanh toán</span></div></div>
      <div className="sc-my-tabs" role="group" aria-label="Lọc trạng thái đăng ký">{[['all', 'Tất cả'], ['active', 'Đang học'], ['pending', 'Chờ thanh toán'], ['expired', 'Hết hạn']].map(([value, label]) => <button key={value} className={enrollmentFilter === value ? 'is-active' : ''} onClick={() => setEnrollmentFilter(value)}>{label}</button>)}</div>
      {!filtered.length ? <div className="sc-empty"><FiBookOpen /><h3>{registered.length ? 'Không có khóa học ở trạng thái này' : 'Bạn chưa đăng ký khóa học nào'}</h3><p>{registered.length ? 'Chọn trạng thái khác để xem khóa học.' : 'Vào mục Khóa học để khám phá và đăng ký.'}</p></div> : <div className="sc-my-list">{filtered.map(({ enrollment, course }) => { const status = statusFor(enrollment); return <article className="sc-my-row" key={enrollment.enrollmentId}><div className="sc-my-mark"><FiBookOpen /></div><div className="sc-my-info"><small>{course.courseCode || course.subject || 'KHÓA HỌC'}</small><h3>{course.title}</h3><p>{course.teacherName ? 'Giảng viên: ' + course.teacherName : 'Khóa học AMS'}</p></div><div className="sc-my-state"><span className={'sc-my-badge is-' + status?.toLowerCase()}>{status === 'ACTIVE' ? 'Đang học' : status === 'PENDING' ? 'Chờ thanh toán' : 'Đã hết hạn'}</span>{status === 'PENDING' && <small>Còn {countdown(enrollment)}</small>}{status === 'EXPIRED' && <small>Cần tạo lượt thanh toán mới</small>}</div><button className="sc-my-open" onClick={() => enter(course.courseId)}>{status === 'ACTIVE' ? 'Vào học' : 'Xem chi tiết'} <FiArrowRight /></button></article>; })}</div>}
      {successModal}
    </div>;
  }
  return <div className="student-courses sc-catalog">{error && <p className="sc-error" role="alert">{error}</p>}{initialView !== 'enrollment' && featured.length > 0 && <><section className="sc-featured" aria-label="Khóa học nổi bật"><div className="sc-featured-art"><span>{featured[featuredIndex].courseCode || 'AMS'}</span><FiBookOpen /><strong>{featured[featuredIndex].subject || 'HỌC TẬP CÙNG AMS'}</strong></div><div className="sc-featured-copy"><p>KHÁM PHÁ KHÓA HỌC</p><h2>{featured[featuredIndex].title}</h2><span>{featured[featuredIndex].description || 'Bắt đầu hành trình học tập của bạn cùng AMS.'}</span><button onClick={() => enter(featured[featuredIndex].courseId)}>Xem chi tiết <FiArrowRight /></button></div><div className="sc-featured-controls"><button aria-label="Khóa trước" onClick={() => setFeaturedIndex((featuredIndex - 1 + featured.length) % featured.length)}><FiChevronLeft /></button><button aria-label="Khóa tiếp theo" onClick={() => setFeaturedIndex((featuredIndex + 1) % featured.length)}><FiChevronRight /></button></div></section><div className="sc-dots">{featured.map((course, index) => <button key={course.courseId} className={index === featuredIndex ? 'is-active' : ''} aria-label={'Khóa nổi bật ' + (index + 1)} onClick={() => setFeaturedIndex(index)} />)}</div></>}<div className="sc-heading"><div><p>KHÁM PHÁ AMS</p><h2>{initialView === 'enrollment' ? 'Khóa học của tôi' : 'Khóa học'}</h2></div><span>{visible.length} khóa học</span></div><div className="sc-filters"><div className="sc-chips" role="group" aria-label="Lọc môn học">{categories.map((item) => <button className={category === item ? 'is-active' : ''} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="sc-filter-row"><label className="sc-search"><FiSearch /><input aria-label="Tìm khóa học" placeholder="Tìm theo mã hoặc tên khóa học" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="sc-sort">Sắp xếp <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="default">Mặc định</option><option value="newest">Mới nhất</option><option value="price">Giá thấp trước</option></select></label></div></div>{!visible.length ? <div className="sc-empty"><FiBookOpen /><h3>Chưa có khóa học phù hợp</h3><p>Thử từ khóa hoặc bộ lọc khác.</p></div> : <div className="sc-catalog-groups">{catalogGroups.map((group) => <section className="sc-catalog-group" key={group.title}><div className="sc-group-heading"><h3>{group.title}</h3><span>{group.courses.length} khóa học</span></div><div className="sc-course-grid">{group.courses.map((course) => { const registration = enrollments.find((item) => item.courseId === course.courseId); const status = statusFor(registration); return <article className="sc-card" key={course.courseId}><button className="sc-card-open" onClick={() => enter(course.courseId)}><div className="sc-cover"><span>{course.courseCode || 'AMS'}</span><FiBookOpen /><strong>{course.subject || 'KHÓA HỌC'}</strong></div><div className="sc-card-body"><span className="sc-card-subject">{course.subject || 'Khóa học'} · {course.archived ? 'Đã lưu trữ' : formatCoursePrice(course.price)}</span><h3>{course.title}</h3><p>{course.description || 'Khám phá nội dung và học phần của khóa học này.'}</p>{course.teacherName && <span className="sc-card-teacher">Giảng viên: {course.teacherName}</span>}<span className="sc-card-more">Xem khóa học <FiArrowRight /></span></div></button>{status && <div className={'sc-card-status sc-card-status-' + status.toLowerCase()}>{status === 'ACTIVE' ? <><FiCheckCircle /> Đã đăng ký</> : status === 'PENDING' ? <><FiClock /> Chờ thanh toán</> : 'Đã hết hạn'}</div>}</article>; })}</div></section>)}</div>}{successModal}</div>;
}

export default StudentCourses;
