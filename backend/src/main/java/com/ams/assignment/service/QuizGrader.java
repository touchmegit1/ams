package com.ams.assignment.service;

import com.ams.assignment.dto.AssignmentDtos.Question;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

/** Deterministic scoring for assignment quizzes; no answer key is sent to an AI model. */
public final class QuizGrader {
    private QuizGrader() {}

    public record QuestionScore(int questionNumber, BigDecimal score, BigDecimal maxScore, String feedback) {}
    public record Result(BigDecimal score, List<QuestionScore> questions) {}

    public static BigDecimal score(List<Question> questions, List<List<Integer>> answers, BigDecimal maxScore) {
        return evaluate(questions, answers, maxScore).score();
    }

    public static Result evaluate(List<Question> questions, List<List<Integer>> answers, BigDecimal maxScore) {
        if (questions == null || questions.isEmpty() || maxScore == null || maxScore.signum() <= 0) {
            throw new IllegalArgumentException("Quiz requires questions and a positive maximum score");
        }
        List<List<Integer>> submitted = answers == null ? List.of() : answers;
        BigDecimal pointsPerQuestion = maxScore.divide(BigDecimal.valueOf(questions.size()), 2, RoundingMode.HALF_UP);
        BigDecimal allocated = pointsPerQuestion.multiply(BigDecimal.valueOf(questions.size() - 1));
        List<QuestionScore> breakdown = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        for (int i = 0; i < questions.size(); i++) {
            Question question = questions.get(i);
            Set<Integer> correct = new HashSet<>(question.correctAnswers());
            Set<Integer> selected = i < submitted.size() && submitted.get(i) != null
                ? new HashSet<>(submitted.get(i)) : Set.of();
            long correctSelected = selected.stream().filter(correct::contains).count();
            long incorrectSelected = selected.stream().filter(answer -> !correct.contains(answer)).count();
            BigDecimal earnedFraction;
            if ("MULTIPLE".equals(question.type())) {
                earnedFraction = BigDecimal.valueOf(Math.max(0, correctSelected - incorrectSelected))
                    .divide(BigDecimal.valueOf(correct.size()), 8, RoundingMode.HALF_UP);
            } else {
                earnedFraction = correctSelected == 1 && selected.size() == 1 ? BigDecimal.ONE : BigDecimal.ZERO;
            }
            if (earnedFraction.compareTo(BigDecimal.ONE) > 0) earnedFraction = BigDecimal.ONE;
            BigDecimal questionMax = i == questions.size() - 1 ? maxScore.subtract(allocated) : pointsPerQuestion;
            BigDecimal earned = questionMax.multiply(earnedFraction).setScale(2, RoundingMode.HALF_UP);
            total = total.add(earned);
            breakdown.add(new QuestionScore(i + 1, earned, questionMax,
                earned.compareTo(questionMax) == 0 ? "Trả lời chính xác." : "Câu trả lời chưa đầy đủ hoặc có lựa chọn sai."));
        }
        total = total.min(maxScore).setScale(2, RoundingMode.HALF_UP);
        return new Result(total, List.copyOf(breakdown));
    }
}
