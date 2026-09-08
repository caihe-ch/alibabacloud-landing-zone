package com.aliyun.autowonder.workspace.event;

import com.aliyun.autowonder.workspace.WorkspaceDeletionLinkage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Compensating half of the workspace deletion linkage: pauses or cancels the workspace's in-flight
 * dispatches once the delete has committed.
 *
 * {@code fallbackExecution = true} so the linkage still runs on a delete that was not wrapped in a
 * transaction — dropping it silently would leave executors working for a workspace that no longer
 * exists. Failures are logged, never rethrown: the delete is already committed and cannot be undone,
 * so the stuck-dispatch compensation owns whatever is left over.
 */
@Component
public class WorkspaceDeletedDispatchLinkageListener {

    private static final Logger log = LoggerFactory.getLogger(WorkspaceDeletedDispatchLinkageListener.class);

    private final WorkspaceDeletionLinkage deletionLinkage;

    public WorkspaceDeletedDispatchLinkageListener(WorkspaceDeletionLinkage deletionLinkage) {
        this.deletionLinkage = deletionLinkage;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onWorkspaceDeleted(WorkspaceDeletedEvent event) {
        try {
            int stopped = deletionLinkage.stopInFlightDispatches(event.workspaceId(), event.operatorId());
            log.info("Workspace deleted dispatch linkage finished workspaceId={} name={} stopped={}",
                    event.workspaceId(), event.workspaceName(), stopped);
        } catch (RuntimeException failure) {
            log.error("Workspace deleted dispatch linkage failed workspaceId={} name={} reason={}",
                    event.workspaceId(), event.workspaceName(),
                    WorkspaceDeletionLinkage.DELETION_REASON, failure);
        }
    }
}
