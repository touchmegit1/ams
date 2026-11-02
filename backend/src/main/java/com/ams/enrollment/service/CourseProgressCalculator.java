package com.ams.enrollment.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;

/** Calculates course progress from lesson marks and the latest assignment records. */
public class CourseProgressCalculator {
    public record LessonUnit(Integer id, String title) {}
    public record AssignmentUnit(Integer id, String title, String status, LocalDateTime dueDate, BigDecimal maxScore) {}
    public record SubmissionAttempt(Integer assignmentId, String status, LocalDateTime submittedAt,
                                    BigDecimal aiScore, BigDecimal teacherScore) {}
    public record LegacyQuizAttempt(Integer assignmentId, BigDecimal score, LocalDateTime submittedAt) {}
    public record AssignmentProgress(Integer assignmentId, String title, String status, String submissionStatus,
                                     LocalDateTime dueDate, LocalDateTime lastSubmittedAt, BigDecimal score,
                                     BigDecimal maxScore, BigDecimal scorePercent) {}
    public record StudentProgress(int completedLessons, int totalLessons, BigDecimal lessonProgressPercent,
                                  int completedAssignments, int requiredAssignments,
                                  BigDecimal assignmentProgressPercent, BigDecimal overallProgressPercent,
                                  int overdueAssignments, BigDecimal averageScorePercent,
                                  List<AssignmentProgress> assignments) {}

    public StudentProgress calculate(List<LessonUnit> lessons, Set<Integer> completedLessonIds,
                                     List<AssignmentUnit> assignments, List<SubmissionAttempt> submissions,
                                     List<LegacyQuizAttempt> legacyAttempts, LocalDateTime now) {
        Set<Integer> completedLessons = completedLessonIds == null ? Set.of() : completedLessonIds;
        int completedLessonCount = (int) lessons.stream().filter(l -> completedLessons.contains(l.id())).count();
        List<AssignmentUnit> required = assignments.stream()
            .filter(a -> "PUBLISHED".equals(a.status()) || "CLOSED".equals(a.status())).toList();
        List<AssignmentProgress> details = new ArrayList<>();
        List<BigDecimal> scoredPercentages = new ArrayList<>();
        int completedAssignmentCount = 0, overdue = 0;

        for (AssignmentUnit assignment : required) {
            List<SubmissionAttempt> attempts = submissions.stream().filter(s -> assignment.id().equals(s.assignmentId())).toList();
            List<LegacyQuizAttempt> oldAttempts = legacyAttempts.stream().filter(a -> assignment.id().equals(a.assignmentId())).toList();
            boolean isComplete = !attempts.isEmpty() || !oldAttempts.isEmpty();
            if (isComplete) completedAssignmentCount++;
            LocalDateTime lastSubmitted = java.util.stream.Stream.concat(
                attempts.stream().map(SubmissionAttempt::submittedAt), oldAttempts.stream().map(LegacyQuizAttempt::submittedAt))
                .filter(Objects::nonNull).max(LocalDateTime::compareTo).orElse(null);
            if (!isComplete && assignment.dueDate() != null && !assignment.dueDate().isAfter(now)) overdue++;

            String submissionStatus = latestSubmission(attempts).map(SubmissionAttempt::status)
                .orElseGet(() -> oldAttempts.isEmpty() ? null : "QUIZ_ATTEMPTED");
            String status = !isComplete ? (assignment.dueDate() != null && !assignment.dueDate().isAfter(now) ? "OVERDUE" : "MISSING") : "SUBMITTED";
            ScoredAttempt scored = latestScored(attempts, oldAttempts);
            BigDecimal score = scored == null ? null : scored.score();
            BigDecimal percent = score == null || assignment.maxScore() == null || assignment.maxScore().signum() <= 0
                ? null : score.multiply(new BigDecimal("100")).divide(assignment.maxScore(), 2, RoundingMode.HALF_UP);
            if (percent != null) scoredPercentages.add(percent);
            details.add(new AssignmentProgress(assignment.id(), assignment.title(), status, submissionStatus,
                assignment.dueDate(), lastSubmitted, score, assignment.maxScore(), percent));
        }

        BigDecimal lessonPercent = percent(completedLessonCount, lessons.size());
        BigDecimal assignmentPercent = percent(completedAssignmentCount, required.size());
        BigDecimal overall = lessonPercent.add(assignmentPercent).divide(new BigDecimal("2"), 2, RoundingMode.HALF_UP);
        BigDecimal averageScore = scoredPercentages.isEmpty() ? null : scoredPercentages.stream().reduce(BigDecimal.ZERO, BigDecimal::add)
            .divide(BigDecimal.valueOf(scoredPercentages.size()), 2, RoundingMode.HALF_UP);
        return new StudentProgress(completedLessonCount, lessons.size(), lessonPercent, completedAssignmentCount,
            required.size(), assignmentPercent, overall, overdue, averageScore, List.copyOf(details));
    }

    private Optional<SubmissionAttempt> latestSubmission(List<SubmissionAttempt> attempts) {
        return attempts.stream().max(Comparator.comparing(SubmissionAttempt::submittedAt,
            Comparator.nullsFirst(Comparator.naturalOrder())));
    }

    private ScoredAttempt latestScored(List<SubmissionAttempt> submissions, List<LegacyQuizAttempt> legacyAttempts) {
        ScoredAttempt latest = null;
        for (LegacyQuizAttempt attempt : legacyAttempts) {
            if (attempt.score() != null && newer(attempt.submittedAt(), latest == null ? null : latest.submittedAt()))
                latest = new ScoredAttempt(attempt.score(), attempt.submittedAt());
        }
        for (SubmissionAttempt attempt : submissions) {
            BigDecimal score = attempt.teacherScore() != null ? attempt.teacherScore() : attempt.aiScore();
            if (score != null && newer(attempt.submittedAt(), latest == null ? null : latest.submittedAt()))
                latest = new ScoredAttempt(score, attempt.submittedAt());
        }
        return latest;
    }

    private boolean newer(LocalDateTime candidate, LocalDateTime current) {
        return candidate != null && (current == null || !candidate.isBefore(current));
    }

    private BigDecimal percent(int value, int total) {
        return total == 0 ? new BigDecimal("100.00") : BigDecimal.valueOf(value).multiply(new BigDecimal("100"))
            .divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP);
    }

    private record ScoredAttempt(BigDecimal score, LocalDateTime submittedAt) {}
}
