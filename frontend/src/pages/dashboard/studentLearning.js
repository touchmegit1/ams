export function filterAssignmentsByCourse(items, courseId) {
  if (courseId == null) return items || [];
  return (items || []).filter((item) => String(item.subjectId) === String(courseId));
}

export function activeEnrollments(enrollments) {
  return (enrollments || []).filter((enrollment) => enrollment.status === 'ACTIVE');
}

export function upcomingAssignments(assignments, now = Date.now()) {
  return (assignments || [])
    .filter((assignment) => assignment.status === 'PUBLISHED' && new Date(assignment.dueDate).getTime() > now)
    .sort((left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime());
}
