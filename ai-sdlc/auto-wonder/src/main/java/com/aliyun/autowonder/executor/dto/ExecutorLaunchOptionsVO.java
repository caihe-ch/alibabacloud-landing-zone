package com.aliyun.autowonder.executor.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;
import java.util.List;

/**
 * Every selectable value the executor page offers for one client kind, plus the defaults the page
 * pre-fills. Mirrors frontend/src/features/executor/qoderOptions.ts so MCP and the page agree.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class ExecutorLaunchOptionsVO {
    private String clientKind;
    private String provider;
    private List<SelectOptionVO> models;
    private List<SelectOptionVO> reasoningEfforts;
    private List<SelectOptionVO> contextWindows;
    private List<SelectOptionVO> memoryModes;
    /** Pre-filled by the launch-command form. */
    private String defaultModel;
    /** Pre-filled by the create-executor form. */
    private String defaultCreateModel;
    private String defaultReasoningEffort;
    private String defaultContextWindow;
    private String defaultMemoryMode;
    /** When the live provider model catalog was last refreshed; null while only the fallback list is known. */
    private Date modelCatalogLastSuccessfulAt;
}
