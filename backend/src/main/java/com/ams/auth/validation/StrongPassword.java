package com.ams.auth.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.*;

@Documented
@Constraint(validatedBy = StrongPasswordValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface StrongPassword {
    String message() default "Mật khẩu cần 8–64 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt; không dùng mật khẩu phổ biến.";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
