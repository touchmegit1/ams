package com.ams.auth.exception;

/** Only deliberately authored, safe business messages may reach clients. */
public class AuthBusinessException extends RuntimeException {
    public AuthBusinessException(String message) { super(message); }
}
