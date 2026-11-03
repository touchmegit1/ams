package com.ams.assignment.service;

import com.ams.assignment.entity.Submission;
import com.ams.assignment.repository.SubmissionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.*;
import java.nio.file.Files;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@Service
public class SubmissionAiEvaluator {
    private static final int MAX_EXTRACTED_CHARS = 100_000;
    private final SubmissionRepository submissions;
    private final SubmissionFileStorage storage;
    private final ObjectMapper json;
    private final String key, model;

    public SubmissionAiEvaluator(SubmissionRepository submissions, SubmissionFileStorage storage, ObjectMapper json,
            @Value("${gemini.api-key:}") String key, @Value("${gemini.model:gemini-2.5-flash-lite}") String model) {
        this.submissions = submissions;
        this.storage = storage;
        this.json = json;
        this.key = key;
        this.model = model;
    }

    @Transactional
    public Submission evaluateDirect(Integer submissionId) {
        Submission s = submissions.findById(submissionId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy bài nộp"));
        return doEvaluate(s);
    }

    @Async
    @Transactional
    public void evaluate(Integer submissionId) {
        Submission s = submissions.findById(submissionId).orElse(null);
        if (s == null || s.getStatus() == Submission.Status.TEACHER_REVIEWED) return;
        Instant version = s.getSubmittedAt();
        doEvaluate(s);
        submissions.flush();
        if (!Objects.equals(version, s.getSubmittedAt()) || s.getStatus() == Submission.Status.TEACHER_REVIEWED) return;
    }

    public Submission doEvaluate(Submission s) {
        try {
            StringBuilder content = new StringBuilder();
            if (s.getSubmissionText() != null && !s.getSubmissionText().isBlank()) {
                content.append("NỘI DUNG VĂN BẢN TRẢ LỜI CỦA SINH VIÊN:\n")
                       .append(s.getSubmissionText().trim())
                       .append("\n\n");
            }
            if (s.getFileKey() != null && !s.getFileKey().isBlank()) {
                try {
                    String fileContent = extract(s.getFileKey());
                    if (fileContent != null && !fileContent.isBlank()) {
                        content.append("NỘI DUNG TRÍCH XUẤT TỪ TỆP ĐÍNH KÈM (").append(s.getOriginalFileName()).append("):\n")
                               .append(fileContent.trim());
                    }
                } catch (Exception ignored) {
                }
            }

            if (content.isEmpty()) {
                s.setAiEvaluationStatus(Submission.AiEvaluationStatus.UNSUPPORTED);
                s.setAiFeedback("Không tìm thấy nội dung văn bản trong tệp hoặc câu trả lời của sinh viên để đánh giá tự động.");
                return submissions.save(s);
            }

            if (key == null || key.isBlank()) {
                s.setAiEvaluationStatus(Submission.AiEvaluationStatus.FAILED);
                s.setAiFeedback("Chưa cấu hình GEMINI_API_KEY trong hệ thống.");
                return submissions.save(s);
            }

            BigDecimal maxScore = s.getAssignment().getMaxScore();
            String prompt = ("Bạn là trợ lý AI hỗ trợ giảng viên chấm bài tập sinh viên một cách công tâm, khách quan và chi tiết.\n" +
                "Nhiệm vụ: Hãy đọc kỹ yêu cầu đề bài và toàn bộ nội dung bài làm của sinh viên dưới đây, đối chiếu xem sinh viên làm đúng hay sai so với yêu cầu, và đưa ra điểm số cùng nhận xét cụ thể.\n\n" +
                "THÔNG TIN ĐỀ BÀI:\n" +
                "- Tiêu đề bài tập: " + s.getAssignment().getTitle() + "\n" +
                "- Điểm tối đa: " + maxScore + "\n" +
                "- Yêu cầu chi tiết: " + s.getAssignment().getDescription() + "\n\n" +
                "BÀI LÀM CỦA SINH VIÊN:\n" +
                content + "\n\n" +
                "HƯỚNG DẪN ĐÁNH GIÁ:\n" +
                "1. So sánh chi tiết bài làm với từng yêu cầu trong đề bài:\n" +
                "   - Các điểm sinh viên đã làm đúng, đạt yêu cầu.\n" +
                "   - Các điểm làm sai, thiếu sót hoặc chưa hoàn thành.\n" +
                "2. Đưa ra điểm số khách quan từ 0.00 đến " + maxScore + " dựa trên mức độ hoàn thành và chất lượng bài làm.\n" +
                "3. Phần nhận xét (feedback) cần trình bày bằng tiếng Việt rõ ràng, mạch lạc, có các mục:\n" +
                "   - Đánh giá tổng quan\n" +
                "   - Điểm làm tốt / Đúng yêu cầu\n" +
                "   - Điểm sai sót / Cần khắc phục\n" +
                "   - Khuyến nghị cải thiện\n\n" +
                "ĐỊNH DẠNG TRẢ VỀ:\n" +
                "Chỉ trả JSON dạng: {\"score\": number, \"feedback\": string}. score là số thực từ 0 đến " + maxScore + ". Tuyệt đối không thêm markdown code fence hay chữ ngoài JSON.");

            String body = json.writeValueAsString(Map.of(
                "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))),
                "generationConfig", Map.of("responseMimeType", "application/json")
            ));

            HttpRequest req = HttpRequest.newBuilder(URI.create("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent"))
                .timeout(Duration.ofSeconds(35))
                .header("Content-Type", "application/json")
                .header("x-goog-api-key", key)
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

            HttpResponse<String> response = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build().send(req, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                s.setAiEvaluationStatus(Submission.AiEvaluationStatus.FAILED);
                s.setAiFeedback("Gemini AI phản hồi mã lỗi " + response.statusCode() + ". Vui lòng thử lại.");
                return submissions.save(s);
            }

            var parts = json.readTree(response.body()).path("candidates").path(0).path("content").path("parts");
            StringBuilder answerBuilder = new StringBuilder();
            for (var part : parts) {
                if (!part.path("thought").asBoolean(false)) {
                    answerBuilder.append(part.path("text").asText(""));
                }
            }
            String clean = answerBuilder.toString().trim();
            if (clean.startsWith("```json")) clean = clean.substring(7);
            else if (clean.startsWith("```")) clean = clean.substring(3);
            if (clean.endsWith("```")) clean = clean.substring(0, clean.length() - 3);
            clean = clean.trim();

            var result = json.readTree(clean);
            if (!result.path("score").isNumber() || !result.path("feedback").isTextual()) {
                throw new IllegalArgumentException("Invalid Gemini evaluation payload");
            }

            BigDecimal score = result.path("score").decimalValue().setScale(2, java.math.RoundingMode.HALF_UP);
            if (score.signum() < 0) score = BigDecimal.ZERO;
            if (score.compareTo(maxScore) > 0) score = maxScore;

            s.setAiScore(score);
            s.setAiFeedback(result.path("feedback").asText(""));
            s.setAiEvaluationStatus(Submission.AiEvaluationStatus.COMPLETED);
            s.setAiEvaluatedAt(Instant.now());
            return submissions.save(s);
        } catch (UnsupportedOperationException e) {
            s.setAiEvaluationStatus(Submission.AiEvaluationStatus.UNSUPPORTED);
            s.setAiFeedback("Định dạng tệp không được hỗ trợ trích xuất tự động.");
            return submissions.save(s);
        } catch (HttpTimeoutException e) {
            s.setAiEvaluationStatus(Submission.AiEvaluationStatus.FAILED);
            s.setAiFeedback("Quá thời gian chờ phản hồi từ Gemini AI (35 giây). Vui lòng thử lại.");
            return submissions.save(s);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            s.setAiEvaluationStatus(Submission.AiEvaluationStatus.FAILED);
            s.setAiFeedback("Yêu cầu đánh giá AI bị gián đoạn.");
            return submissions.save(s);
        } catch (Exception e) {
            s.setAiEvaluationStatus(Submission.AiEvaluationStatus.FAILED);
            s.setAiFeedback("Lỗi khi đánh giá AI: " + (e.getMessage() != null ? e.getMessage() : "Lỗi không xác định"));
            return submissions.save(s);
        }
    }

    private String extract(String key) throws Exception {
        var path = storage.resolve(key);
        String ext = key.substring(key.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        byte[] bytes = Files.readAllBytes(path);
        return switch (ext) {
            case "txt", "java", "js", "jsx", "ts", "tsx", "py", "html", "css", "json", "xml", "sql", "md", "c", "cpp", "h", "cs", "go", "rb", "php", "yml", "yaml" ->
                new String(bytes, java.nio.charset.StandardCharsets.UTF_8).substring(0, Math.min(bytes.length, MAX_EXTRACTED_CHARS));
            case "pdf" -> {
                try (var doc = Loader.loadPDF(bytes)) {
                    String t = new PDFTextStripper().getText(doc);
                    yield t.substring(0, Math.min(t.length(), MAX_EXTRACTED_CHARS));
                }
            }
            case "docx" -> {
                try (var doc = new XWPFDocument(new ByteArrayInputStream(bytes))) {
                    String t;
                    try (var extractor = new org.apache.poi.xwpf.extractor.XWPFWordExtractor(doc)) {
                        t = extractor.getText();
                    } catch (Throwable ignored) {
                        t = doc.getParagraphs().stream().map(p -> p.getText()).reduce("", (a, b) -> a + "\n" + b);
                    }
                    yield t.substring(0, Math.min(t.length(), MAX_EXTRACTED_CHARS));
                }
            }
            case "doc" -> {
                try (var doc = new org.apache.poi.hwpf.HWPFDocument(new ByteArrayInputStream(bytes))) {
                    String t;
                    try (var extractor = new org.apache.poi.hwpf.extractor.WordExtractor(doc)) {
                        t = extractor.getText();
                    } catch (Throwable ignored) {
                        t = doc.getDocumentText();
                    }
                    yield t.substring(0, Math.min(t.length(), MAX_EXTRACTED_CHARS));
                }
            }
            case "zip" -> extractZip(bytes);
            default -> null;
        };
    }

    private String extractZip(byte[] bytes) throws Exception {
        StringBuilder out = new StringBuilder();
        int entries = 0, total = 0;
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (++entries > 100) throw new UnsupportedOperationException("Too many archive entries");
                String name = entry.getName().replace('\\', '/');
                if (name.startsWith("/") || name.contains("../") || entry.isDirectory()) continue;
                String ext = name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
                if (!Set.of("java","js","jsx","ts","tsx","py","html","css","json","xml","sql","md","c","cpp","h","cs","go","rb","php","yml","yaml","txt").contains(ext)) continue;
                byte[] chunk = zip.readNBytes(Math.min(20_000, MAX_EXTRACTED_CHARS - total));
                total += chunk.length;
                out.append("\n--- ").append(name).append(" ---\n").append(new String(chunk, java.nio.charset.StandardCharsets.UTF_8));
                if (total >= MAX_EXTRACTED_CHARS) break;
            }
        }
        return out.toString();
    }
}
