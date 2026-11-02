package com.ams.assignment.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import java.nio.file.Files;
import java.nio.file.Path;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SubmissionFileStorageTest {
    @TempDir Path root;

    @Test void storesContentUnderRandomPrivateKeyAndKeepsOnlySafeDisplayName() throws Exception {
        SubmissionFileStorage storage = new SubmissionFileStorage(root);
        MockMultipartFile upload = new MockMultipartFile("files", "..\\private\\report.txt", "text/plain", "evidence".getBytes());

        SubmissionFileStorage.StoredFile stored = storage.store(upload);

        assertThat(storage.pathFor(stored.storageKey()).normalize()).startsWith(root.normalize());
        assertThat(stored.originalName()).isEqualTo("report.txt");
        assertThat(Files.readString(storage.pathFor(stored.storageKey()))).isEqualTo("evidence");
        assertThat(stored.storageKey()).doesNotContain("..", "report");
    }

    @Test void rejectsFilesOverTenMegabytesBeforeWritingThem() {
        SubmissionFileStorage storage = new SubmissionFileStorage(root);
        MockMultipartFile upload = new MockMultipartFile("files", "large.txt", "text/plain", new byte[10 * 1024 * 1024 + 1]);
        assertThatThrownBy(() -> storage.store(upload)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("10 MB");
        assertThat(root.toFile().list()).isNullOrEmpty();
    }
}
