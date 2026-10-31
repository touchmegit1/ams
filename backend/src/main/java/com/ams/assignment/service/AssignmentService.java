package com.ams.assignment.service;

import com.ams.assignment.dto.AssignmentDtos.*;
import com.ams.assignment.entity.*;
import com.ams.assignment.entity.Assignment.*;
import com.ams.assignment.exception.AssignmentException;
import com.ams.assignment.repository.*;
import com.ams.auth.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

@Service @RequiredArgsConstructor @Transactional(readOnly=true)
public class AssignmentService {
    private final AssignmentRepository assignments;
    private final AssignmentTemplateRepository templates;
    private final CourseRepository courses;
    private final UserRepository users;
    private final ObjectMapper json;
    private final JdbcTemplate jdbc;

    private boolean admin(Authentication auth) { return auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN")); }
    private int userId(Authentication auth) { return Integer.parseInt(auth.getName()); }
    public Course subject(Integer id, Authentication auth) {
        Course course = courses.findById(id).orElseThrow(() -> new AssignmentException(404,"Không tìm thấy môn học"));
        if (!admin(auth) && !course.getTeacherId().equals(userId(auth))) throw new AssignmentException(403,"Bạn không phụ trách môn học này");
        return course;
    }
    public List<Map<String,Object>> subjects(Authentication auth) {
        return (admin(auth) ? courses.findAll(Sort.by("title")) : courses.findByTeacherIdOrderByTitle(userId(auth)))
            .stream().map(c -> Map.<String,Object>of("id",c.getId(),"name",c.getTitle())).toList();
    }
    private List<Integer> subjectIds(Authentication auth) { return courses.findByTeacherIdOrderByTitle(userId(auth)).stream().map(Course::getId).toList(); }
    private Assignment owned(Integer id, Authentication auth) {
        Assignment a = assignments.findById(id).orElseThrow(() -> new AssignmentException(404,"Không tìm thấy bài tập"));
        subject(a.getSubjectId(),auth); return a;
    }
    private Pageable pageable(int page,int size) { if(page<0 || size<1 || size>100) throw new AssignmentException(400,"Phân trang không hợp lệ"); return PageRequest.of(page,size,Sort.by(Sort.Direction.DESC,"updatedAt").and(Sort.by(Sort.Direction.DESC,"id"))); }
    public Map<String,Object> list(String keyword,Integer subjectId,Source source,Status status,int page,int size,Authentication auth) {
        List<Integer> ids = admin(auth) ? null : subjectIds(auth);
        Specification<Assignment> spec = (root,q,cb) -> {
            List<Predicate> p = new ArrayList<>();
            if(ids!=null) p.add(root.get("subjectId").in(ids));
            if(subjectId!=null) p.add(cb.equal(root.get("subjectId"),subjectId));
            if(source!=null) p.add(cb.equal(root.get("source"),source));
            p.add(status==null ? cb.notEqual(root.get("status"),Status.ARCHIVED) : cb.equal(root.get("status"),status));
            if(keyword!=null && !keyword.isBlank()) p.add(cb.like(cb.lower(root.get("title")),"%"+escape(keyword.toLowerCase().trim())+"%",'!'));
            return cb.and(p.toArray(Predicate[]::new));
        };
        return page(assignments.findAll(spec,pageable(page,size)).map(this::view));
    }
    private String escape(String s) { return s.replace("!","!!").replace("%","!%").replace("_","!_"); }
    private Map<String,Object> page(Page<?> p) { return Map.of("content",p.getContent(),"totalElements",p.getTotalElements(),"totalPages",p.getTotalPages(),"number",p.getNumber()); }
    public Map<String,Object> detail(Integer id,Authentication auth) {
        Assignment a=owned(id,auth); Map<String,Object> result=view(a);
        if(a.getStatus()!=Status.DRAFT) {
            result.put("enrolledCount",countIfAvailable("enrollments","select count(distinct student_id) from enrollments where course_id = ? and payment_status = 'PAID'",a.getSubjectId()));
            result.put("submissionCount",countIfAvailable("submissions","select count(distinct student_id) from submissions where assignment_id = ?",a.getId()));
        }
        return result;
    }
    // Other modules may not have installed their tables yet. Never invent submission counts.
    private Long countIfAvailable(String table,String sql,Integer id) {
        Boolean exists=jdbc.execute((java.sql.Connection c) -> {
            for(String name:List.of(table,table.toUpperCase(Locale.ROOT))) {
                try(var rs=c.getMetaData().getTables(c.getCatalog(),null,name,new String[]{"TABLE"})) { if(rs.next()) return true; }
            } return false;
        });
        return Boolean.TRUE.equals(exists) ? jdbc.queryForObject(sql,Long.class,id) : null;
    }
    private String creator(Integer id) { return id==null ? "—" : users.findById(id).map(u->u.getFullName()).orElse("—"); }
    public Map<String,Object> view(Assignment a) {
        Map<String,Object> m=new LinkedHashMap<>();
        m.put("id",a.getId()); m.put("subjectId",a.getSubjectId()); m.put("subjectName",courses.findById(a.getSubjectId()).map(Course::getTitle).orElse("—"));
        m.put("assignmentType",a.getAssignmentType()==null ? "DOCUMENT" : a.getAssignmentType()); m.put("questions",questions(a.getQuestionsJson()));
        m.put("title",a.getTitle()); m.put("description",a.getDescription()); m.put("rubric",rubric(a.getRubricJson()));
        m.put("dueDate",a.getDueDate()); m.put("maxScore",a.getMaxScore()); m.put("source",a.getSource()); m.put("status",a.getStatus());
        m.put("templateId",a.getTemplateId()); m.put("templateName",a.getTemplateId()==null ? null : templates.findById(a.getTemplateId()).map(AssignmentTemplate::getName).orElse(null));
        m.put("allowedFileTypes",a.getAllowedFileTypes()==null || a.getAllowedFileTypes().isBlank() ? List.of() : Arrays.asList(a.getAllowedFileTypes().split(",")));
        m.put("creator",creator(a.getCreatedBy())); m.put("updatedAt",a.getUpdatedAt()); m.put("aiPrompt",a.getAiPrompt()); return m;
    }
    public List<Criterion> rubric(String value) {
        try { return json.readValue(value,new TypeReference<List<Criterion>>(){}); }
        catch(Exception e) { throw new AssignmentException(409,"Rubric cũ chưa có định dạng JSON hợp lệ; cần chuyển đổi trước khi sử dụng","rubric"); }
    }
    private List<Question> questions(String value) {
        if(value==null || value.isBlank()) return List.of();
        try { return json.readValue(value,new TypeReference<List<Question>>(){}); }
        catch(Exception e) { throw new AssignmentException(409,"Dữ liệu câu hỏi không hợp lệ","questions"); }
    }
    private void validateQuestions(String type,List<Question> questions) {
        if(!"QUIZ".equals(type)) return;
        if(questions==null || questions.isEmpty() || questions.size()>100)
            throw new AssignmentException(400,"Trắc nghiệm cần từ 1 đến 100 câu hỏi","questions");
        for(Question q:questions) {
            if(q==null || q.text()==null || q.text().isBlank() || q.options()==null || q.options().size()<2 || q.options().size()>10
                || q.options().stream().anyMatch(o->o==null || o.isBlank())
                || !("SINGLE".equals(q.type()) || "MULTIPLE".equals(q.type()))
                || q.correctAnswers()==null || q.correctAnswers().isEmpty()
                || q.correctAnswers().stream().anyMatch(i->i==null || i<0 || i>=q.options().size())
                || new HashSet<>(q.correctAnswers()).size()!=q.correctAnswers().size()
                || ("SINGLE".equals(q.type()) && q.correctAnswers().size()!=1))
                throw new AssignmentException(400,"Mỗi câu cần nội dung, ít nhất 2 lựa chọn và đáp án đúng phù hợp","questions");
        }
    }
    public void validateRubric(List<Criterion> rubric) {
        if(rubric==null || rubric.isEmpty() || rubric.size()>30 || rubric.stream().anyMatch(Objects::isNull)
            || rubric.stream().anyMatch(r->r.criteria()==null || r.criteria().isBlank() || r.criteria().length()>200
                || r.description()==null || r.description().isBlank() || r.description().length()>4000
                || r.weight()==null || r.weight().signum()<=0 || r.weight().compareTo(new BigDecimal("100"))>0)
            || rubric.stream().map(Criterion::weight).reduce(BigDecimal.ZERO,BigDecimal::add).compareTo(new BigDecimal("100"))!=0)
            throw new AssignmentException(400,"Tổng trọng số rubric phải bằng 100%","rubric");
    }
    private String encode(Object value) { try { return json.writeValueAsString(value); } catch(Exception e) { throw new IllegalStateException("Cannot serialize assignment",e); } }
    @Transactional public Map<String,Object> save(Integer id,Write w,Authentication auth) {
        Assignment a=id==null ? new Assignment() : owned(id,auth);
        if(a.getStatus()!=Status.DRAFT && a.getStatus()!=Status.PUBLISHED) throw new AssignmentException(409,"Chỉ sửa được bài nháp hoặc bài đang mở");
        subject(w.subjectId(),auth); validateRubric(w.rubric());
        String type=w.assignmentType()==null ? "DOCUMENT" : w.assignmentType();
        validateQuestions(type,w.questions());
        a.setAssignmentType(type); a.setQuestionsJson(encode("QUIZ".equals(type) ? w.questions() : List.of()));
        if(a.getStatus()==Status.PUBLISHED && !a.getSubjectId().equals(w.subjectId())) throw new AssignmentException(409,"Không thể đổi môn học của bài đã xuất bản","subjectId");
        if(w.templateId()!=null) {
            AssignmentTemplate t=templateEntity(w.templateId(),auth);
            if(t.getSubjectId()!=null && !t.getSubjectId().equals(w.subjectId())) throw new AssignmentException(400,"Mẫu không thuộc môn học đã chọn","templateId");
        }
        if(w.source()==Source.TEMPLATE && w.templateId()==null) throw new AssignmentException(400,"Vui lòng chọn mẫu bài tập","templateId");
        if(w.source()==Source.AI && (w.aiPrompt()==null || w.aiPrompt().isBlank())) throw new AssignmentException(400,"Thiếu yêu cầu tạo đề AI","aiPrompt");
        if(id==null) a.setCreatedBy(userId(auth));
        a.setSource(w.source()); a.setTemplateId(w.templateId()); a.setAiPrompt(w.aiPrompt());
        a.setSubjectId(w.subjectId()); a.setTitle(w.title().trim()); a.setDescription(w.description().trim());
        a.setDueDate(w.dueDate()); a.setMaxScore(w.maxScore()); a.setAllowedFileTypes(String.join(",",w.allowedFileTypes())); a.setRubricJson(encode(w.rubric()));
        assignments.saveAndFlush(a);
        if(id==null && a.getTemplateId()!=null) templates.incrementUsage(a.getTemplateId());
        return view(a);
    }
    @Transactional public void delete(Integer id,Authentication auth) { Assignment a=owned(id,auth); if(a.getStatus()!=Status.DRAFT) throw new AssignmentException(409,"Chỉ xóa được bài nháp"); assignments.delete(a); }
    @Transactional public Map<String,Object> transition(Integer id,Status target,Authentication auth) {
        Assignment a=owned(id,auth);
        Status expected=switch(target) { case PUBLISHED->Status.DRAFT; case CLOSED->Status.PUBLISHED; case ARCHIVED->Status.CLOSED; default->null; };
        if(a.getStatus()!=expected) throw new AssignmentException(409,"Không thể chuyển trạng thái bài tập");
        if(target==Status.PUBLISHED) {
            validateRubric(rubric(a.getRubricJson()));
            validateQuestions(a.getAssignmentType(),questions(a.getQuestionsJson()));
            if(a.getTitle()==null || a.getTitle().isBlank() || a.getDescription()==null || a.getDescription().isBlank() || a.getMaxScore()==null || a.getMaxScore().signum()<=0) throw new AssignmentException(400,"Bài tập chưa đủ thông tin để xuất bản");
            if(a.getDueDate()==null || !a.getDueDate().isAfter(LocalDateTime.now())) throw new AssignmentException(400,"Hạn nộp phải ở tương lai","dueDate");
        }
        a.setStatus(target); assignments.saveAndFlush(a); return view(a);
    }
    private AssignmentTemplate templateEntity(Integer id,Authentication auth) {
        AssignmentTemplate t=templates.findById(id).orElseThrow(()->new AssignmentException(404,"Không tìm thấy mẫu"));
        if(t.getSubjectId()!=null) subject(t.getSubjectId(),auth); return t;
    }
    public Map<String,Object> template(Integer id,Authentication auth) { return templateView(templateEntity(id,auth)); }
    private Map<String,Object> templateView(AssignmentTemplate t) {
        Map<String,Object> m=new LinkedHashMap<>();
        m.put("id",t.getId()); m.put("name",t.getName()); m.put("subjectId",t.getSubjectId()); m.put("subjectName",t.getSubjectId()==null ? "Dùng chung" : courses.findById(t.getSubjectId()).map(Course::getTitle).orElse("—"));
        m.put("description",t.getDescription()); m.put("defaultMaxScore",t.getDefaultMaxScore()); m.put("rubric",rubric(t.getRubricJson())); m.put("creator",creator(t.getCreatedBy())); m.put("updatedAt",t.getUpdatedAt()); m.put("usageCount",t.getUsageCount()); return m;
    }
    public Map<String,Object> templateList(String keyword,Integer subjectId,int page,int size,Authentication auth) {
        List<Integer> ids=admin(auth)?null:subjectIds(auth);
        Specification<AssignmentTemplate> spec=(r,q,cb)-> {
            List<Predicate> p=new ArrayList<>();
            if(ids!=null) p.add(cb.or(cb.isNull(r.get("subjectId")),r.get("subjectId").in(ids)));
            if(subjectId!=null) p.add(cb.or(cb.isNull(r.get("subjectId")),cb.equal(r.get("subjectId"),subjectId)));
            if(keyword!=null && !keyword.isBlank()) p.add(cb.like(cb.lower(r.get("name")),"%"+escape(keyword.toLowerCase().trim())+"%",'!'));
            return cb.and(p.toArray(Predicate[]::new));
        };
        return page(templates.findAll(spec,pageable(page,size)).map(this::templateView));
    }
}
