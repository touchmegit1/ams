package com.ams.assignment.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

@Component
public class AssignmentResourceStorage {
    public static final long MAX_FILE_SIZE = 100L * 1024 * 1024;
    private final Path root;

    public AssignmentResourceStorage(@Value("${ams.upload-dir:${java.io.tmpdir}/ams-uploads}") String directory) {
        this.root = Path.of(directory).toAbsolutePath().normalize();
    }

    public StoredFile store(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("Vui lòng chọn tệp tài liệu");
        if (file.getSize() > MAX_FILE_SIZE) throw new IllegalArgumentException("Tệp tài liệu không được vượt quá 100 MB");
        String originalName = safeName(file.getOriginalFilename());
        String extension = extension(originalName);
        if (!java.util.Set.of("pdf", "doc", "docx", "zip", "txt", "ppt", "pptx", "xls", "xlsx", "png", "jpg", "jpeg").contains(extension))
            throw new IllegalArgumentException("Định dạng tệp tài liệu chưa được hỗ trợ");
        String key = "resource-" + UUID.randomUUID() + (extension.isEmpty() ? "" : "." + extension);
        Files.createDirectories(root);
        try (var input = file.getInputStream()) { Files.copy(input, resolve(key)); }
        return new StoredFile(key, originalName, resolve(key));
    }

    public Path resolve(String key) {
        Path path = root.resolve(key).normalize();
        if (!path.startsWith(root) || key.contains("/") || key.contains("\\")) throw new IllegalArgumentException("Invalid resource key");
        return path;
    }

    public void delete(String key) {
        if (key == null || key.isBlank()) return;
        try { Files.deleteIfExists(resolve(key)); } catch (IOException ignored) { }
    }

    private String safeName(String filename) {
        String cleaned = filename == null ? "document" : filename.replace('\\', '/');
        cleaned = cleaned.substring(cleaned.lastIndexOf('/') + 1).replaceAll("[\\r\\n\\\"]", "_").trim();
        if (cleaned.isBlank()) cleaned = "document";
        return cleaned.length() > 255 ? cleaned.substring(cleaned.length() - 255) : cleaned;
    }

    private String extension(String filename) {
        int dot = filename.lastIndexOf('.');
        if (dot < 0 || dot == filename.length() - 1) return "";
        String value = filename.substring(dot + 1).toLowerCase(java.util.Locale.ROOT);
        return value.matches("[a-z0-9]{1,12}") ? value : "";
    }

    public record StoredFile(String key, String originalName, Path path) {}
}
