package com.ams.assignment.service;
import com.ams.assignment.dto.AssignmentDtos.*;
import com.ams.assignment.exception.AssignmentException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validator;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.Map;
import java.util.List;

@Service
public class GeminiAiService {
    private final String key,model;
    private final AssignmentService assignments;
    private final ObjectMapper json;
    private final Validator validator;
    private final HttpClient client;
    @org.springframework.beans.factory.annotation.Autowired
    public GeminiAiService(@Value("${gemini.api-key:}") String key,@Value("${gemini.model:gemini-2.5-flash-lite}") String model,AssignmentService assignments,ObjectMapper json,Validator validator) {
        this(key,model,assignments,json,validator,null);
    }
    GeminiAiService(String key,String model,AssignmentService assignments,ObjectMapper json,Validator validator,HttpClient client) {
        this.key=key; this.model=model; this.assignments=assignments; this.json=json; this.validator=validator;
        this.client=client;
    }
    public Draft generate(Generate request,Authentication auth) {
        String subject=assignments.subject(request.subjectId(),auth).getTitle();
        if(key.isBlank()) throw new AssignmentException(503,"Chưa cấu hình GEMINI_API_KEY cho tính năng tạo đề AI");
        boolean isQuiz = "QUIZ".equalsIgnoreCase(request.assignmentType());
        String prompt = isQuiz
            ? ("Tạo đề bài trắc nghiệm bằng tiếng Việt cho môn " + subject + ". Độ khó: " + request.difficulty() + ". Yêu cầu: " + request.topic() + "\nChỉ trả JSON dạng: {\"title\": string, \"description\": string, \"questions\": [{\"text\": string, \"type\": \"SINGLE\", \"options\": [string, string, string, string], \"correctAnswers\": [number]}]}.\nTạo 3 đến 5 câu hỏi trắc nghiệm chất lượng. Title tối đa 200 ký tự. Description tóm tắt mục tiêu bài trắc nghiệm. Options mỗi câu gồm 2 đến 4 lựa chọn. correctAnswers là mảng 0-based index của đáp án đúng (ví dụ [0]). Không thêm markdown.")
            : ("Tạo đề bài tập bằng tiếng Việt cho môn " + subject + ". Độ khó: " + request.difficulty() + ". Yêu cầu: " + request.topic() +
            "\nChỉ trả JSON {\"title\":string,\"description\":string,\"rubric\":[{\"criteria\":string,\"description\":string,\"weight\":number}]}. Title tối đa 200 ký tự. Description nêu yêu cầu, đầu ra, định dạng nộp. Mọi trọng số phải >0 và tổng chính xác 100. Không thêm model hoặc markdown.");
        try {
            String body=json.writeValueAsString(Map.of("contents",List.of(Map.of("parts",List.of(Map.of("text",prompt)))),"generationConfig",Map.of("responseMimeType","application/json")));
            var http=HttpRequest.newBuilder(URI.create("https://generativelanguage.googleapis.com/v1beta/models/"+model+":generateContent"))
                .timeout(Duration.ofSeconds(30)).header("Content-Type","application/json").header("x-goog-api-key",key).POST(HttpRequest.BodyPublishers.ofString(body)).build();
            var response=httpClient().send(http,HttpResponse.BodyHandlers.ofString());
            if(response.statusCode()!=200) throw new AssignmentException(502,"Gemini không thể tạo đề lúc này. Vui lòng thử lại.");
            var parts=json.readTree(response.body()).path("candidates").path(0).path("content").path("parts");
            StringBuilder text = new StringBuilder(); for (var part : parts) if (!part.path("thought").asBoolean(false)) text.append(part.path("text").asText(""));
            String clean = text.toString().trim();
            if (clean.startsWith("```json")) clean = clean.substring(7);
            else if (clean.startsWith("```")) clean = clean.substring(3);
            if (clean.endsWith("```")) clean = clean.substring(0, clean.length() - 3);
            clean = clean.trim();
            Draft generated = json.readValue(clean, Draft.class);
            if(!validator.validate(generated).isEmpty()) throw new AssignmentException(502,"Đề AI trả về không hợp lệ. Hãy tạo lại.");
            List<Criterion> rubric = generated.rubric();
            if (rubric != null && !rubric.isEmpty()) {
                try { assignments.validateRubric(rubric); }
                catch (AssignmentException ignored) { rubric = List.of(); }
            } else {
                rubric = List.of();
            }
            return new Draft(generated.title(), generated.description(), rubric, model, generated.questions() != null ? generated.questions() : List.of());
        } catch(HttpTimeoutException e) { throw new AssignmentException(504,"Gemini quá thời gian chờ 30 giây. Chưa lưu bài tập."); }
        catch(InterruptedException e) { Thread.currentThread().interrupt(); throw new AssignmentException(502,"Yêu cầu tạo đề bị gián đoạn"); }
        catch(AssignmentException e) { throw e; }
        catch(Exception e) { throw new AssignmentException(502,"Không thể đọc hoặc kết nối Gemini. Chưa lưu bài tập."); }
    }

    private HttpClient httpClient() { return client != null ? client : HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build(); }
}
