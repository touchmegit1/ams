package com.ams.coursemgmt.dto.request;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record ReorderRequest(@NotEmpty List<Integer> ids) {}
