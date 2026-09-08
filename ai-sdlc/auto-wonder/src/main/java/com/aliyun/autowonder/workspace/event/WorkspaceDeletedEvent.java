package com.aliyun.autowonder.workspace.event;

/**
 * Published after a workspace logical delete commits (F2/D5). The dispatch half of the deletion
 * linkage talks to remote executors, so it must not run inside the delete transaction.
 */
public record WorkspaceDeletedEvent(long workspaceId, String workspaceName, long operatorId) {
}
