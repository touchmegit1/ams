package com.ams.auth.config;

import com.fasterxml.jackson.core.StreamReadConstraints;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JsonSecurityConfig {
    @Bean
    Jackson2ObjectMapperBuilderCustomizer authJsonLimits() {
        return builder -> builder.postConfigurer(mapper -> mapper.getFactory().setStreamReadConstraints(
                StreamReadConstraints.builder().maxStringLength(8192).maxNestingDepth(20)
                        .maxNumberLength(100).maxDocumentLength(32768).build()));
    }
}
