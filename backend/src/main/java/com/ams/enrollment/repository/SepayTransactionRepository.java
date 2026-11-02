package com.ams.enrollment.repository;

import com.ams.enrollment.entity.SepayTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SepayTransactionRepository extends JpaRepository<SepayTransaction, Long> {}
