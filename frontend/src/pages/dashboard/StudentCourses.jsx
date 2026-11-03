import { useEffect, useRef, useState } from 'react';
import { FiArrowLeft, FiArrowRight, FiBookOpen, FiCheckCircle, FiChevronDown, FiChevronLeft, FiChevronRight, FiLock, FiSearch, FiX } from 'react-icons/fi';
import './student-courses.css';
import api from '../../services/api.js';
import StudentAssignments from './StudentAssignments.jsx';
import { activeEnrollments } from './studentLearning.js';
import { formatCoursePrice } from '../course/courseUi.js';

function StudentCourses({ initialView = 'catalog', initialCourseId, initialCourseTab, onCourseChange }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [modules, setModules] = useState({});
  const [moduleError, setModuleError] = useState('');
  const [enrollments, setEnrollments] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [selectedId, setSelectedId] = useState(() => initialCourseId ? Number(initialCourseId) : null);
  const [courseTab, setCourseTab] = useState('lessons');
  const [category, setCategory] = useState('Tất cả');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('default');
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [expanded, setExpanded] = useState({});
  const [successCourse, setSuccessCourse] = useState(null);
  const [paymentModalData, setPaymentModalData] = useState(null);
  const [copyNotice, setCopyNotice] = useState('');
  const announcedIds = useRef(new Set());
  const closeModalRef = useRef(null);

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopyNotice(`Đã sao chép ${label}!`);
    setTimeout(() => setCopyNotice(''), 2500);
  };

  // Tự động kiểm tra trạng thái thanh toán từ ngân hàng khi mở modal thanh toán (mỗi 2 giây)
  useEffect(() => {
    if (!paymentModalData) return undefined;
    let isCancelled = false;

    const checkPayment = async () => {
      try {
        const { data } = await api.get(`/enrollments/courses/${paymentModalData.courseId}/status`);
        if (!isCancelled && data && data.status === 'ACTIVE') {
          const course = paymentModalData.course;
          setEnrollments((current) => [data, ...current.filter((item) => item.courseId !== paymentModalData.courseId)]);
          try {
            const { data: contents } = await api.get(`/courses/published/${paymentModalData.courseId}/modules`);
            setModules((current) => ({ ...current, [paymentModalData.courseId]: Array.isArray(contents) ? contents : [] }));
          } catch (_) {}
          setPaymentModalData(null);
          setSuccessCourse({ courseId: course.courseId, title: course.title });
        }
      } catch (_) {}
    };

    const interval = setInterval(checkPayment, 2000);
    checkPayment();
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [paymentModalData]);

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
  useEffect(() => {
    if (initialCourseTab === 'assignments' || initialCourseTab === 'lessons') setCourseTab(initialCourseTab);
  }, [initialCourseTab]);

  const displayed = [...courses, ...enrollments.filter((item) => item.status === 'ACTIVE' && !courses.some((course) => course.courseId === item.courseId)).map((item) => ({ courseId: item.courseId, title: item.courseTitle, teacherName: item.teacherName, archived: true, price: 0 }))];

  const enroll = async (courseId) => {
    setBusyId(courseId);
    setError('');
    try {
      const { data } = await api.post(`/enrollments/courses/${courseId}`);
      setEnrollments((current) => [data, ...current.filter((item) => item.courseId !== courseId)]);
      if (data.status === 'ACTIVE' && !announcedIds.current.has(data.enrollmentId)) {
        announcedIds.current.add(data.enrollmentId);
        setSuccessCourse({ courseId: data.courseId, title: data.courseTitle });
        try {
          const { data: contents } = await api.get(`/courses/published/${courseId}/modules`);
          setModules((current) => ({ ...current, [courseId]: Array.isArray(contents) ? contents : [] }));
        } catch (requestError) {
          setModuleError(requestError.response?.data?.message || 'Bạn đã tham gia khóa học, nhưng chưa tải được nội dung. Hãy thử mở lại khóa học.');
        }
      } else if (data.status === 'PENDING') {
        const targetCourse = displayed.find((c) => c.courseId === courseId) || { courseId: data.courseId, title: data.courseTitle };
        setPaymentModalData({
          course: targetCourse,
          courseId: data.courseId,
          courseTitle: data.courseTitle,
          amount: data.amount,
          orderCode: data.orderCode,
          bank: data.bank,
          accountNumber: data.accountNumber,
          qrUrl: data.qrUrl || `https://vietqr.app/img?acc=VQRQAHKMG5868&bank=MBBank&amount=${data.amount}&des=${data.orderCode}`
        });
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Không thể đăng ký khóa học.');
    } finally { setBusyId(null); }
  };

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

  const categories = ['Tất cả', 'Khóa học miễn phí', 'Khóa học có phí', ...new Set(displayed.map((course) => course.subject).filter(Boolean))];
  const matchesCategory = (course) => category === 'Tất cả' || (category === 'Khóa học miễn phí' && !course.archived && Number(course.price) === 0) || (category === 'Khóa học có phí' && !course.archived && Number(course.price) > 0) || course.subject === category;
  const visible = displayed.filter((course) => matchesCategory(course) && (initialView !== 'enrollment' || activeEnrollments(enrollments).some((item) => item.courseId === course.courseId)) && [course.title, course.courseCode, course.subject, course.teacherName].join(' ').toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === 'newest' ? String(b.createdAt || '').localeCompare(String(a.createdAt || '')) : sort === 'price' ? Number(a.price || 0) - Number(b.price || 0) : a.courseId - b.courseId);
  const catalogGroups = (category === 'Tất cả' ? [
    { title: 'Khóa học miễn phí', courses: visible.filter((course) => !course.archived && Number(course.price) === 0) },
    { title: 'Khóa học có phí', courses: visible.filter((course) => !course.archived && Number(course.price) > 0) },
    { title: 'Khóa đã lưu trữ', courses: visible.filter((course) => course.archived) },
  ] : [{ title: category, courses: visible }]).filter((group) => group.courses.length);
  const featured = courses.slice(0, 5);
  const selected = displayed.find((course) => course.courseId === selectedId);
  const statusFor = (registration) => registration?.status;
  const enter = (id, tab = 'lessons') => { toggleCourse(id); setSelectedId(id); setCourseTab(tab); onCourseChange?.(id, tab); };
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

  const paymentModal = paymentModalData && (
    <div className="sc-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setPaymentModalData(null); }}>
      <div className="sc-payment-modal" role="dialog" aria-modal="true" aria-labelledby="sc-payment-title">
        <button className="sc-modal-close" aria-label="Đóng màn hình thanh toán" onClick={() => setPaymentModalData(null)}>
          <FiX />
        </button>
        <div className="sc-payment-header">
          <span className="sc-payment-badge">MÃ VIETQR QUA NGÂN HÀNG</span>
          <h2 id="sc-payment-title">Thanh toán học phí khóa học</h2>
          <p><strong>{paymentModalData.courseTitle || paymentModalData.course?.title}</strong></p>
        </div>

        <div className="sc-payment-content">
          <div className="sc-qr-wrap">
            <img
              src={paymentModalData.qrUrl}
              alt="Mã QR chuyển khoản"
              className="sc-qr-code"
            />
            <span className="sc-qr-hint">Quét mã bằng app ngân hàng để chuyển khoản đúng số tiền</span>
          </div>

          <div className="sc-payment-details">
            <div className="sc-payment-row">
              <span>Ngân hàng thụ hưởng:</span>
              <strong>{paymentModalData.bank || 'MBBank'}</strong>
            </div>
            <div className="sc-payment-row">
              <span>Số tài khoản:</span>
              <div>
                <strong>{paymentModalData.accountNumber || 'VQRQAHKMG5868'}</strong>
                <button type="button" className="sc-copy-btn" onClick={() => copyToClipboard(paymentModalData.accountNumber || 'VQRQAHKMG5868', 'Số tài khoản')}>Copy</button>
              </div>
            </div>
            <div className="sc-payment-row">
              <span>Số tiền chuyển khoản:</span>
              <div>
                <strong className="sc-payment-amount">{formatCoursePrice(paymentModalData.amount)}</strong>
                <button type="button" className="sc-copy-btn" onClick={() => copyToClipboard(String(paymentModalData.amount), 'Số tiền')}>Copy</button>
              </div>
            </div>
            <div className="sc-payment-row">
              <span>Nội dung chuyển khoản:</span>
              <div>
                <strong className="sc-payment-order-code">{paymentModalData.orderCode}</strong>
                <button type="button" className="sc-copy-btn" onClick={() => copyToClipboard(paymentModalData.orderCode, 'Nội dung chuyển khoản')}>Copy</button>
              </div>
            </div>

            {copyNotice && <div className="sc-copy-toast">{copyNotice}</div>}

            <div className="sc-payment-notice-box">
              <div className="sc-payment-status-row">
                <span className="sc-pulse-ring" />
                <p>Trong quá trình thanh toán có thể mất một vài phút, vui lòng chờ.</p>
              </div>
            </div>


          </div>
        </div>
      </div>
    </div>
  );

  const action = (course, registration) => {
    const status = statusFor(registration);
    return status === 'ACTIVE' ? (
      <p className="sc-active"><FiCheckCircle /> Đã tham gia · Có thể học</p>
    ) : (
      <button
        className="sc-primary"
        disabled={busyId === course.courseId || course.archived}
        onClick={() => enroll(course.courseId)}
      >
        {busyId === course.courseId
          ? 'Đang xử lý…'
          : Number(course.price) === 0
          ? 'Học miễn phí'
          : 'Đăng ký & Thanh toán'}{' '}
        <FiArrowRight />
      </button>
    );
  };
  if (loading) return <p className="student-courses-message">Đang tải khóa học…</p>;
  if (error && !displayed.length) return <div className="student-courses-message" role="alert"><p>{error}</p><button onClick={loadCourses}>Thử lại</button></div>;
  if (selected) {
    const registration = enrollments.find((entry) => entry.courseId === selected.courseId);
    const status = statusFor(registration);
    const lessons = modules[selected.courseId] || [];
    return <div className="student-courses sc-detail">
      <button className="sc-back" onClick={() => { setSelectedId(null); onCourseChange?.(null); }}><FiArrowLeft /> Trở lại danh sách</button>
      {error && <p className="sc-error" role="alert">{error}</p>}
      <div className="sc-detail-grid">
        <div className="sc-detail-main">
          <p className="sc-kicker">{selected.subject || 'KHÓA HỌC'} / {selected.courseCode || 'AMS'}</p>
          <h2>{selected.title}</h2>
          <div className="sc-meta"><span><FiBookOpen /> {lessons.length} học phần</span>{selected.targetAudience && <span>{selected.targetAudience}</span>}</div>
          {selected.teacherName && <p className="sc-instructor">Giảng viên đứng lớp: <strong>{selected.teacherName}</strong></p>}
          <p className="sc-description">{selected.description || 'Khám phá kiến thức và nội dung học tập của khóa học này.'}</p>
          <div className="sc-course-tabs" role="tablist" aria-label="Nội dung khóa học">
            <button role="tab" aria-selected={courseTab === 'lessons'} className={courseTab === 'lessons' ? 'is-active' : ''} onClick={() => setCourseTab('lessons')}>Chương trình học</button>
            <button role="tab" aria-selected={courseTab === 'assignments'} className={courseTab === 'assignments' ? 'is-active' : ''} onClick={() => setCourseTab('assignments')}>Bài tập</button>
          </div>
          {courseTab === 'lessons' ? <section className="sc-curriculum">
            <div className="sc-section-heading"><div><p>NỘI DUNG HỌC TẬP</p><h3>Chương trình khóa học</h3></div><span>{lessons.length} học phần</span></div>
            {moduleError ? <p className="sc-error" role="alert">{moduleError}</p> : !modules[selected.courseId] ? <p>Đang tải học phần…</p> : !lessons.length ? <p>Khóa học chưa có học phần.</p> : <div className="sc-module-list">{lessons.map((module, index) => <div className="sc-module" key={module.moduleId}>
              <button className="sc-module-heading" aria-expanded={!!expanded[module.moduleId]} onClick={() => setExpanded((value) => ({ ...value, [module.moduleId]: !value[module.moduleId] }))}><b>{String(index + 1).padStart(2, '0')}</b><span><strong>{module.title}</strong><small>{module.lessons?.length || 0} bài học</small></span><FiChevronDown /></button>
              {expanded[module.moduleId] && <div className="sc-lessons">{module.lessons?.map((lesson) => <div className="sc-lesson" key={lesson.lessonId}><FiBookOpen /><div><strong>{lesson.title}</strong>{status === 'ACTIVE' ? <>{lesson.content && <p>{lesson.content}</p>}{lesson.videoUrl && <a href={lesson.videoUrl} target="_blank" rel="noreferrer">Xem video <FiArrowRight /></a>}</> : <small>Nội dung mở sau khi tham gia khóa học</small>}</div>{status !== 'ACTIVE' && <FiLock />}</div>)}</div>}
            </div>)}</div>}
          </section> : status === 'ACTIVE' ? <StudentAssignments courseId={selected.courseId} /> : <div className="sc-locked-assignments"><FiLock /><h3>Bài tập của khóa học</h3><p>Tham gia khóa học để xem bài tập và gửi bài cho giảng viên.</p>{action(selected, registration)}</div>}
        </div>
        <aside className="sc-purchase">
          <div className="sc-cover sc-cover-large"><span>{selected.courseCode || 'AMS'}</span><FiBookOpen /><strong>{selected.subject || 'KHÓA HỌC'}</strong></div>
          <div className="sc-purchase-body"><small>HỌC PHÍ KHÓA HỌC</small><strong className="sc-price">{selected.archived ? 'Không còn khả dụng' : formatCoursePrice(selected.price)}</strong>{action(selected, registration)}<p>{status === 'ACTIVE' ? 'Bạn có thể xem bài học và bài tập của khóa.' : 'Xem trước nội dung và tham gia để bắt đầu học.'}</p></div>
        </aside>
      </div>
      {successModal}{paymentModal}
    </div>;
  }
  if (initialView === 'enrollment') {
    const registered = activeEnrollments(enrollments).map((item) => ({ enrollment: item, course: displayed.find((course) => course.courseId === item.courseId) })).filter((item) => item.course);
    return <div className="student-courses sc-my-courses">
      {error && <p className="sc-error" role="alert">{error}</p>}
      <div className="sc-my-heading"><div><p>HÀNH TRÌNH CỦA BẠN</p><h2>Khóa học của tôi</h2><span>Tiếp tục học trong các khóa bạn đã tham gia.</span></div><div className="sc-my-stats"><span><strong>{registered.length}</strong> khóa đang học</span></div></div>
      {!registered.length ? <div className="sc-empty"><FiBookOpen /><h3>Bạn chưa tham gia khóa học nào</h3><p>Khám phá khóa học và tham gia để bắt đầu học.</p></div> : <div className="sc-my-list">{registered.map(({ enrollment, course }) => <article className="sc-my-row" key={enrollment.enrollmentId}><div className="sc-my-mark"><FiBookOpen /></div><div className="sc-my-info"><small>{course.courseCode || course.subject || 'KHÓA HỌC'}</small><h3>{course.title}</h3><p>{course.teacherName ? 'Giảng viên: ' + course.teacherName : 'Khóa học AMS'}{!course.archived && <> · Học phí: {formatCoursePrice(course.price)}{Number(course.price) > 0 ? ' · Chưa thu' : ''}</>}</p></div><div className="sc-my-state"><span className="sc-my-badge is-active">Đang học</span><small>Đã tham gia {enrollment.activatedAt ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(enrollment.activatedAt)) : ''}</small></div><button className="sc-my-open" onClick={() => enter(course.courseId)}>Tiếp tục học <FiArrowRight /></button></article>)}</div>}
      {successModal}{paymentModal}
    </div>;
  }
  return <div className="student-courses sc-catalog">{error && <p className="sc-error" role="alert">{error}</p>}{featured.length > 0 && <><section className="sc-featured" aria-label="Khóa học nổi bật"><div className="sc-featured-art"><span>{featured[featuredIndex].courseCode || 'AMS'}</span><FiBookOpen /><strong>{featured[featuredIndex].subject || 'HỌC TẬP CÙNG AMS'}</strong></div><div className="sc-featured-copy"><p>KHÁM PHÁ KHÓA HỌC</p><h2>{featured[featuredIndex].title}</h2><span>{featured[featuredIndex].description || 'Bắt đầu hành trình học tập của bạn cùng AMS.'}</span><button onClick={() => enter(featured[featuredIndex].courseId)}>Xem chi tiết <FiArrowRight /></button></div><div className="sc-featured-controls"><button aria-label="Khóa trước" onClick={() => setFeaturedIndex((featuredIndex - 1 + featured.length) % featured.length)}><FiChevronLeft /></button><button aria-label="Khóa tiếp theo" onClick={() => setFeaturedIndex((featuredIndex + 1) % featured.length)}><FiChevronRight /></button></div></section><div className="sc-dots">{featured.map((course, index) => <button key={course.courseId} className={index === featuredIndex ? 'is-active' : ''} aria-label={'Khóa nổi bật ' + (index + 1)} onClick={() => setFeaturedIndex(index)} />)}</div></>}<div className="sc-heading"><div><p>KHÁM PHÁ AMS</p><h2>Khám phá khóa học</h2></div><span>{visible.length} khóa học</span></div><div className="sc-filters"><div className="sc-chips" role="group" aria-label="Lọc môn học">{categories.map((item) => <button className={category === item ? 'is-active' : ''} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="sc-filter-row"><label className="sc-search"><FiSearch /><input aria-label="Tìm khóa học" placeholder="Tìm theo mã hoặc tên khóa học" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="sc-sort">Sắp xếp <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="default">Mặc định</option><option value="newest">Mới nhất</option><option value="price">Giá thấp trước</option></select></label></div></div>{!visible.length ? <div className="sc-empty"><FiBookOpen /><h3>Chưa có khóa học phù hợp</h3><p>Thử từ khóa hoặc bộ lọc khác.</p></div> : <div className="sc-catalog-groups">{catalogGroups.map((group) => <section className="sc-catalog-group" key={group.title}><div className="sc-group-heading"><h3>{group.title}</h3><span>{group.courses.length} khóa học</span></div><div className="sc-course-grid">{group.courses.map((course) => { const registration = enrollments.find((item) => item.courseId === course.courseId); const status = statusFor(registration); return <article className="sc-card" key={course.courseId}><button className="sc-card-open" onClick={() => enter(course.courseId)}><div className="sc-cover"><span>{course.courseCode || 'AMS'}</span><FiBookOpen /><strong>{course.subject || 'KHÓA HỌC'}</strong></div><div className="sc-card-body"><span className="sc-card-subject">{course.subject || 'Khóa học'} · {course.archived ? 'Đã lưu trữ' : formatCoursePrice(course.price)}</span><h3>{course.title}</h3><p>{course.description || 'Khám phá nội dung và học phần của khóa học này.'}</p>{course.teacherName && <span className="sc-card-teacher">Giảng viên: {course.teacherName}</span>}<span className="sc-card-more">Xem khóa học <FiArrowRight /></span></div></button>{status && <div className={'sc-card-status sc-card-status-' + status.toLowerCase()}>{status === 'ACTIVE' ? <><FiCheckCircle /> Đang học</> : 'Chưa tham gia'}</div>}</article>; })}</div></section>)}</div>}{successModal}{paymentModal}</div>;
}

export default StudentCourses;
