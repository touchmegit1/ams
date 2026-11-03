import test from 'node:test';
import assert from 'node:assert/strict';
import { filterAssignmentsByCourse, activeEnrollments, upcomingAssignments } from '../src/pages/dashboard/studentLearning.js';

test('shows only assignments belonging to the open course', () => {
  const items = [{ id: 1, subjectId: 12 }, { id: 2, subjectId: 13 }, { id: 3, subjectId: '12' }];
  assert.deepEqual(filterAssignmentsByCourse(items, 12).map((item) => item.id), [1, 3]);
});

test('keeps the general assignment list unfiltered when no course is selected', () => {
  const items = [{ id: 1 }, { id: 2 }];
  assert.deepEqual(filterAssignmentsByCourse(items, null), items);
});

test('my courses contains only active enrollments', () => {
  const enrollments = [{ courseId: 1, status: 'ACTIVE' }, { courseId: 2, status: 'PENDING' }, { courseId: 3, status: 'EXPIRED' }];
  assert.deepEqual(activeEnrollments(enrollments).map((item) => item.courseId), [1]);
});

test('dashboard prioritizes open assignments by nearest deadline', () => {
  const assignments = [
    { id: 1, status: 'PUBLISHED', dueDate: '2026-11-06T10:00:00' },
    { id: 2, status: 'CLOSED', dueDate: '2026-11-04T10:00:00' },
    { id: 3, status: 'PUBLISHED', dueDate: '2026-11-04T09:00:00' },
    { id: 4, status: 'PUBLISHED', dueDate: '2026-11-02T09:00:00' },
  ];
  assert.deepEqual(upcomingAssignments(assignments, Date.parse('2026-11-03T00:00:00')).map(({ id }) => id), [3, 1]);
});
