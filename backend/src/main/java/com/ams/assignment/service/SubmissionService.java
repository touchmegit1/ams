package com.ams.assignment.service;

import com.ams.assignment.entity.Assignment;
import com.ams.assignment.entity.Submission;
import com.ams.assignment.repository.AssignmentRepository;
import com.ams.assignment.repository.SubmissionRepository;
import com.ams.auth.entity.User;
import com.ams.auth.repository.UserRepository;
import com.ams.coursemgmt.entity.Course;
import com.ams.coursemgmt.repository.CourseRepository;
import com.ams.enrollment.entity.EnrollmentStatus;
import com.ams.enrollment.repository.EnrollmentRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class SubmissionService {
    private static final long MAX_FILE_SIZE = 20L * 1024 * 1024;
    private static final int MAX_TEXT_LENGTH = 100_000;
    public static final List<String> DEFAULT_ALLOWED_FILE_TYPES = List.of(
        "PDF", "DOC", "DOCX", "ZIP", "TXT", "PPTX", "XLSX", "PNG", "JPG",
        "JSON", "JAVA", "PY", "JS", "TS", "HTML", "CSS", "MD", "SQL"
    );
    private final AssignmentRepository assignments;
    private final SubmissionRepository submissions;
    private final EnrollmentRepository enrollments;
    private final UserRepository users;
    private final CourseRepository courses;
    private final SubmissionFileStorage storage;
    private final ObjectMapper json;
    private final QuizScoringService quizScoring;
    private final SubmissionAiEvaluator aiEvaluator;

    public SubmissionService(AssignmentRepository assignments, SubmissionRepository submissions, EnrollmentRepository enrollments,
                             UserRepository users, CourseRepository courses, SubmissionFileStorage storage, ObjectMapper json,
                             QuizScoringService quizScoring, SubmissionAiEvaluator aiEvaluator) {
        this.assignments = assignments; this.submissions = submissions; this.enrollments = enrollments; this.users = users;
        this.courses = courses; this.storage = storage; this.json = json;
        this.quizScoring = quizScoring; this.aiEvaluator = aiEvaluator;
    }

    @Transactional
    public Map<String, Object> submit(Integer assignmentId, String text, MultipartFile file, String principal) {
        int studentId = Integer.parseInt(principal);
        Assignment assignment = requireAssignment(assignmentId);
        if (assignment.getStatus() != Assignment.Status.PUBLISHED || assignment.getDueDate() == null || !assignment.getDueDate().isAfter(LocalDateTime.now()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bài tập đã đóng hoặc quá hạn nộp");
        if (!enrollments.existsByStudent_UserIdAndCourse_CourseIdAndStatus(studentId, assignment.getSubjectId(), EnrollmentStatus.ACTIVE))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn cần tham gia khóa học để nộp bài");

        String submissionText = text == null ? "" : text.trim();
        if (submissionText.length() > MAX_TEXT_LENGTH)
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Nội dung bài nộp không được vượt quá 100.000 ký tự");
        QuizScoringService.Result quizResult = null;
        if ("QUIZ".equals(assignment.getAssignmentType())) { validateQuiz(assignment, submissionText); quizResult = quizScoring.score(assignment.getQuestionsJson(), submissionText, assignment.getMaxScore()); }
        else if (submissionText.isBlank() && (file == null || file.isEmpty()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Hãy nhập câu trả lời hoặc đính kèm tệp");

        Submission submission = submissions.findTopByAssignment_IdAndStudent_UserIdOrderBySubmittedAtDescSubmissionIdDesc(assignmentId, studentId).orElseGet(() -> {
            Submission created = new Submission(); created.setAssignment(assignment);
            created.setStudent(users.findById(studentId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED)));
            return created;
        });
        if (submission.getStatus() == Submission.Status.TEACHER_REVIEWED)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bài đã được chấm và không thể sửa");

        String newKey = null;
        String originalName = null;
        if (file != null && !file.isEmpty()) {
            validateFile(assignment, file);
            try { newKey = storage.store(file); }
            catch (IOException error) { throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Không thể lưu tệp bài nộp"); }
            originalName = safeFilename(file.getOriginalFilename());
        }
        String previousKey = submission.getFileKey();
        submission.setSubmissionText(submissionText);
        if (newKey != null) { submission.setFileKey(newKey); submission.setOriginalFileName(originalName); }
        submission.setSubmittedAt(Instant.now());
        submission.setStatus(Submission.Status.SUBMITTED); submission.setTeacherScore(null); submission.setTeacherFeedback(null); submission.setReviewedAt(null);
        submission.setAiScore(null); submission.setAiFeedback(null); submission.setAiEvaluatedAt(null); submission.setAutoScore(null); submission.setAutoFeedback(null);
        if (quizResult != null) {
            submission.setAutoScore(quizResult.score());
            submission.setAutoFeedback("Tự chấm: " + quizResult.correctCount() + "/" + quizResult.questionCount() + " câu đúng.");
            submission.setAiEvaluationStatus(Submission.AiEvaluationStatus.NOT_REQUIRED);
        } else if (newKey != null || submission.getFileKey() != null) {
            submission.setAiEvaluationStatus(Submission.AiEvaluationStatus.PENDING);
        } else submission.setAiEvaluationStatus(Submission.AiEvaluationStatus.UNSUPPORTED);
        Submission saved = submissions.save(submission);
        if (newKey != null && previousKey != null) storage.delete(previousKey);
        if (quizResult == null && saved.getFileKey() != null) {
            int savedId = saved.getSubmissionId();
            org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(new org.springframework.transaction.support.TransactionSynchronization() {
                @Override public void afterCommit() { aiEvaluator.evaluate(savedId); }
            });
        }
        return studentView(saved);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> studentSubmission(Integer assignmentId, String principal) {
        Assignment assignment = requireAssignment(assignmentId);
        int studentId = Integer.parseInt(principal);
        requireEnrollment(studentId, assignment);
        return submissions.findTopByAssignment_IdAndStudent_UserIdOrderBySubmittedAtDescSubmissionIdDesc(assignmentId, studentId)
            .map(this::studentView).orElse(null);
    }

    @Transactional(readOnly = true)
    public StoredFile studentDownload(Integer assignmentId, String principal) {
        int studentId = Integer.parseInt(principal);
        Assignment assignment = requireAssignment(assignmentId);
        requireEnrollment(studentId, assignment);
        Submission submission = submissions.findTopByAssignment_IdAndStudent_UserIdOrderBySubmittedAtDescSubmissionIdDesc(assignmentId, studentId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy bài nộp"));
        return storedFile(submission);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> teacherSubmissions(Integer assignmentId, org.springframework.security.core.Authentication auth) {
        Assignment assignment = requireAssignment(assignmentId);
        requireTeacherCourse(assignment.getSubjectId(), auth);
        List<Submission> subList = submissions.findAllByAssignment_IdOrderBySubmittedAtAsc(assignmentId);
        Map<Integer, Submission> map = new LinkedHashMap<>();
        for (Submission s : subList) {
            map.put(s.getStudent().getUserId(), s);
        }

        List<com.ams.enrollment.entity.Enrollment> roster = enrollments.findAllByCourse_CourseIdOrderByCreatedAtAsc(assignment.getSubjectId());
        List<Map<String, Object>> result = new ArrayList<>();
        Set<Integer> processed = new HashSet<>();

        for (com.ams.enrollment.entity.Enrollment e : roster) {
            if (e.getStatus() != com.ams.enrollment.entity.EnrollmentStatus.ACTIVE) continue;
            var student = e.getStudent();
            processed.add(student.getUserId());
            Submission s = map.get(student.getUserId());
            if (s != null) {
                result.add(teacherView(s));
            } else {
                Map<String, Object> unsubmitted = new LinkedHashMap<>();
                unsubmitted.put("submissionId", -student.getUserId());
                unsubmitted.put("studentId", student.getUserId());
                unsubmitted.put("studentName", student.getFullName());
                unsubmitted.put("studentEmail", student.getEmail());
                unsubmitted.put("status", "NOT_SUBMITTED");
                unsubmitted.put("submissionText", null);
                unsubmitted.put("fileName", null);
                unsubmitted.put("downloadUrl", null);
                unsubmitted.put("submittedAt", null);
                unsubmitted.put("teacherScore", null);
                unsubmitted.put("teacherFeedback", null);
                unsubmitted.put("reviewedAt", null);
                unsubmitted.put("aiScore", null);
                unsubmitted.put("aiFeedback", null);
                unsubmitted.put("aiEvaluationStatus", null);
                unsubmitted.put("autoScore", null);
                unsubmitted.put("autoFeedback", null);
                result.add(unsubmitted);
            }
        }

        for (Submission s : subList) {
            if (!processed.contains(s.getStudent().getUserId())) {
                result.add(teacherView(s));
                processed.add(s.getStudent().getUserId());
            }
        }
        return result;
    }

    @Transactional
    public Map<String, Object> grade(Integer assignmentId, Integer submissionId, BigDecimal score, String feedback,
                                     org.springframework.security.core.Authentication auth) {
        Assignment assignment = requireAssignment(assignmentId);
        requireTeacherCourse(assignment.getSubjectId(), auth);
        Submission submission;
        if (submissionId != null && submissionId > 0) {
            submission = submissions.findById(submissionId).filter(s -> s.getAssignment().getId().equals(assignmentId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy bài nộp"));
        } else if (submissionId != null && submissionId < 0) {
            int studentId = -submissionId;
            submission = submissions.findTopByAssignment_IdAndStudent_UserIdOrderBySubmittedAtDescSubmissionIdDesc(assignmentId, studentId)
                .orElseGet(() -> {
                    Submission created = new Submission();
                    created.setAssignment(assignment);
                    created.setStudent(users.findById(studentId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy sinh viên")));
                    created.setSubmissionText("");
                    created.setSubmittedAt(Instant.now());
                    created.setStatus(Submission.Status.SUBMITTED);
                    return created;
                });
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ID bài nộp không hợp lệ");
        }
        if (score == null || score.signum() < 0 || score.compareTo(assignment.getMaxScore()) > 0)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Điểm phải nằm trong khoảng 0 đến điểm tối đa");
        if (feedback != null && feedback.length() > 8000)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nhận xét không được quá 8000 ký tự");
        submission.setTeacherScore(score); submission.setTeacherFeedback(feedback == null ? "" : feedback.trim());
        submission.setStatus(Submission.Status.TEACHER_REVIEWED); submission.setReviewedAt(Instant.now());
        return teacherView(submissions.save(submission));
    }

    @Transactional
    public Map<String, Object> evaluateWithAi(Integer assignmentId, Integer submissionId, org.springframework.security.core.Authentication auth) {
        Assignment assignment = requireAssignment(assignmentId);
        requireTeacherCourse(assignment.getSubjectId(), auth);
        Submission submission = submissions.findById(submissionId).filter(s -> s.getAssignment().getId().equals(assignmentId))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy bài nộp"));
        Submission evaluated = aiEvaluator.evaluateDirect(submission.getSubmissionId());
        return teacherView(evaluated);
    }

    @Transactional(readOnly = true)
    public StoredFile download(Integer submissionId, org.springframework.security.core.Authentication auth) {
        Submission submission = submissions.findById(submissionId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy tệp"));
        boolean isStudent = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_STUDENT"));
        if (isStudent) requireEnrollment(Integer.parseInt(auth.getName()), submission.getAssignment());
        else requireTeacherCourse(submission.getAssignment().getSubjectId(), auth);
        return storedFile(submission);
    }

    private StoredFile storedFile(Submission submission) {
        if (submission.getFileKey() == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Bài nộp không có tệp đính kèm");
        try {
            var path = storage.resolve(submission.getFileKey());
            if (!java.nio.file.Files.isRegularFile(path)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy tệp");
            return new StoredFile(path, submission.getOriginalFileName() == null ? "submission" : submission.getOriginalFileName());
        } catch (IllegalArgumentException error) { throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy tệp"); }
    }

    public record StoredFile(java.nio.file.Path path, String originalName) { }

    private Assignment requireAssignment(Integer id) {
        return assignments.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy bài tập"));
    }

    private void requireTeacherCourse(Integer courseId, org.springframework.security.core.Authentication auth) {
        Course course = courses.findById(courseId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy khóa học"));
        boolean admin = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        if (!admin && !course.getTeacher().getUserId().equals(Integer.valueOf(auth.getName())))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không phụ trách khóa học này");
    }

    private void requireEnrollment(Integer studentId, Assignment assignment) {
        if (!enrollments.existsByStudent_UserIdAndCourse_CourseIdAndStatus(studentId, assignment.getSubjectId(), EnrollmentStatus.ACTIVE))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn chưa có quyền học khóa này");
    }

    private void validateQuiz(Assignment assignment, String text) {
        try {
            JsonNode submitted = json.readTree(text);
            JsonNode questions = json.readTree(assignment.getQuestionsJson());
            if (submitted == null || !submitted.isArray() || !questions.isArray() || submitted.size() != questions.size()) throw new IllegalArgumentException();
            for (int i = 0; i < questions.size(); i++) {
                JsonNode answer = submitted.get(i); int optionCount = questions.get(i).path("options").size();
                if (answer == null || !answer.isArray() || answer.isEmpty()) throw new IllegalArgumentException();
                Set<Integer> unique = new HashSet<>();
                for (JsonNode index : answer) {
                    if (!index.canConvertToInt() || index.asInt() < 0 || index.asInt() >= optionCount || !unique.add(index.asInt())) throw new IllegalArgumentException();
                }
                if ("SINGLE".equals(questions.get(i).path("type").asText()) && answer.size() != 1) throw new IllegalArgumentException();
            }
        } catch (Exception error) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Câu trả lời trắc nghiệm không hợp lệ");
        }
    }

    private void validateFile(Assignment assignment, MultipartFile file) {
        if (file.getSize() > MAX_FILE_SIZE) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Tệp không được vượt quá 20 MB");
        String original = safeFilename(file.getOriginalFilename());
        int dot = original.lastIndexOf('.');
        String extension = dot < 0 ? "" : original.substring(dot + 1).trim().toUpperCase(Locale.ROOT);
        List<String> allowed = (assignment.getAllowedFileTypes() == null || assignment.getAllowedFileTypes().isBlank())
            ? DEFAULT_ALLOWED_FILE_TYPES : Arrays.stream(assignment.getAllowedFileTypes().split(",")).map(String::trim).filter(s -> !s.isBlank()).map(s -> s.toUpperCase(Locale.ROOT)).toList();
        if (allowed.isEmpty()) allowed = DEFAULT_ALLOWED_FILE_TYPES;
        if (extension.isBlank() || !allowed.contains(extension)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Định dạng tệp không được phép. Các định dạng được chấp nhận: " + String.join(", ", allowed));
    }

    private String safeFilename(String name) {
        String cleaned = name == null ? "submission" : name.replace('\\', '/');
        cleaned = cleaned.substring(cleaned.lastIndexOf('/') + 1).replaceAll("[\\r\\n\\\"]", "_");
        return cleaned.length() > 240 ? cleaned.substring(cleaned.length() - 240) : cleaned;
    }

    private Map<String, Object> studentView(Submission s) {
        Map<String, Object> result = new LinkedHashMap<>(); result.put("submissionId", s.getSubmissionId());
        result.put("submissionText", s.getSubmissionText()); result.put("fileName", s.getOriginalFileName());
        result.put("downloadUrl", s.getFileKey() == null ? null : "/api/student/assignments/" + s.getAssignment().getId() + "/submission/file");
        result.put("status", s.getStatus()); result.put("submittedAt", s.getSubmittedAt()); result.put("teacherScore", s.getTeacherScore());
        result.put("teacherFeedback", s.getTeacherFeedback()); result.put("reviewedAt", s.getReviewedAt());
        result.put("aiEvaluationStatus", s.getAiEvaluationStatus());
        if (s.getStatus() == Submission.Status.TEACHER_REVIEWED) { result.put("aiScore", s.getAiScore()); result.put("aiFeedback", s.getAiFeedback()); }
        return result;
    }

    private Map<String, Object> teacherView(Submission s) {
        Map<String, Object> result = new LinkedHashMap<>(studentView(s)); result.put("studentId", s.getStudent().getUserId());
        result.put("studentName", s.getStudent().getFullName()); result.put("studentEmail", s.getStudent().getEmail());
        result.put("aiScore", s.getAiScore()); result.put("aiFeedback", s.getAiFeedback()); result.put("aiEvaluationStatus", s.getAiEvaluationStatus());
        result.put("aiEvaluatedAt", s.getAiEvaluatedAt()); result.put("autoScore", s.getAutoScore()); result.put("autoFeedback", s.getAutoFeedback());
        result.put("downloadUrl", s.getFileKey() == null ? null : "/api/teacher/submissions/" + s.getSubmissionId() + "/file");
        return result;
    }
}
