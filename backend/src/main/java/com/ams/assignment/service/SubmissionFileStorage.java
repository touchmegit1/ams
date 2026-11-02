package com.ams.assignment.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

@Component
public class SubmissionFileStorage {
    private final Path root;

    public SubmissionFileStorage(@Value("${ams.upload-dir:${java.io.tmpdir}/ams-uploads}") String directory) {
        this.root = Path.of(directory).toAbsolutePath().normalize();
    }

    public String store(MultipartFile file) throws IOException {
        String extension = extension(file.getOriginalFilename());
        String key = UUID.randomUUID() + (extension.isEmpty() ? "" : "." + extension);
        Files.createDirectories(root);
        Files.copy(file.getInputStream(), resolve(key));
        return key;
    }

    public Path resolve(String key) {
        Path path = root.resolve(key).normalize();
        if (!path.startsWith(root) || key.contains("/") || key.contains("\\")) throw new IllegalArgumentException("Invalid file key");
        return path;
    }

    public void delete(String key) {
        if (key == null || key.isBlank()) return;
        try { Files.deleteIfExists(resolve(key)); } catch (IOException ignored) { }
    }

    private String extension(String filename) {
        if (filename == null) return "";
        int dot = filename.lastIndexOf('.');
        return dot < 0 ? "" : filename.substring(dot + 1).toLowerCase(java.util.Locale.ROOT);
    }
}
