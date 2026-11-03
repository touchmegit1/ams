package com.ams.assignment.dto;

import com.ams.assignment.entity.Assignment.Source;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public final class AssignmentDtos {
    private AssignmentDtos() {}
    public record Criterion(@NotBlank @Size(max=200) String criteria,
                            @NotBlank @Size(max=4000) String description,
                            @NotNull @DecimalMin("0.01") @DecimalMax("100") BigDecimal weight) {}
    public record Question(@NotBlank @Size(max=2000) String text,
                           @NotBlank @Pattern(regexp="SINGLE|MULTIPLE") String type,
                           @NotNull @Size(min=2, max=10) List<@NotBlank @Size(max=1000) String> options,
                           @NotEmpty List<@NotNull Integer> correctAnswers) {}
    public record Write(@NotNull Integer subjectId, Integer templateId,
                        @NotBlank @Size(max=200) String title,
                        @NotBlank @Size(max=8000) String description,
                        @NotNull @Future LocalDateTime dueDate,
                        @NotNull @DecimalMin("0.01") @DecimalMax("999.99") @Digits(integer=3, fraction=2) BigDecimal maxScore,
                        @NotNull @Size(max=10) List<@Pattern(regexp="PDF|DOC|DOCX|ZIP|TXT|PPTX|XLSX|PNG|JPG") String> allowedFileTypes,
                        @NotNull Source source, @Size(max=6000) String aiPrompt,
                        @NotNull @Size(max=30) List<@NotNull @Valid Criterion> rubric,
                        @Pattern(regexp="DOCUMENT|QUIZ") String assignmentType,
                        @Size(max=100) List<@NotNull @Valid Question> questions) {}
    public record Generate(@NotNull Integer subjectId, @NotBlank @Size(max=4000) String topic,
                           @NotBlank @Pattern(regexp="Easy|Medium|Hard") String difficulty,
                           String assignmentType) {
        public Generate(Integer subjectId, String topic, String difficulty) {
            this(subjectId, topic, difficulty, "DOCUMENT");
        }
    }
    public record Draft(@NotBlank @Size(max=200) String title, @NotBlank @Size(max=8000) String description,
                        List<@NotNull @Valid Criterion> rubric, String model,
                        List<@NotNull @Valid Question> questions) {
        public Draft(String title, String description, List<Criterion> rubric, String model) {
            this(title, description, rubric, model, List.of());
        }
    }
}
