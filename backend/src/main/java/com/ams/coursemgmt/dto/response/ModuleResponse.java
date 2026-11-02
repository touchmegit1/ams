package com.ams.coursemgmt.dto.response;

import com.ams.coursemgmt.entity.CourseModule;

import java.util.List;

public record ModuleResponse(Integer moduleId, String title, Integer orderIndex, List<LessonResponse> lessons) {
    public static ModuleResponse from(CourseModule module, List<LessonResponse> lessons) {
        return new ModuleResponse(module.getModuleId(), module.getTitle(), module.getOrderIndex(), lessons);
    }
}
