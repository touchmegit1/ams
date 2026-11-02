package com.ams.assignment.service;

import com.ams.assignment.dto.AssignmentDtos.Question;
import com.ams.assignment.entity.Assignment;
import com.ams.assignment.entity.QuizAttempt;
import com.ams.assignment.entity.Assignment.Status;
import com.ams.assignment.repository.QuizAttemptRepository;
import com.ams.assignment.dto.AssignmentDtos.QuizSubmit;
import com.ams.assignment.dto.AssignmentDtos.QuizAnswer;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.RoundingMode;
import com.ams.assignment.exception.AssignmentException;
import com.ams.assignment.repository.AssignmentRepository;
import com.ams.enrollment.entity.EnrollmentStatus;
import com.ams.enrollment.repository.EnrollmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StudentAssignmentService {
    private final AssignmentRepository assignments;
    private final EnrollmentRepository enrollments;
    private final AssignmentService assignmentService;
    private final QuizAttemptRepository attempts;
    private final ObjectMapper json;

    private int studentId(Authentication auth) { return Integer.parseInt(auth.getName()); }

    public List<Map<String, Object>> list(Authentication auth) {
        Set<Integer> courseIds = new HashSet<>();
        enrollments.findAllByStudent_UserIdOrderByCreatedAtDesc(studentId(auth)).stream()
            .filter(e -> e.getStatus() == EnrollmentStatus.ACTIVE)
            .forEach(e -> courseIds.add(e.getCourse().getCourseId()));
        if (courseIds.isEmpty()) return List.of();
        return assignments.findAll((root, query, cb) -> cb.and(
                root.get("subjectId").in(courseIds),
                root.get("status").in(Status.PUBLISHED, Status.CLOSED)),
                org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.ASC, "dueDate"))
            .stream().map(a -> safeView(a, studentId(auth))).toList();
    }

    public Map<String, Object> detail(Integer id, Authentication auth) {
        Assignment assignment = assignments.findById(id)
            .orElseThrow(() -> new AssignmentException(404, "Không tìm thấy bài tập"));
        if (assignment.getStatus() != Status.PUBLISHED && assignment.getStatus() != Status.CLOSED)
            throw new AssignmentException(404, "Không tìm thấy bài tập");
        if (!enrollments.existsByStudent_UserIdAndCourse_CourseIdAndStatus(
                studentId(auth), assignment.getSubjectId(), EnrollmentStatus.ACTIVE))
            throw new AssignmentException(403, "Bạn chưa có quyền học khóa này");
        return safeView(assignment, studentId(auth));
    }

    @Transactional
    public Map<String, Object> submit(Integer id, QuizSubmit submission, Authentication auth) {
        Assignment assignment = assignments.findById(id)
            .orElseThrow(() -> new AssignmentException(404, "Không tìm thấy bài trắc nghiệm"));
        if (!"QUIZ".equals(assignment.getAssignmentType()) || assignment.getStatus() != Status.PUBLISHED)
            throw new AssignmentException(409, "Bài trắc nghiệm hiện không nhận bài làm");
        if (assignment.getDueDate() != null && !assignment.getDueDate().isAfter(java.time.LocalDateTime.now()))
            throw new AssignmentException(409, "Đã hết hạn nộp bài trắc nghiệm");
        int studentId = studentId(auth);
        if (!enrollments.existsByStudent_UserIdAndCourse_CourseIdAndStatus(studentId, assignment.getSubjectId(), EnrollmentStatus.ACTIVE))
            throw new AssignmentException(403, "Bạn chưa có quyền học khóa này");
        List<Question> questions = assignmentService.view(assignment).get("questions") instanceof List<?> list
            ? list.stream().map(Question.class::cast).toList() : List.of();
        if (submission.answers().size() != questions.size()) throw new AssignmentException(400, "Vui lòng trả lời tất cả câu hỏi", "answers");
        Set<Integer> answered = new HashSet<>();
        int correct = 0;
        for (QuizAnswer answer : submission.answers()) {
            int index = answer.questionIndex();
            if (index < 0 || index >= questions.size() || !answered.add(index)) throw new AssignmentException(400, "Danh sách câu trả lời không hợp lệ", "answers");
            Question question = questions.get(index);
            Set<Integer> selected = new HashSet<>(answer.selectedOptions());
            if (selected.size() != answer.selectedOptions().size() || selected.stream().anyMatch(option -> option < 0 || option >= question.options().size())
                || ("SINGLE".equals(question.type()) && selected.size() != 1)) throw new AssignmentException(400, "Lựa chọn câu trả lời không hợp lệ", "answers");
            if (selected.equals(new HashSet<>(question.correctAnswers()))) correct++;
        }
        if (answered.size() != questions.size()) throw new AssignmentException(400, "Vui lòng trả lời tất cả câu hỏi", "answers");
        var score = assignment.getMaxScore().multiply(java.math.BigDecimal.valueOf(correct))
            .divide(java.math.BigDecimal.valueOf(questions.size()), 2, RoundingMode.HALF_UP);
        QuizAttempt attempt = new QuizAttempt();
        attempt.setAssignmentId(id);
        attempt.setStudentId(studentId);
        try { attempt.setAnswersJson(json.writeValueAsString(submission.answers())); }
        catch (Exception e) { throw new IllegalStateException("Unable to save quiz answers", e); }
        attempt.setScore(score);
        attempts.saveAndFlush(attempt);
        return Map.of("attemptId", attempt.getId(), "score", score, "maxScore", assignment.getMaxScore(), "questionCount", questions.size(), "correctCount", correct, "submittedAt", attempt.getSubmittedAt());
    }

    private Map<String, Object> safeView(Assignment assignment, int studentId) {
        Map<String, Object> view = assignmentService.view(assignment);
        view.remove("aiPrompt");
        view.remove("templateId");
        view.put("attempts", attempts.findAllByAssignmentIdAndStudentIdOrderBySubmittedAtDesc(assignment.getId(), studentId).stream()
            .map(a -> Map.of("attemptId", a.getId(), "score", a.getScore(), "submittedAt", a.getSubmittedAt())).toList());
        if ("QUIZ".equals(view.get("assignmentType"))) {
            @SuppressWarnings("unchecked") List<Question> questions = (List<Question>) view.get("questions");
            view.put("questions", questions.stream().map(q -> Map.of(
                "text", q.text(), "type", q.type(), "options", q.options())).toList());
        }
        return view;
    }
}
