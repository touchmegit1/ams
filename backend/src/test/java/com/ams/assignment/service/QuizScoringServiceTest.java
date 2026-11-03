package com.ams.assignment.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import static org.assertj.core.api.Assertions.assertThat;

class QuizScoringServiceTest {
    private final QuizScoringService scoring = new QuizScoringService(new ObjectMapper());

    @Test void givesCreditOnlyWhenMultipleChoiceSelectionMatchesExactly() {
        String questions = """
                [
                  {"text":"single","type":"SINGLE","options":["A","B"],"correctAnswers":[1]},
                  {"text":"multiple","type":"MULTIPLE","options":["A","B","C"],"correctAnswers":[0,2]}
                ]
                """;
        var result = scoring.score(questions, "[[1],[0]]", new BigDecimal("10"));
        assertThat(result.score()).isEqualByComparingTo("5.00");
        assertThat(result.correctCount()).isEqualTo(1);
        assertThat(result.questionCount()).isEqualTo(2);
    }

    @Test void roundsProportionalQuizScoreToTwoDecimalPlaces() {
        String questions = """
                [
                  {"text":"one","type":"SINGLE","options":["A","B"],"correctAnswers":[0]},
                  {"text":"two","type":"SINGLE","options":["A","B"],"correctAnswers":[0]},
                  {"text":"three","type":"SINGLE","options":["A","B"],"correctAnswers":[0]}
                ]
                """;
        var result = scoring.score(questions, "[[0],[1],[1]]", new BigDecimal("10"));
        assertThat(result.score()).isEqualByComparingTo("3.33");
    }
}
