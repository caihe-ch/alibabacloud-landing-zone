package com.aliyun.autowonder.executor.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * What the create-executor dialog holds after a successful create: the one-time plaintext token plus
 * the launch options the operator picked, which are not persisted and must be passed on to
 * build_executor_launch_command.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class CreatedExecutorVO {
    private Long id;
    private Long agentId;
    private String name;
    /** One-time plaintext token; it cannot be read back after this response unless it stays retrievable. */
    private String token;
    private String clientKind;
    private String memoryMode;
    private String model;
    private String reasoningEffort;
    private String contextWindow;
}
