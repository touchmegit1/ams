package com.ams.assignment.service;

import com.ams.assignment.dto.AssignmentDtos.*;
import com.ams.assignment.entity.*;
import com.ams.assignment.exception.AssignmentException;
import com.ams.assignment.repository.*;
import com.ams.auth.entity.User;
import com.ams.auth.repository.UserRepository;
import com.ams.coursemgmt.repository.CourseRepository;
import com.ams.enrollment.entity.EnrollmentStatus;
import com.ams.enrollment.repository.EnrollmentRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SubmissionService {
    private static final int MAX_FILES = 5;
    private final AssignmentRepository assignments;
    private final SubmissionRepository submissions;
    private final SubmissionFileRepository files;
    private final EnrollmentRepository enrollments;
    private final UserRepository users;
    private final CourseRepository courses;
    private final SubmissionFileStorage storage;
    private final SubmissionTextExtractor extractor;
    private final GeminiAiService gemini;
    private final ObjectMapper json;

    @Transactional
    public Map<String,Object> submit(Integer assignmentId, String answersJson, String notes, List<MultipartFile> uploads, Authentication auth) {
        Assignment a = assignment(assignmentId);
        int studentId = actorId(auth);
        requireStudentAccess(a, studentId);
        if (a.getStatus() != Assignment.Status.PUBLISHED || a.getDueDate() == null || !LocalDateTime.now().isBefore(a.getDueDate()))
            throw new AssignmentException(409, "Bài tập đã đóng hoặc quá hạn nộp.");
        List<MultipartFile> incoming = uploads == null ? List.of() : uploads.stream().filter(f -> f != null && !f.isEmpty()).toList();
        if (incoming.size() > MAX_FILES) throw new AssignmentException(400, "Mỗi lần nộp tối đa 5 file.");
        boolean quiz = "QUIZ".equalsIgnoreCase(a.getAssignmentType());
        if (!quiz && incoming.isEmpty()) throw new AssignmentException(400, "Vui lòng đính kèm ít nhất một file.");
        String answerPayload = "";
        List<List<Integer>> submittedAnswers = List.of();
        List<Question> questions = readQuestions(a);
        if (quiz) {
            submittedAnswers = parseAnswers(answersJson, questions);
            answerPayload = encode(Map.of("answers", submittedAnswers, "notes", Objects.toString(notes, "")));
        } else if (answersJson != null && !answersJson.isBlank()) throw new AssignmentException(400, "Bài tập này yêu cầu nộp file, không nhận câu trả lời quiz.");
        Set<String> allowed = Arrays.stream(Objects.toString(a.getAllowedFileTypes(), "").split(","))
            .map(String::trim).map(s -> s.toUpperCase(Locale.ROOT)).filter(s -> !s.isBlank()).collect(Collectors.toSet());
        List<SubmissionFileStorage.StoredFile> stored = new ArrayList<>();
        try {
            for (MultipartFile file : incoming) {
                String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().replace('\\','/');
                int dot = name.lastIndexOf('.');
                String ext = dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT);
                if (!allowed.contains(ext.toUpperCase(Locale.ROOT))) throw new AssignmentException(400, "Định dạng file không được bài tập cho phép: " + ext);
                stored.add(storage.store(file));
            }
            int attempt = submissions.findFirstByAssignment_IdAndStudent_UserIdOrderByAttemptNumberDescIdDesc(assignmentId, studentId)
                .map(s -> s.getAttemptNumber() + 1).orElse(1);
            User student = users.findById(studentId).orElseThrow(() -> new AssignmentException(401, "Tài khoản không hợp lệ."));
            Submission s = new Submission(); s.setAssignment(a); s.setStudent(student); s.setAttemptNumber(attempt);
            s.setRubricSnapshot(a.getRubricJson()); s.setSubmittedAt(LocalDateTime.now()); s.setStatus(Submission.Status.SUBMITTED);
            s.setSubmissionText(quiz ? answerPayload : Objects.toString(notes, "").trim());
            s = submissions.saveAndFlush(s);
            for (SubmissionFileStorage.StoredFile saved : stored) {
                SubmissionFile f = new SubmissionFile(); f.setSubmission(s); f.setOriginalName(saved.originalName());
                f.setStorageKey(saved.storageKey()); f.setMediaType(saved.mediaType()); f.setSizeBytes(saved.sizeBytes()); f.setSha256(saved.sha256());
                files.save(f);
            }
            if (!stored.isEmpty()) { s.setFileUrl(stored.get(0).storageKey()); }
            if (quiz) evaluateQuiz(s, questions, submittedAnswers, a);
            else evaluateDocument(s, a, notes);
            submissions.save(s);
            return view(s, true);
        } catch (AssignmentException e) {
            deleteStored(stored);
            throw e;
        } catch (IllegalArgumentException e) {
            deleteStored(stored);
            throw new AssignmentException(400, e.getMessage() == null ? "File nộp không hợp lệ." : e.getMessage());
        } catch (RuntimeException e) {
            deleteStored(stored);
            throw e;
        } catch (Exception e) {
            deleteStored(stored);
            throw new AssignmentException(400, "Không thể lưu file nộp bài.");
        }
    }

    @Transactional(readOnly = true)
    public Map<String,Object> result(Integer id, Authentication auth) {
        Submission s = submissions.findById(id).orElseThrow(() -> new AssignmentException(404, "Không tìm thấy bài nộp."));
        int userId = actorId(auth);
        if (isAdmin(auth) || isOwnerTeacher(s.getAssignment(), userId)) return view(s, true);
        if (!s.getStudent().getUserId().equals(userId)) throw new AssignmentException(403, "Bạn không có quyền xem bài nộp này.");
        requireStudentAccess(s.getAssignment(), userId);
        return view(s, false);
    }

    @Transactional(readOnly = true)
    public Map<String,Object> history(Integer assignmentId, Authentication auth) {
        Assignment a = assignment(assignmentId); int studentId = actorId(auth); requireStudentAccess(a, studentId);
        List<Map<String,Object>> attempts = submissions.findAllByAssignment_IdAndStudent_UserIdOrderByAttemptNumberAsc(assignmentId, studentId)
            .stream().map(s -> view(s, false)).toList();
        return Map.of("assignmentId", assignmentId, "attempts", attempts, "latest", attempts.isEmpty() ? Map.of() : attempts.get(attempts.size()-1));
    }

    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<Map<String,Object>> queue(Integer assignmentId, int page, int size, Authentication auth) {
        Assignment a = assignment(assignmentId); requireTeacher(a, auth);
        return submissions.findAllByAssignment_IdOrderBySubmittedAtDescIdDesc(assignmentId, PageRequest.of(Math.max(0,page), Math.max(1,Math.min(size,100))))
            .map(s -> view(s, true));
    }

    @Transactional
    public Map<String,Object> review(Integer assignmentId, Integer submissionId, ReviewRequest request, Authentication auth) {
        Assignment a = assignment(assignmentId); requireTeacher(a, auth);
        Submission s = submissions.findById(submissionId).orElseThrow(() -> new AssignmentException(404, "Không tìm thấy bài nộp."));
        if (!s.getAssignment().getId().equals(assignmentId)) throw new AssignmentException(404, "Không tìm thấy bài nộp.");
        BigDecimal score = request.score() == null ? s.getAiScore() : request.score();
        if (score == null || score.signum() < 0 || score.compareTo(a.getMaxScore()) > 0)
            throw new AssignmentException(400, "Điểm chính thức phải nằm trong khoảng 0 đến " + a.getMaxScore() + ".", "score");
        if (score.scale() > 2) throw new AssignmentException(400, "Điểm chính thức tối đa có 2 chữ số thập phân.", "score");
        s.setTeacherScore(score.setScale(2, java.math.RoundingMode.HALF_UP));
        s.setTeacherFeedback(request.feedback() == null ? Objects.toString(s.getAiFeedback(), "") : request.feedback().trim());
        s.setTeacherReviewedAt(LocalDateTime.now()); s.setStatus(Submission.Status.TEACHER_REVIEWED); s.setEvaluationError(null);
        return view(submissions.save(s), true);
    }

    @Transactional
    public Map<String,Object> retry(Integer submissionId, Authentication auth) {
        Submission s = submissions.findById(submissionId).orElseThrow(() -> new AssignmentException(404, "Không tìm thấy bài nộp."));
        int actor = actorId(auth);
        if (!isAdmin(auth) && !isOwnerTeacher(s.getAssignment(), actor)) throw new AssignmentException(403, "Chỉ giảng viên phụ trách mới được chạy lại đánh giá.");
        if (s.getStatus() == Submission.Status.TEACHER_REVIEWED) throw new AssignmentException(409, "Bài đã được giảng viên duyệt.");
        if ("QUIZ".equalsIgnoreCase(s.getAssignment().getAssignmentType())) evaluateQuiz(s, readQuestions(s.getAssignment()), answersFrom(s.getSubmissionText()), s.getAssignment());
        else evaluateDocument(s, s.getAssignment(), s.getSubmissionText());
        return view(submissions.save(s), true);
    }

    @Transactional
    public Map<String,Object> retryForAssignment(Integer assignmentId, Integer submissionId, Authentication auth) {
        Submission s = submissions.findById(submissionId).orElseThrow(() -> new AssignmentException(404, "Không tìm thấy bài nộp."));
        if (!s.getAssignment().getId().equals(assignmentId)) throw new AssignmentException(404, "Không tìm thấy bài nộp.");
        return retry(submissionId, auth);
    }

    @Transactional(readOnly = true)
    public Download download(Integer submissionId, Integer fileId, Authentication auth) {
        Submission s = submissions.findById(submissionId).orElseThrow(() -> new AssignmentException(404, "Không tìm thấy bài nộp."));
        int actor = actorId(auth);
        if (!s.getStudent().getUserId().equals(actor) && !isAdmin(auth) && !isOwnerTeacher(s.getAssignment(), actor))
            throw new AssignmentException(403, "Bạn không có quyền tải file này.");
        SubmissionFile f = files.findByIdAndSubmission_Id(fileId, submissionId).orElseThrow(() -> new AssignmentException(404, "Không tìm thấy file."));
        try { return new Download(f.getOriginalName(), f.getMediaType(), storage.read(f.getStorageKey())); }
        catch (Exception e) { throw new AssignmentException(404, "File không còn tồn tại trên máy chủ."); }
    }

    public record Download(String filename, String mediaType, byte[] bytes) {}
    public record ReviewRequest(BigDecimal score, String feedback) {}

    private void evaluateQuiz(Submission s, List<Question> questions, List<List<Integer>> answers, Assignment a) {
        try {
            QuizGrader.Result result = QuizGrader.evaluate(questions, answers, a.getMaxScore());
            List<EvaluationItem> items = result.questions().stream().map(q -> new EvaluationItem("Câu " + q.questionNumber(), q.score(), q.maxScore(), q.feedback())).toList();
            s.setAiScore(result.score()); s.setAiFeedback(encode(new Evaluation(result.score(), "Bài trắc nghiệm đã được chấm tự động.", items, "AMS Quiz Grader")));
            s.setAiEvaluatedAt(LocalDateTime.now()); s.setEvaluationError(null); s.setStatus(Submission.Status.EVALUATED);
        } catch (RuntimeException e) { fail(s, "Không thể chấm quiz: " + e.getMessage()); }
    }

    private void evaluateDocument(Submission s, Assignment a, String notes) {
        try {
            List<SubmissionFile> attached = files.findAllBySubmission_IdOrderByIdAsc(s.getId());
            Map<String,String> evidence = new LinkedHashMap<>();
            for (SubmissionFile file : attached) evidence.put(file.getOriginalName(), extractor.extract(file.getOriginalName(), storage.read(file.getStorageKey())));
            List<Criterion> rubric = json.readValue(s.getRubricSnapshot(), new TypeReference<>() {});
            Evaluation result = gemini.evaluate(a.getTitle(), a.getDescription(), a.getMaxScore(), rubric, notes, evidence);
            s.setAiScore(result.score()); s.setAiFeedback(encode(result)); s.setAiEvaluatedAt(LocalDateTime.now());
            s.setEvaluationError(null); s.setStatus(Submission.Status.EVALUATED);
        } catch (Exception e) { fail(s, safeError(e)); }
    }

    private void fail(Submission s, String message) { s.setStatus(Submission.Status.AI_FAILED); s.setEvaluationError(message); }
    private String safeError(Exception e) {
        if (e instanceof AssignmentException) return e.getMessage();
        if (e instanceof SubmissionTextExtractor.UnsupportedContentException) return e.getMessage();
        return "Không thể đánh giá tự động. Bài đã lưu, giảng viên có thể chấm thủ công hoặc thử lại.";
    }
    private void deleteStored(List<SubmissionFileStorage.StoredFile> stored) { for (var f : stored) try { storage.delete(f.storageKey()); } catch (Exception ignored) {} }
    private Assignment assignment(Integer id) { return assignments.findById(id).orElseThrow(() -> new AssignmentException(404,"Không tìm thấy bài tập.")); }
    private void requireStudentAccess(Assignment a, int studentId) {
        if (!enrollments.existsByStudent_UserIdAndCourse_CourseIdAndStatus(studentId, a.getSubjectId(), EnrollmentStatus.ACTIVE)) throw new AssignmentException(403,"Bạn chưa có quyền học khóa này.");
    }
    private void requireTeacher(Assignment a, Authentication auth) { if (!isAdmin(auth) && !isOwnerTeacher(a, actorId(auth))) throw new AssignmentException(403,"Chỉ giảng viên phụ trách mới có quyền này."); }
    private boolean isOwnerTeacher(Assignment a, int actor) { return courses.findById(a.getSubjectId()).map(c -> c.getTeacher().getUserId().equals(actor)).orElse(false); }
    private boolean isAdmin(Authentication auth) { return auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN")); }
    private int actorId(Authentication auth) { return Integer.parseInt(auth.getName()); }

    private List<Question> readQuestions(Assignment a) {
        try { return json.readValue(Objects.toString(a.getQuestionsJson(), "[]"), new TypeReference<>() {}); }
        catch (Exception e) { throw new AssignmentException(400,"Cấu hình câu hỏi của bài tập không hợp lệ."); }
    }
    private List<List<Integer>> parseAnswers(String raw, List<Question> questions) {
        if (raw == null || raw.isBlank()) throw new AssignmentException(400,"Vui lòng trả lời quiz trước khi nộp.");
        try {
            List<List<Integer>> answers = json.readValue(raw, new TypeReference<>() {});
            if (answers.size() != questions.size()) throw new IllegalArgumentException();
            for (int i=0;i<answers.size();i++) {
                List<Integer> answer = answers.get(i);
                int optionCount = questions.get(i).options().size();
                if (answer == null || answer.stream().anyMatch(n -> n == null || n < 0 || n >= optionCount) || new HashSet<>(answer).size()!=answer.size()) throw new IllegalArgumentException();
                if ("SINGLE".equals(questions.get(i).type()) && answer.size()>1) throw new IllegalArgumentException();
            }
            return answers;
        } catch(Exception e) { throw new AssignmentException(400,"Câu trả lời quiz không hợp lệ."); }
    }
    private List<List<Integer>> answersFrom(String raw) {
        try { return json.readTree(raw).path("answers").traverse(json).readValueAs(new TypeReference<>() {}); }
        catch(Exception e) { throw new AssignmentException(400,"Dữ liệu câu trả lời đã lưu không hợp lệ."); }
    }
    private String encode(Object value) { try { return json.writeValueAsString(value); } catch(Exception e) { throw new AssignmentException(500,"Không thể lưu nội dung đánh giá."); } }

    private Map<String,Object> view(Submission s, boolean teacherView) {
        Map<String,Object> m = new LinkedHashMap<>(); m.put("id",s.getId()); m.put("assignmentId",s.getAssignment().getId());
        m.put("assignmentTitle",s.getAssignment().getTitle()); m.put("studentId",s.getStudent().getUserId()); m.put("studentName",s.getStudent().getFullName());
        m.put("attemptNumber",s.getAttemptNumber()); m.put("status",s.getStatus()); m.put("submittedAt",s.getSubmittedAt());
        m.put("aiScore",s.getAiScore()); m.put("aiFeedback",parseJson(s.getAiFeedback())); m.put("evaluationMessage",s.getEvaluationError());
        if (teacherView || s.getStatus() == Submission.Status.TEACHER_REVIEWED) m.put("officialScore",s.getTeacherScore());
        if (teacherView || s.getStatus() == Submission.Status.TEACHER_REVIEWED) m.put("teacherFeedback",s.getTeacherFeedback());
        m.put("teacherReviewedAt",s.getTeacherReviewedAt());
        m.put("notes", "QUIZ".equalsIgnoreCase(s.getAssignment().getAssignmentType()) ? notesFrom(s.getSubmissionText()) : s.getSubmissionText());
        m.put("answers", teacherView && "QUIZ".equalsIgnoreCase(s.getAssignment().getAssignmentType()) ? answersFrom(s.getSubmissionText()) : null);
        m.put("files", files.findAllBySubmission_IdOrderByIdAsc(s.getId()).stream().map(f -> Map.of("id",f.getId(),"name",f.getOriginalName(),"sizeBytes",f.getSizeBytes(),"mediaType",Objects.toString(f.getMediaType(),"application/octet-stream"),"downloadUrl","/api/student/submissions/"+s.getId()+"/files/"+f.getId())).toList());
        return m;
    }
    private Object parseJson(String text) { if(text==null || text.isBlank()) return null; try { return json.readTree(text); } catch(Exception e) { return text; } }
    private String notesFrom(String payload) { try { return json.readTree(payload).path("notes").asText(""); } catch(Exception e) { return ""; } }
}
