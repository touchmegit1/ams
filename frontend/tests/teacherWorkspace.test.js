import test from 'node:test';
import assert from 'node:assert/strict';
import { courseStatusLabel, formatCoursePrice } from '../src/pages/course/courseUi.js';

test('courseStatusLabel correctly maps all course statuses in Vietnamese', () => {
  assert.equal(courseStatusLabel.DRAFT, 'Bản nháp');
  assert.equal(courseStatusLabel.PUBLISHED, 'Đã xuất bản');
  assert.equal(courseStatusLabel.ARCHIVED, 'Đã lưu trữ');
});

test('formatCoursePrice handles free, zero, and paid amounts', () => {
  assert.equal(formatCoursePrice(0), 'Miễn phí');
  assert.equal(formatCoursePrice('0.00'), 'Miễn phí');
  assert.ok(formatCoursePrice(50000).includes('50.000'));
  assert.ok(formatCoursePrice('100000.00').includes('100.000'));
});

test('teacher progress calculation convention: overall is average of lesson and assignment progress', () => {
  const calculateOverall = (lessonPercent, assignmentPercent) => {
    const l = Number(lessonPercent) || 0;
    const a = Number(assignmentPercent) || 0;
    return Number(((l + a) / 2).toFixed(2));
  };

  assert.equal(calculateOverall(100, 50), 75.0);
  assert.equal(calculateOverall(0, 0), 0.0);
  assert.equal(calculateOverall(80, 90), 85.0);
  assert.equal(calculateOverall(33.33, 66.67), 50.0);
});

test('matches student query by name or email case-insensitively', () => {
  const matches = (student, query, status) => {
    const q = (query || '').trim().toLowerCase();
    const matchesQuery = !q || `${student.fullName} ${student.email}`.toLowerCase().includes(q);
    const matchesStatus = !status || status === 'ALL' || student.status === status;
    return matchesQuery && matchesStatus;
  };

  const s1 = { fullName: 'Nguyễn Văn An', email: 'an.nguyen@test.com', status: 'ACTIVE' };
  const s2 = { fullName: 'Trần Thị Bình', email: 'binh.tran@test.com', status: 'PENDING' };

  assert.equal(matches(s1, 'văn an', 'ALL'), true);
  assert.equal(matches(s1, 'test.com', 'ACTIVE'), true);
  assert.equal(matches(s1, 'test.com', 'PENDING'), false);
  assert.equal(matches(s2, 'bình', 'PENDING'), true);
  assert.equal(matches(s2, 'bình', 'ACTIVE'), false);
  assert.equal(matches(s2, 'không tồn tại', 'ALL'), false);
});
