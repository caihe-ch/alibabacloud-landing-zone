package com.aliyun.autowonder.workspace.dto;

import com.aliyun.autowonder.access.WorkspaceAccessLevel;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class WorkspaceVO {
    private Long id;
    private String name;
    private String description;
    private String background;
    /** Echoed back so the edit modal can send it as the optimistic-lock expectation. */
    private Integer version;
    private WorkspaceAccessLevel accessLevel;
    /**
     * Wrapper type on purpose: Lombok generates {@code getIsOwner()}, which Jackson maps to the
     * JSON key {@code isOwner}. A primitive {@code boolean isOwner} would produce {@code isOwner()}
     * and silently serialize as {@code owner}.
     */
    private Boolean isOwner;
    private Boolean canManage;
}
