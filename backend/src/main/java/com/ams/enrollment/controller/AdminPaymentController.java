package com.ams.enrollment.controller;

import com.ams.enrollment.service.AdminPaymentService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/payments")
public class AdminPaymentController {
    private final AdminPaymentService service;

    public AdminPaymentController(AdminPaymentService service) {
        this.service = service;
    }

    @GetMapping("/overview")
    public Map<String, Object> getFinancialOverview() {
        return service.getFinancialOverview();
    }
}
