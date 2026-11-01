export const courseStatusLabel = {
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Đã xuất bản',
  ARCHIVED: 'Đã lưu trữ',
};

export const formatCoursePrice = (value) => Number(value || 0) === 0
  ? 'Miễn phí'
  : new Intl.NumberFormat('vi-VN', {
    style: 'currency', currency: 'VND', maximumFractionDigits: 0,
  }).format(value);
