package com.ams.assignment.service;

import com.ams.assignment.dto.AssignmentDtos.Question;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;

class QuizGraderTest {
    @Test void multipleAnswerQuestionsGivePartialCreditAndPenalizeWrongSelections() {
        Question question = new Question("Chọn đáp án", "MULTIPLE", List.of("A", "B", "C", "D"), List.of(0, 2));

        BigDecimal score = QuizGrader.score(List.of(question), List.of(List.of(0, 1, 2)), new BigDecimal("10"));

        assertThat(score).isEqualByComparingTo("5.00");
    }

    @Test void quizScoreNeverFallsBelowZeroAndMissingAnswersReceiveNoCredit() {
        Question question = new Question("Chọn đáp án", "MULTIPLE", List.of("A", "B", "C"), List.of(0, 2));

        assertThat(QuizGrader.score(List.of(question), List.of(List.of(1)), new BigDecimal("10")))
            .isEqualByComparingTo("0.00");
        assertThat(QuizGrader.score(List.of(question), List.of(), new BigDecimal("10")))
            .isEqualByComparingTo("0.00");
    }
}
