package com.ams.assignment.controller;
import com.ams.assignment.service.AssignmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController @RequestMapping("/api") @RequiredArgsConstructor
public class AssignmentTemplateController {
    private final AssignmentService service;
    @GetMapping("/subjects") public List<Map<String,Object>> subjects(Authentication auth) { return service.subjects(auth); }
    @GetMapping("/assignment-templates") public Map<String,Object> list(@RequestParam(required=false) String keyword,@RequestParam(required=false) Integer subjectId,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size,Authentication auth) { return service.templateList(keyword,subjectId,page,size,auth); }
    @GetMapping("/assignment-templates/{id}") public Map<String,Object> detail(@PathVariable Integer id,Authentication auth) { return service.template(id,auth); }
}
