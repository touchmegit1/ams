package com.ams.assignment.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;

/** Private, random-key file storage. Stored names are never derived from client paths. */
@Component
public class SubmissionFileStorage {
    public record StoredFile(String storageKey, String originalName, String mediaType, long sizeBytes, String sha256) {}
    private static final long MAX_FILE_BYTES = 10L * 1024 * 1024;
    private static final String OLE_MAGIC = "D0CF11E0A1B11AE1";
    private final Path root;

    @org.springframework.beans.factory.annotation.Autowired
    public SubmissionFileStorage(@Value("${assignment.storage-dir:${user.home}/.ams/submissions}") String root) {
        this(Path.of(root));
    }

    SubmissionFileStorage(Path root) {
        this.root = root.toAbsolutePath().normalize();
    }

    public StoredFile store(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("File không được để trống.");
        if (file.getSize() > MAX_FILE_BYTES) throw new IllegalArgumentException("Mỗi file tối đa 10 MB.");
        String originalName = safeName(file.getOriginalFilename());
        String extension = extension(originalName);
        byte[] bytes = file.getBytes();
        validateSignature(extension, bytes);
        String key = UUID.randomUUID() + ".blob";
        Path target = pathFor(key);
        Files.createDirectories(root);
        Files.write(target, bytes, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE);
        String contentType = file.getContentType();
        return new StoredFile(key, originalName, contentType == null ? "application/octet-stream" : contentType,
            bytes.length, HexFormat.of().formatHex(sha256(bytes)));
    }

    public Path pathFor(String storageKey) {
        if (storageKey == null || !storageKey.matches("[0-9a-fA-F-]{36}\\.blob")) throw new IllegalArgumentException("Khóa file không hợp lệ.");
        Path path = root.resolve(storageKey).normalize();
        if (!path.startsWith(root)) throw new IllegalArgumentException("Đường dẫn file không hợp lệ.");
        return path;
    }

    public byte[] read(String storageKey) throws IOException { return Files.readAllBytes(pathFor(storageKey)); }
    public void delete(String storageKey) throws IOException { Files.deleteIfExists(pathFor(storageKey)); }

    private void validateSignature(String extension, byte[] bytes) {
        String hex = HexFormat.of().withUpperCase().formatHex(bytes, 0, Math.min(bytes.length, 8));
        boolean valid = switch (extension) {
            case "pdf" -> starts(bytes, "%PDF-".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
            case "doc" -> hex.startsWith(OLE_MAGIC);
            case "zip", "docx", "pptx", "xlsx" -> starts(bytes, new byte[] {'P', 'K', 3, 4}) || starts(bytes, new byte[] {'P', 'K', 5, 6}) || starts(bytes, new byte[] {'P', 'K', 7, 8});
            case "rar" -> starts(bytes, new byte[] {'R', 'a', 'r', '!', 0x1a, 0x07});
            case "png" -> hex.startsWith("89504E470D0A1A0A");
            case "jpg" -> bytes.length >= 3 && (bytes[0] & 0xff) == 0xff && (bytes[1] & 0xff) == 0xd8 && (bytes[2] & 0xff) == 0xff;
            case "txt", "java", "kt", "js", "jsx", "ts", "tsx", "py", "rb", "go", "rs", "c", "h", "cpp", "cs", "html", "css", "json", "xml", "md", "sql", "yaml", "yml", "properties", "sh" -> !containsNul(bytes);
            default -> false;
        };
        if (!valid) throw new IllegalArgumentException("Nội dung file không khớp với định dạng ." + extension + ".");
    }

    private boolean starts(byte[] content, byte[] prefix) {
        if (content.length < prefix.length) return false;
        for (int i = 0; i < prefix.length; i++) if (content[i] != prefix[i]) return false;
        return true;
    }

    private boolean containsNul(byte[] bytes) {
        for (byte value : bytes) if (value == 0) return true;
        return false;
    }

    private String safeName(String filename) {
        String value = filename == null ? "" : filename.replace('\\', '/');
        value = value.substring(value.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}]", "").trim();
        if (value.isBlank() || value.length() > 255) throw new IllegalArgumentException("Tên file không hợp lệ.");
        return value;
    }

    private String extension(String filename) {
        int dot = filename.lastIndexOf('.');
        if (dot < 1 || dot == filename.length() - 1) throw new IllegalArgumentException("File cần có định dạng được hỗ trợ.");
        return filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private byte[] sha256(byte[] bytes) {
        try { return MessageDigest.getInstance("SHA-256").digest(bytes); }
        catch (Exception e) { throw new IllegalStateException("SHA-256 is unavailable", e); }
    }
}
