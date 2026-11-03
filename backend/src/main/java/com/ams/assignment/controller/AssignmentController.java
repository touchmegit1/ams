package com.ams.assignment.controller;
import com.ams.assignment.dto.AssignmentDtos.*;
import com.ams.assignment.entity.Assignment.*;
import com.ams.assignment.service.AssignmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
@RestController @RequestMapping("/api/assignments") @RequiredArgsConstructor
public class AssignmentController {
    private final AssignmentService service;
    @GetMapping public Map<String,Object> list(@RequestParam(required=false) String keyword,@RequestParam(required=false) Integer subjectId,@RequestParam(required=false) Source source,@RequestParam(required=false) Status status,@RequestParam(required=false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate dueDate,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size,Authentication auth) { return service.list(keyword,subjectId,source,status,dueDate,page,size,auth); }
    @GetMapping("/{id}") public Map<String,Object> detail(@PathVariable Integer id,Authentication auth) { return service.detail(id,auth); }
    @PostMapping @ResponseStatus(org.springframework.http.HttpStatus.CREATED) public Map<String,Object> create(@Valid @RequestBody Write body,Authentication auth) { return service.save(null,body,auth); }
    @PutMapping("/{id}") public Map<String,Object> edit(@PathVariable Integer id,@Valid @RequestBody Write body,Authentication auth) { return service.save(id,body,auth); }
    @DeleteMapping("/{id}") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT) public void delete(@PathVariable Integer id,Authentication auth) { service.delete(id,auth); }
    @PostMapping("/{id}/publish") public Map<String,Object> publish(@PathVariable Integer id,Authentication auth) { return service.transition(id,Status.PUBLISHED,auth); }
    @PostMapping("/{id}/close") public Map<String,Object> close(@PathVariable Integer id,Authentication auth) { return service.transition(id,Status.CLOSED,auth); }
    @PostMapping("/{id}/archive") public Map<String,Object> archive(@PathVariable Integer id,Authentication auth) { return service.transition(id,Status.ARCHIVED,auth); }
}
