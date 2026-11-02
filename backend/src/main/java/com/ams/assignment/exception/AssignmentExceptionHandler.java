package com.ams.assignment.exception;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.dao.OptimisticLockingFailureException;
import java.util.*;

@RestControllerAdvice(basePackages="com.ams.assignment")
public class AssignmentExceptionHandler {
    private ResponseEntity<?> response(int status, String message, List<?> errors) {
        return ResponseEntity.status(status).body(Map.of("status",status,"message",message,"errors",errors));
    }
    @ExceptionHandler(AssignmentException.class) ResponseEntity<?> business(AssignmentException e) {
        return response(e.getStatus(),e.getMessage(),e.getField()==null ? List.of() : List.of(Map.of("field",e.getField(),"message",e.getMessage())));
    }
    @ExceptionHandler(MethodArgumentNotValidException.class) ResponseEntity<?> validation(MethodArgumentNotValidException e) {
        return response(400,"Dữ liệu chưa hợp lệ",e.getBindingResult().getFieldErrors().stream().map(f -> Map.of("field",f.getField(),"message",Objects.toString(f.getDefaultMessage(),"Không hợp lệ"))).toList());
    }
    @ExceptionHandler({HttpMessageNotReadableException.class,MethodArgumentTypeMismatchException.class}) ResponseEntity<?> malformed(Exception e) {
        return response(400,"Dữ liệu yêu cầu không hợp lệ",List.of());
    }
    @ExceptionHandler(OptimisticLockingFailureException.class) ResponseEntity<?> conflict(Exception e) {
        return response(409,"Bài tập vừa được thay đổi. Vui lòng tải lại trang.",List.of());
    }
}
