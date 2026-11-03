export function selectTeacherDashboardCourses(courses) {
  const orderedCourses = Array.isArray(courses) ? courses : [];
  const reviewCourses = orderedCourses
    .filter((course) => Number(course.pendingReviewCount) > 0)
    .sort((left, right) => Number(right.pendingReviewCount) - Number(left.pendingReviewCount))
    .slice(0, 3);
  const reviewIds = new Set(reviewCourses.map((course) => String(course.courseId)));
  const recentCourses = orderedCourses
    .filter((course) => !reviewIds.has(String(course.courseId)))
    .slice(0, 3);

  return { reviewCourses, recentCourses };
}
