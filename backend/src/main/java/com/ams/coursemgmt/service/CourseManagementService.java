package com.ams.coursemgmt.service;

import com.ams.auth.entity.User;
import com.ams.auth.repository.UserRepository;
import com.ams.coursemgmt.dto.request.CourseRequest;
import com.ams.coursemgmt.dto.request.LessonRequest;
import com.ams.coursemgmt.dto.request.ModuleRequest;
import com.ams.coursemgmt.dto.response.CourseResponse;
import com.ams.coursemgmt.dto.response.LessonResponse;
import com.ams.coursemgmt.dto.response.ModuleResponse;
import com.ams.coursemgmt.entity.Course;
import com.ams.coursemgmt.entity.CourseModule;
import com.ams.coursemgmt.entity.CourseStatus;
import com.ams.coursemgmt.entity.Lesson;
import com.ams.coursemgmt.repository.CourseModuleRepository;
import com.ams.coursemgmt.repository.CourseRepository;
import com.ams.coursemgmt.repository.LessonRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.stream.IntStream;

@Service
public class CourseManagementService {

    private final CourseRepository courseRepository;
    private final CourseModuleRepository moduleRepository;
    private final LessonRepository lessonRepository;
    private final UserRepository userRepository;

    public CourseManagementService(CourseRepository courseRepository,
                                   CourseModuleRepository moduleRepository,
                                   LessonRepository lessonRepository,
                                   UserRepository userRepository) {
        this.courseRepository = courseRepository;
        this.moduleRepository = moduleRepository;
        this.lessonRepository = lessonRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<CourseResponse> listCourses(Integer actorId) {
        User actor = requireManager(actorId);
        List<Course> courses = actor.getRole() == User.Role.ADMIN
                ? courseRepository.findAllByOrderByCreatedAtDesc()
                : courseRepository.findAllByTeacher_UserIdOrderByCreatedAtDesc(actorId);
        return courses.stream().map(CourseResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public CourseResponse getCourse(Integer actorId, Integer courseId) {
        return CourseResponse.from(requireCourse(actorId, courseId));
    }

    @Transactional
    public CourseResponse createCourse(Integer actorId, CourseRequest request) {
        User actor = requireManager(actorId);
        String code = normalizeCode(request.courseCode());
        if (courseRepository.existsByCourseCodeIgnoreCase(code)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Course code already exists");
        }

        Course course = new Course();
        course.setTeacher(actor);
        apply(course, request, true);
        return CourseResponse.from(courseRepository.save(course));
    }

    @Transactional
    public CourseResponse updateCourse(Integer actorId, Integer courseId, CourseRequest request) {
        Course course = requireCourse(actorId, courseId);
        String code = normalizeCode(request.courseCode());
        if (courseRepository.existsByCourseCodeIgnoreCaseAndCourseIdNot(code, courseId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Course code already exists");
        }

        CourseStatus oldStatus = course.getStatus();
        apply(course, request, false);
        if (request.status() != null && !isAllowedTransition(oldStatus, request.status())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Allowed status changes are Draft to Published, Published to Archived, and Archived to Draft");
        }
        return CourseResponse.from(courseRepository.save(course));
    }

    @Transactional
    public void deleteCourse(Integer actorId, Integer courseId) {
        Course course = requireCourse(actorId, courseId);
        for (CourseModule module : moduleRepository.findAllByCourse_CourseIdOrderByOrderIndexAscModuleIdAsc(courseId)) {
            lessonRepository.deleteAllByModule_ModuleId(module.getModuleId());
        }
        moduleRepository.deleteAll(moduleRepository.findAllByCourse_CourseIdOrderByOrderIndexAscModuleIdAsc(courseId));
        courseRepository.delete(course);
    }

    @Transactional(readOnly = true)
    public List<ModuleResponse> listModules(Integer actorId, Integer courseId) {
        requireCourse(actorId, courseId);
        return moduleRepository.findAllByCourse_CourseIdOrderByOrderIndexAscModuleIdAsc(courseId).stream()
                .map(module -> ModuleResponse.from(module,
                        lessonRepository.findAllByModule_ModuleIdOrderByOrderIndexAscLessonIdAsc(module.getModuleId())
                                .stream().map(LessonResponse::from).toList()))
                .toList();
    }

    @Transactional
    public ModuleResponse createModule(Integer actorId, Integer courseId, ModuleRequest request) {
        Course course = requireCourse(actorId, courseId);
        CourseModule module = new CourseModule();
        module.setCourse(course);
        module.setTitle(request.title().trim());
        module.setOrderIndex(request.orderIndex() == null
                ? moduleRepository.findMaxOrderIndex(courseId) + 1
                : request.orderIndex());
        module = moduleRepository.save(module);
        return ModuleResponse.from(module, List.of());
    }

    @Transactional
    public ModuleResponse updateModule(Integer actorId, Integer courseId, Integer moduleId, ModuleRequest request) {
        CourseModule module = requireModule(actorId, courseId, moduleId);
        module.setTitle(request.title().trim());
        if (request.orderIndex() != null) module.setOrderIndex(request.orderIndex());
        return ModuleResponse.from(moduleRepository.save(module),
                lessonRepository.findAllByModule_ModuleIdOrderByOrderIndexAscLessonIdAsc(moduleId)
                        .stream().map(LessonResponse::from).toList());
    }

    @Transactional
    public void deleteModule(Integer actorId, Integer courseId, Integer moduleId) {
        CourseModule module = requireModule(actorId, courseId, moduleId);
        lessonRepository.deleteAllByModule_ModuleId(moduleId);
        moduleRepository.delete(module);
    }

    @Transactional
    public void reorderModules(Integer actorId, Integer courseId, List<Integer> moduleIds) {
        requireCourse(actorId, courseId);
        List<CourseModule> modules = moduleRepository.findAllByCourse_CourseIdOrderByOrderIndexAscModuleIdAsc(courseId);
        reorder(moduleIds, modules.stream().map(CourseModule::getModuleId).toList(),
                id -> modules.stream().filter(module -> module.getModuleId().equals(id)).findFirst().orElseThrow(),
                (module, index) -> module.setOrderIndex(index));
        moduleRepository.saveAll(modules);
    }

    @Transactional
    public LessonResponse createLesson(Integer actorId, Integer courseId, Integer moduleId, LessonRequest request) {
        CourseModule module = requireModule(actorId, courseId, moduleId);
        Lesson lesson = new Lesson();
        lesson.setModule(module);
        apply(lesson, request);
        lesson.setOrderIndex(request.orderIndex() == null
                ? lessonRepository.findMaxOrderIndex(moduleId) + 1
                : request.orderIndex());
        return LessonResponse.from(lessonRepository.save(lesson));
    }

    @Transactional
    public LessonResponse updateLesson(Integer actorId, Integer courseId, Integer moduleId,
                                       Integer lessonId, LessonRequest request) {
        Lesson lesson = requireLesson(actorId, courseId, moduleId, lessonId);
        apply(lesson, request);
        if (request.orderIndex() != null) lesson.setOrderIndex(request.orderIndex());
        return LessonResponse.from(lessonRepository.save(lesson));
    }

    @Transactional
    public void deleteLesson(Integer actorId, Integer courseId, Integer moduleId, Integer lessonId) {
        lessonRepository.delete(requireLesson(actorId, courseId, moduleId, lessonId));
    }

    @Transactional
    public void reorderLessons(Integer actorId, Integer courseId, Integer moduleId, List<Integer> lessonIds) {
        requireModule(actorId, courseId, moduleId);
        List<Lesson> lessons = lessonRepository.findAllByModule_ModuleIdOrderByOrderIndexAscLessonIdAsc(moduleId);
        reorder(lessonIds, lessons.stream().map(Lesson::getLessonId).toList(),
                id -> lessons.stream().filter(lesson -> lesson.getLessonId().equals(id)).findFirst().orElseThrow(),
                (lesson, index) -> lesson.setOrderIndex(index));
        lessonRepository.saveAll(lessons);
    }

    private User requireManager(Integer actorId) {
        User actor = userRepository.findById(actorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User no longer exists"));
        if (actor.getRole() != User.Role.TEACHER && actor.getRole() != User.Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only teachers and admins can manage courses");
        }
        return actor;
    }

    private Course requireCourse(Integer actorId, Integer courseId) {
        User actor = requireManager(actorId);
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found"));
        if (actor.getRole() != User.Role.ADMIN && !course.getTeacher().getUserId().equals(actorId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found");
        }
        return course;
    }

    private CourseModule requireModule(Integer actorId, Integer courseId, Integer moduleId) {
        requireCourse(actorId, courseId);
        CourseModule module = moduleRepository.findById(moduleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Module not found"));
        if (!module.getCourse().getCourseId().equals(courseId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Module not found");
        }
        return module;
    }

    private Lesson requireLesson(Integer actorId, Integer courseId, Integer moduleId, Integer lessonId) {
        requireModule(actorId, courseId, moduleId);
        Lesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lesson not found"));
        if (!lesson.getModule().getModuleId().equals(moduleId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Lesson not found");
        }
        return lesson;
    }

    private void apply(Course course, CourseRequest request, boolean creating) {
        course.setCourseCode(normalizeCode(request.courseCode()));
        course.setTitle(request.title().trim());
        course.setSubject(request.subject().trim());
        course.setTargetAudience(blankToNull(request.targetAudience()));
        course.setDescription(blankToNull(request.description()));
        course.setPrice(request.price() == null ? BigDecimal.ZERO : request.price());
        if (request.status() != null) course.setStatus(request.status());
        else if (creating) course.setStatus(CourseStatus.DRAFT);
    }

    private void apply(Lesson lesson, LessonRequest request) {
        lesson.setTitle(request.title().trim());
        lesson.setContent(blankToNull(request.content()));
        lesson.setVideoUrl(blankToNull(request.videoUrl()));
    }

    private String normalizeCode(String code) {
        return code.trim().toUpperCase(Locale.ROOT);
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private boolean isAllowedTransition(CourseStatus current, CourseStatus next) {
        if (current == next) return true;
        return (current == CourseStatus.DRAFT && next == CourseStatus.PUBLISHED)
                || (current == CourseStatus.PUBLISHED && next == CourseStatus.ARCHIVED)
                || (current == CourseStatus.ARCHIVED && next == CourseStatus.DRAFT);
    }

    private <T> void reorder(List<Integer> requestedIds, List<Integer> existingIds,
                             java.util.function.Function<Integer, T> find,
                             java.util.function.BiConsumer<T, Integer> setIndex) {
        if (requestedIds == null || requestedIds.size() != existingIds.size()
                || new HashSet<>(requestedIds).size() != requestedIds.size()
                || !new HashSet<>(requestedIds).equals(new HashSet<>(existingIds))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "The order must contain every item exactly once");
        }
        IntStream.range(0, requestedIds.size()).forEach(i -> setIndex.accept(find.apply(requestedIds.get(i)), i + 1));
    }
}
