package com.ams.assignment.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashSet;
import java.util.Set;

@Service
public class QuizScoringService {
    private final ObjectMapper json;

    public QuizScoringService(ObjectMapper json) {
        this.json = json;
    }

    public Result score(String questionsJson, String answersJson, BigDecimal maxScore) {
        try {
            JsonNode questions = json.readTree(questionsJson);
            JsonNode answers = json.readTree(answersJson);
            if (questions == null || !questions.isArray() || questions.isEmpty()
                    || answers == null || !answers.isArray() || answers.size() != questions.size()) {
                throw new IllegalArgumentException("Quiz answers do not match its questions");
            }

            int correct = 0;
            for (int i = 0; i < questions.size(); i++) {
                Set<Integer> expected = indices(questions.get(i).path("correctAnswers"));
                Set<Integer> actual = indices(answers.get(i));
                if (!expected.isEmpty() && expected.equals(actual)) correct++;
            }

            BigDecimal score = maxScore.multiply(BigDecimal.valueOf(correct))
                    .divide(BigDecimal.valueOf(questions.size()), 2, RoundingMode.HALF_UP);
            return new Result(score, correct, questions.size());
        } catch (RuntimeException error) {
            throw error;
        } catch (Exception error) {
            throw new IllegalArgumentException("Quiz data is invalid", error);
        }
    }

    private Set<Integer> indices(JsonNode values) {
        if (values == null || !values.isArray()) return Set.of();
        Set<Integer> result = new HashSet<>();
        for (JsonNode value : values) {
            if (!value.canConvertToInt() || !result.add(value.asInt())) return Set.of();
        }
        return result;
    }

    public record Result(BigDecimal score, int correctCount, int questionCount) { }
}
