package com.ams.auth.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.util.Locale;
import java.util.regex.Pattern;

public class StrongPasswordValidator implements ConstraintValidator<StrongPassword, String> {
    private static final Pattern UPPER = Pattern.compile("\\p{Lu}");
    private static final Pattern LOWER = Pattern.compile("\\p{Ll}");
    private static final Pattern DIGIT = Pattern.compile("\\p{Nd}");
    private static final Pattern SPECIAL = Pattern.compile("[\\p{P}\\p{S}]");
    private static final Pattern WEAK = Pattern.compile("(?:password|qwerty|admin|administrator|welcome|letmein|abc|123456|iloveyou|changeme)[0-9]*");

    public static boolean isStrong(String value) {
        if (value == null) return false;
        int length = value.codePointCount(0, value.length());
        if (length < 8 || length > 64 || value.codePoints().anyMatch(Character::isISOControl)) return false;
        String compact = value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
        return !WEAK.matcher(compact).matches()
                && UPPER.matcher(value).find() && LOWER.matcher(value).find()
                && DIGIT.matcher(value).find() && SPECIAL.matcher(value).find();
    }

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) { return isStrong(value); }
}
