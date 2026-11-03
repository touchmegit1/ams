import test from 'node:test';
import assert from 'node:assert/strict';
import { selectTeacherDashboardCourses } from '../src/pages/dashboard/teacherDashboard.js';

test('shows up to three courses with the most submissions waiting for review', () => {
  const courses = [
    { courseId: 1, pendingReviewCount: 1 },
    { courseId: 2, pendingReviewCount: 8 },
    { courseId: 3, pendingReviewCount: 4 },
    { courseId: 4, pendingReviewCount: 7 },
    { courseId: 5, pendingReviewCount: 2 },
  ];

  const result = selectTeacherDashboardCourses(courses);

  assert.deepEqual(result.reviewCourses.map((course) => course.courseId), [2, 4, 3]);
  assert.equal(result.reviewCourses.length, 3);
});

test('shows up to three newest courses after excluding review shortcuts', () => {
  const courses = [
    { courseId: 1, pendingReviewCount: 0 },
    { courseId: 2, pendingReviewCount: 3 },
    { courseId: 3, pendingReviewCount: 0 },
    { courseId: 4, pendingReviewCount: 0 },
    { courseId: 5, pendingReviewCount: 0 },
    { courseId: 6, pendingReviewCount: 0 },
  ];

  const result = selectTeacherDashboardCourses(courses);

  assert.deepEqual(result.recentCourses.map((course) => course.courseId), [1, 3, 4]);
});

test('returns empty lists when there are no courses', () => {
  assert.deepEqual(selectTeacherDashboardCourses([]), { reviewCourses: [], recentCourses: [] });
  assert.deepEqual(selectTeacherDashboardCourses(null), { reviewCourses: [], recentCourses: [] });
});
