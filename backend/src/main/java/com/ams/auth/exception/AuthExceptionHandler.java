package com.ams.auth.exception;

import com.ams.auth.dto.response.MessageResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.http.converter.HttpMessageNotReadableException;
import lombok.extern.slf4j.Slf4j;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice(basePackages = "com.ams.auth")
@Slf4j
public class AuthExceptionHandler {

    /** Xử lý validation errors */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidationErrors(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            errors.put(fieldError.getField(), fieldError.getDefaultMessage());
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errors);
    }

    /** Xử lý RuntimeException (business logic errors) */
    @ExceptionHandler(AuthBusinessException.class)
    public ResponseEntity<MessageResponse> handleBusinessException(AuthBusinessException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new MessageResponse(ex.getMessage()));
    }

    @ExceptionHandler(RateLimitException.class)
    public ResponseEntity<MessageResponse> handleRateLimit(RateLimitException ex) {
        return ResponseEntity.status(429).header("Retry-After", String.valueOf(ex.getRetryAfter()))
                .body(new MessageResponse(ex.getMessage()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<MessageResponse> handleMalformedBody(HttpMessageNotReadableException ex) {
        return ResponseEntity.badRequest().body(new MessageResponse("Dữ liệu yêu cầu không hợp lệ."));
    }

    /** Xử lý tất cả exception khác */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<MessageResponse> handleGenericException(Exception ex) {
        log.error("Auth request failed ({})", ex.getClass().getSimpleName());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new MessageResponse("Đã có lỗi xảy ra. Vui lòng thử lại sau."));
    }
}
