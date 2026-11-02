package com.ams.assignment.service;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.hwpf.HWPFDocument;
import org.apache.poi.hwpf.extractor.WordExtractor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.apache.poi.xslf.usermodel.XSLFShape;
import org.apache.poi.xslf.usermodel.XSLFTextShape;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/** Extracts readable assignment evidence without writing archive contents to disk. */
@org.springframework.stereotype.Component
public class SubmissionTextExtractor {
    private static final int MAX_TEXT_CHARS = 100_000;
    private static final long MAX_ARCHIVE_EXPANDED_BYTES = 20L * 1024 * 1024;
    private static final int MAX_ARCHIVE_ENTRIES = 1000;
    private static final Set<String> TEXT_EXTENSIONS = Set.of(
        "txt", "java", "kt", "js", "jsx", "ts", "tsx", "py", "rb", "go", "rs", "c", "h", "cpp", "cs",
        "html", "css", "json", "xml", "md", "sql", "yaml", "yml", "properties", "sh"
    );

    public static class UnsupportedContentException extends RuntimeException {
        public UnsupportedContentException(String message) { super(message); }
        public UnsupportedContentException(String message, Throwable cause) { super(message, cause); }
    }

    public String extract(String filename, byte[] content) {
        String extension = extension(filename);
        try {
            String extracted = switch (extension) {
                case "txt", "java", "kt", "js", "jsx", "ts", "tsx", "py", "rb", "go", "rs", "c", "h", "cpp", "cs", "html", "css", "json", "xml", "md", "sql", "yaml", "yml", "properties", "sh" ->
                    new String(content, StandardCharsets.UTF_8);
                case "pdf" -> extractPdf(content);
                case "doc" -> extractDoc(content);
                case "docx" -> extractDocx(content);
                case "pptx" -> extractPptx(content);
                case "xlsx" -> extractXlsx(content);
                case "zip" -> extractZip(content);
                case "rar" -> throw new UnsupportedContentException("Không thể trích xuất nội dung RAR an toàn; bài đã được lưu để giảng viên chấm thủ công.");
                default -> throw new UnsupportedContentException("Định dạng này chưa thể trích xuất văn bản để chấm tự động.");
            };
            String normalized = extracted == null ? "" : extracted.strip();
            if (normalized.isBlank()) throw new UnsupportedContentException("Không tìm thấy văn bản có thể đọc; bài đã được lưu để giảng viên chấm thủ công.");
            if (normalized.length() > MAX_TEXT_CHARS) throw new UnsupportedContentException("Nội dung trích xuất vượt giới hạn chấm AI 100.000 ký tự.");
            return normalized;
        } catch (UnsupportedContentException e) {
            throw e;
        } catch (Exception e) {
            throw new UnsupportedContentException("Không thể đọc nội dung file; bài đã được lưu để giảng viên chấm thủ công.", e);
        }
    }

    private String extractPdf(byte[] bytes) throws IOException {
        try (var document = Loader.loadPDF(bytes)) { return new PDFTextStripper().getText(document); }
    }

    private String extractDoc(byte[] bytes) throws IOException {
        try (var document = new HWPFDocument(new ByteArrayInputStream(bytes)); var extractor = new WordExtractor(document)) {
            return extractor.getText();
        }
    }

    private String extractDocx(byte[] bytes) throws IOException {
        try (var document = new XWPFDocument(new ByteArrayInputStream(bytes)); var extractor = new XWPFWordExtractor(document)) {
            return extractor.getText();
        }
    }

    private String extractPptx(byte[] bytes) throws IOException {
        StringBuilder text = new StringBuilder();
        try (var presentation = new XMLSlideShow(new ByteArrayInputStream(bytes))) {
            presentation.getSlides().forEach(slide -> slide.getShapes().forEach(shape -> {
                if (shape instanceof XSLFTextShape textShape) append(text, textShape.getText());
            }));
        }
        return text.toString();
    }

    private String extractXlsx(byte[] bytes) throws IOException {
        StringBuilder text = new StringBuilder();
        DataFormatter formatter = new DataFormatter(Locale.ROOT);
        try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(bytes))) {
            for (Sheet sheet : workbook) {
                append(text, sheet.getSheetName());
                for (Row row : sheet) {
                    for (Cell cell : row) append(text, formatter.formatCellValue(cell));
                }
            }
        }
        return text.toString();
    }

    private String extractZip(byte[] bytes) throws IOException {
        StringBuilder text = new StringBuilder();
        long expandedBytes = 0;
        int entries = 0;
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            ZipEntry entry;
            byte[] buffer = new byte[8192];
            while ((entry = zip.getNextEntry()) != null) {
                if (++entries > MAX_ARCHIVE_ENTRIES) throw new UnsupportedContentException("Archive có quá nhiều mục.");
                String name = entry.getName().replace('\\', '/');
                boolean safePath = !name.startsWith("/") && !name.contains("../") && !name.equals("..") && !name.contains(":");
                boolean readable = safePath && !entry.isDirectory() && TEXT_EXTENSIONS.contains(extension(name));
                ByteArrayOutputStream item = readable ? new ByteArrayOutputStream() : null;
                int read;
                while ((read = zip.read(buffer)) != -1) {
                    expandedBytes += read;
                    if (expandedBytes > MAX_ARCHIVE_EXPANDED_BYTES) throw new UnsupportedContentException("Archive vượt giới hạn giải nén an toàn.");
                    if (item != null) item.write(buffer, 0, read);
                }
                if (item != null) {
                    append(text, "\n--- " + name + " ---\n");
                    append(text, item.toString(StandardCharsets.UTF_8));
                    if (text.length() > MAX_TEXT_CHARS) throw new UnsupportedContentException("Nội dung archive vượt giới hạn chấm AI 100.000 ký tự.");
                }
                zip.closeEntry();
            }
        }
        return text.toString();
    }

    private void append(StringBuilder target, String value) {
        if (value == null || value.isBlank()) return;
        if (target.length() + value.length() > MAX_TEXT_CHARS) throw new UnsupportedContentException("Nội dung trích xuất vượt giới hạn chấm AI 100.000 ký tự.");
        target.append(value).append('\n');
    }

    private String extension(String filename) {
        if (filename == null) return "";
        String normalized = filename.replace('\\', '/');
        int slash = normalized.lastIndexOf('/');
        String base = normalized.substring(slash + 1);
        int dot = base.lastIndexOf('.');
        return dot < 0 ? "" : base.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
}
