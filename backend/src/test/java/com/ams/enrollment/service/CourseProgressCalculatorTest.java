package com.ams.enrollment.service;

import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import static org.assertj.core.api.Assertions.assertThat;

class CourseProgressCalculatorTest {
    private final CourseProgressCalculator calculator = new CourseProgressCalculator();
    private final LocalDateTime now = LocalDateTime.parse("2026-11-02T12:00:00");

    @Test void calculatesLessonAssignmentAndOverallProgressExcludingDraftAssignments() {
        var result = calculator.calculate(
            List.of(new CourseProgressCalculator.LessonUnit(1, "Intro"), new CourseProgressCalculator.LessonUnit(2, "Next")),
            Set.of(1),
            List.of(new CourseProgressCalculator.AssignmentUnit(10, "Required", "PUBLISHED", now.plusDays(2), new BigDecimal("10")),
                new CourseProgressCalculator.AssignmentUnit(11, "Draft", "DRAFT", now.plusDays(2), new BigDecimal("10"))),
            List.of(new CourseProgressCalculator.SubmissionAttempt(10, "EVALUATED", now.minusDays(1), new BigDecimal("8"), null)),
            List.of(), now);

        assertThat(result.completedLessons()).isEqualTo(1);
        assertThat(result.lessonProgressPercent()).isEqualByComparingTo("50.00");
        assertThat(result.completedAssignments()).isEqualTo(1);
        assertThat(result.requiredAssignments()).isEqualTo(1);
        assertThat(result.overallProgressPercent()).isEqualByComparingTo("75.00");
        assertThat(result.averageScorePercent()).isEqualByComparingTo("80.00");
    }

    @Test void usesLatestScoredAttemptPerAssignmentAndIncludesLegacyQuizHistoryOnce() {
        var result = calculator.calculate(List.of(), Set.of(),
            List.of(new CourseProgressCalculator.AssignmentUnit(20, "Quiz", "CLOSED", now.minusDays(1), new BigDecimal("20"))),
            List.of(new CourseProgressCalculator.SubmissionAttempt(20, "TEACHER_REVIEWED", now, new BigDecimal("15"), new BigDecimal("18"))),
            List.of(new CourseProgressCalculator.LegacyQuizAttempt(20, new BigDecimal("10"), now.minusDays(1))), now);

        assertThat(result.assignments()).singleElement().satisfies(item -> {
            assertThat(item.status()).isEqualTo("SUBMITTED");
            assertThat(item.score()).isEqualByComparingTo("18");
            assertThat(item.scorePercent()).isEqualByComparingTo("90.00");
        });
        assertThat(result.averageScorePercent()).isEqualByComparingTo("90.00");
    }

    @Test void marksUnsubmittedPastDueAssignmentOverdueAndEmptyCategoriesComplete() {
        var result = calculator.calculate(List.of(), Set.of(),
            List.of(new CourseProgressCalculator.AssignmentUnit(30, "Late", "CLOSED", now.minusDays(1), new BigDecimal("5"))),
            List.of(), List.of(), now);

        assertThat(result.overdueAssignments()).isEqualTo(1);
        assertThat(result.assignments()).singleElement().extracting(CourseProgressCalculator.AssignmentProgress::status).isEqualTo("OVERDUE");
        assertThat(result.lessonProgressPercent()).isEqualByComparingTo("100");
    }
}
