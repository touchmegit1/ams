package com.ams.assignment.service;

import org.junit.jupiter.api.Test;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SubmissionTextExtractorTest {
    private final SubmissionTextExtractor extractor = new SubmissionTextExtractor();

    @Test void extractsPlainTextFromSupportedTextFile() {
        assertThat(extractor.extract("answer.txt", "Hello AMS".getBytes(StandardCharsets.UTF_8)))
            .contains("Hello AMS");
    }

    @Test void extractsOnlyTextEntriesFromZipArchives() throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(output)) {
            zip.putNextEntry(new ZipEntry("src/Main.java"));
            zip.write("class Main {}".getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
            zip.putNextEntry(new ZipEntry("image.png"));
            zip.write(new byte[] { 1, 2, 3 });
            zip.closeEntry();
        }

        assertThat(extractor.extract("project.zip", output.toByteArray())).contains("class Main {}").doesNotContain("image.png");
    }

    @Test void rejectsRarForManualReviewInsteadOfPretendingItWasRead() {
        assertThatThrownBy(() -> extractor.extract("project.rar", new byte[] { 1 }))
            .isInstanceOf(SubmissionTextExtractor.UnsupportedContentException.class)
            .hasMessageContaining("RAR");
    }
}
