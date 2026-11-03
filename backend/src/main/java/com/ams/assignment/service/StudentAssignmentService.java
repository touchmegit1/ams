package com.ams.assignment.service;

import com.ams.assignment.dto.AssignmentDtos.Question;
import com.ams.assignment.entity.Assignment;
import com.ams.assignment.entity.Assignment.Status;
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
    private final com.ams.assignment.repository.SubmissionRepository submissions;

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
            .stream().map(assignment -> {
                Map<String, Object> view = safeView(assignment);
                submissions.findTopByAssignment_IdAndStudent_UserIdOrderBySubmittedAtDescSubmissionIdDesc(assignment.getId(), studentId(auth)).ifPresent(s -> {
                    view.put("submissionStatus", s.getStatus()); view.put("submittedAt", s.getSubmittedAt());
                });
                return view;
            }).toList();
    }

    public Map<String, Object> detail(Integer id, Authentication auth) {
        Assignment assignment = assignments.findById(id)
            .orElseThrow(() -> new AssignmentException(404, "Không tìm thấy bài tập"));
        if (assignment.getStatus() != Status.PUBLISHED && assignment.getStatus() != Status.CLOSED)
            throw new AssignmentException(404, "Không tìm thấy bài tập");
        if (!enrollments.existsByStudent_UserIdAndCourse_CourseIdAndStatus(
                studentId(auth), assignment.getSubjectId(), EnrollmentStatus.ACTIVE))
            throw new AssignmentException(403, "Bạn chưa có quyền học khóa này");
        return safeView(assignment);
    }

    private Map<String, Object> safeView(Assignment assignment) {
        Map<String, Object> view = assignmentService.view(assignment);
        view.remove("aiPrompt");
        view.remove("templateId");
        if ("QUIZ".equals(view.get("assignmentType"))) {
            @SuppressWarnings("unchecked") List<Question> questions = (List<Question>) view.get("questions");
            view.put("questions", questions.stream().map(q -> Map.of(
                "text", q.text(), "type", q.type(), "options", q.options())).toList());
        }
        return view;
    }
}
