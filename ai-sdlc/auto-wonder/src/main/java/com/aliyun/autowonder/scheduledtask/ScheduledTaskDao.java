package com.aliyun.autowonder.scheduledtask;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.Date;
import java.util.List;
import com.aliyun.autowonder.scheduledtask.dto.ScheduledTaskSummaryVO;

@Mapper
public interface ScheduledTaskDao {
    void insert(ScheduledTaskDO task);

    ScheduledTaskDO findById(@Param("workspaceId") Long workspaceId, @Param("id") Long id);

    // Workspace-agnostic lookup for token-authenticated CLI endpoints that resolve
    // the owning workspace from the task itself.
    ScheduledTaskDO findAnyById(@Param("id") Long id);

    ScheduledTaskDO findByIdForUpdate(@Param("workspaceId") Long workspaceId, @Param("id") Long id);

    List<ScheduledTaskDO> listByWorkspace(@Param("workspaceId") Long workspaceId,
                                      @Param("status") String status,
                                      @Param("creatorId") Long creatorId,
                                      @Param("squadId") Long squadId, @Param("keyword") String keyword,
                                      @Param("limit") int limit,
                                      @Param("offset") int offset);

    long countByWorkspace(@Param("workspaceId") Long workspaceId, @Param("status") String status,
                       @Param("creatorId") Long creatorId, @Param("squadId") Long squadId,
                       @Param("keyword") String keyword);
    ScheduledTaskSummaryVO summarizeRuns(@Param("workspaceId") Long workspaceId, @Param("status") String status,
                                         @Param("squadId") Long squadId, @Param("keyword") String keyword);

    List<ScheduledTaskDO> findDue(@Param("now") Date now, @Param("limit") int limit);

    int claimNextFire(@Param("workspaceId") Long workspaceId,
                      @Param("id") Long id,
                      @Param("expectedVersion") Integer expectedVersion,
                      @Param("expectedNextFireAt") Date expectedNextFireAt,
                      @Param("nextFireAt") Date nextFireAt,
                      @Param("lastFireAt") Date lastFireAt,
                      @Param("status") String status,
                      @Param("modifierId") Long modifierId);

    int update(ScheduledTaskDO task);

    int updateStatus(@Param("workspaceId") Long workspaceId,
                     @Param("id") Long id,
                     @Param("expectedStatus") String expectedStatus,
                     @Param("targetStatus") String targetStatus,
                     @Param("version") Integer version,
                     @Param("modifierId") Long modifierId);

    /**
     * Logical delete guarded by workspace and optimistic version. The same statement retires the
     * schedule cursor, so a deleted task cannot be fired again even by a read path that forgets the
     * is_deleted filter. Returns 1 on success, 0 when the version moved or the row is already gone.
     */
    int softDelete(@Param("workspaceId") Long workspaceId,
                   @Param("id") Long id,
                   @Param("expectedVersion") Integer expectedVersion,
                   @Param("modifierId") Long modifierId);

    /**
     * Bulk pause for workspace logical delete (D5). One statement instead of a per-task
     * read-modify-write loop, so a delete cannot be slowed down or half-applied by how many
     * tasks the workspace happens to own. Returns the number of tasks that were ACTIVE.
     */
    int pauseActiveByWorkspace(@Param("workspaceId") Long workspaceId,
                               @Param("modifierId") Long modifierId);
}
