package com.aliyun.autowonder.executor;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "autowonder.provider-model-catalog")
public class ProviderModelCatalogProperties {

    private long refreshFixedDelayMs = 86_400_000L;
    private long refreshLockTtlMs = 120_000L;
    private int requestTimeoutSeconds = 20;
    private int ticketTtlSeconds = 30;
    private int maxCandidates = 3;
    private long failureCooldownSeconds = 300L;
    private int workerQueueCapacity = 8;
}
