package com.aliyun.autowonder.workspace.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class WorkspaceUpdateRequest {
    private String name;
    private String description;
    private String background;
    /** Optimistic lock; the update is rejected unless it still matches the stored row. */
    private Integer version;
}
