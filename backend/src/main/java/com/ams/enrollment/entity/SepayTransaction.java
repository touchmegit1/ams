package com.ams.enrollment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;

@Entity
@Table(name = "sepay_transactions")
@Getter @Setter
public class SepayTransaction {
    @Id private Long id;
    @Column(nullable = false) private Instant receivedAt = Instant.now();
}
