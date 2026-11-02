package com.ams.auth.security;

import com.ams.auth.exception.AuthBusinessException;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.util.Collections;

@Component
public class GoogleTokenVerifier {
    private final String clientId;
    public GoogleTokenVerifier(@Value("${google.client-id:}") String clientId) { this.clientId = clientId; }

    public GoogleIdToken.Payload verify(String token) {
        if (clientId.isBlank()) throw new AuthBusinessException("Đăng nhập Google chưa sẵn sàng.");
        try {
            var verifier = new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), GsonFactory.getDefaultInstance())
                    .setAudience(Collections.singletonList(clientId)).build();
            GoogleIdToken idToken = verifier.verify(token);
            if (idToken == null) throw new AuthBusinessException("Không thể xác thực tài khoản Google.");
            return idToken.getPayload();
        } catch (Exception ex) {
            throw new AuthBusinessException("Không thể xác thực tài khoản Google. Vui lòng thử lại.");
        }
    }
}
