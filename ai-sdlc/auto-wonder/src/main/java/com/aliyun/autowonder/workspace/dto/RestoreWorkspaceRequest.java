package com.aliyun.autowonder.workspace.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RestoreWorkspaceRequest {
    /**
     * Optional rename (D4). Restore fails with a name-conflict error when the recorded name is
     * already taken by an in-use workspace, and this field lets the operator resolve it in the
     * same request instead of restoring, failing, and editing afterwards.
     */
    private String newName;
}
