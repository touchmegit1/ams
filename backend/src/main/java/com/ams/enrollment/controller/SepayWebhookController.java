package com.ams.enrollment.controller;

import com.ams.enrollment.service.SepayWebhookService;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/webhooks/sepay")
public class SepayWebhookController {
    private final SepayWebhookService service;
    public SepayWebhookController(SepayWebhookService service) { this.service = service; }
    @PostMapping
    public Map<String, Boolean> receive(@RequestBody byte[] rawBody,
            @RequestHeader(value = "X-SePay-Timestamp", required = false) String timestamp,
            @RequestHeader(value = "X-SePay-Signature", required = false) String signature) {
        service.verify(rawBody, timestamp, signature);
        service.process(rawBody);
        return Map.of("success", true);
    }
}
