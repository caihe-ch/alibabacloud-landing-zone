package com.aliyun.autowonder.workspace.event;

import com.aliyun.autowonder.workspace.WorkspaceDeletionLinkage;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * The compensating half of the deletion linkage (F2.4/D5). The interesting properties are when it
 * runs and what it does on failure, both of which are invisible from the delete itself.
 */
class WorkspaceDeletedDispatchLinkageListenerTest {

    private static final long WORKSPACE_ID = 10L;
    private static final long OPERATOR_ID = 7L;

    @Test
    void handsTheDeletedWorkspaceToTheDispatchLinkage() {
        WorkspaceDeletionLinkage deletionLinkage = mock(WorkspaceDeletionLinkage.class);
        when(deletionLinkage.stopInFlightDispatches(WORKSPACE_ID, OPERATOR_ID)).thenReturn(3);
        WorkspaceDeletedDispatchLinkageListener listener =
                new WorkspaceDeletedDispatchLinkageListener(deletionLinkage);

        listener.onWorkspaceDeleted(new WorkspaceDeletedEvent(WORKSPACE_ID, "星云工坊", OPERATOR_ID));

        // The event carries the workspace the delete just committed, never the caller's current
        // workspace, which by now may be a different one.
        verify(deletionLinkage).stopInFlightDispatches(WORKSPACE_ID, OPERATOR_ID);
    }

    @Test
    void swallowsALinkageFailureBecauseTheDeleteIsAlreadyCommitted() {
        WorkspaceDeletionLinkage deletionLinkage = mock(WorkspaceDeletionLinkage.class);
        doThrow(new IllegalStateException("executor unreachable"))
                .when(deletionLinkage).stopInFlightDispatches(WORKSPACE_ID, OPERATOR_ID);
        WorkspaceDeletedDispatchLinkageListener listener =
                new WorkspaceDeletedDispatchLinkageListener(deletionLinkage);

        // Rethrowing here would surface as a failed request for a delete that succeeded, and the
        // workspace cannot be un-deleted. The leftover belongs to the stuck-dispatch compensation.
        assertDoesNotThrow(() -> listener.onWorkspaceDeleted(
                new WorkspaceDeletedEvent(WORKSPACE_ID, "星云工坊", OPERATOR_ID)));
    }

    @Test
    void runsAfterCommitAndAlsoWithoutATransaction() throws Exception {
        Method method = WorkspaceDeletedDispatchLinkageListener.class
                .getDeclaredMethod("onWorkspaceDeleted", WorkspaceDeletedEvent.class);
        TransactionalEventListener annotation = method.getAnnotation(TransactionalEventListener.class);

        assertNotNull(annotation, "the dispatch linkage must stay bound to the delete transaction");
        // Inside the transaction the remote round trip would hold the org row lock for its whole
        // duration, so it has to wait for the commit.
        assertEquals(TransactionPhase.AFTER_COMMIT, annotation.phase());
        // Without this a delete that is somehow not wrapped in a transaction would drop the
        // linkage silently and leave executors working for a workspace that no longer exists.
        assertTrue(annotation.fallbackExecution());
    }
}
