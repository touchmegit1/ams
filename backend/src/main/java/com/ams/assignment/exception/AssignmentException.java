package com.ams.assignment.exception;
import lombok.Getter;
@Getter
public class AssignmentException extends RuntimeException {
    private final int status;
    private final String field;
    public AssignmentException(int status, String message) { this(status, message, null); }
    public AssignmentException(int status, String message, String field) { super(message); this.status=status; this.field=field; }
}
