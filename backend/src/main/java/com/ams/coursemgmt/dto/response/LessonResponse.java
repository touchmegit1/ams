package com.ams.coursemgmt.dto.response;

import com.ams.coursemgmt.entity.Lesson;

public record LessonResponse(Integer lessonId, String title, String content, String videoUrl, Integer orderIndex) {
    public static LessonResponse from(Lesson lesson) {
        return new LessonResponse(lesson.getLessonId(), lesson.getTitle(), lesson.getContent(),
                lesson.getVideoUrl(), lesson.getOrderIndex());
    }
}
