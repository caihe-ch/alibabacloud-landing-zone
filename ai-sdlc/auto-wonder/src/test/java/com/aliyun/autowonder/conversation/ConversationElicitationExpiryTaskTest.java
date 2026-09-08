package com.aliyun.autowonder.conversation;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Date;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class ConversationElicitationExpiryTaskTest {

    private final ConversationElicitationService elicitationService =
            mock(ConversationElicitationService.class);

    /** 兜底上限存在的理由：永不回答的会话会永久占用执行器槽位与 Qoder 进程。 */
    @Test
    void expiresCardsOlderThanConfiguredTimeout() {
        ConversationElicitationExpiryTask task =
                new ConversationElicitationExpiryTask(elicitationService, 30, 200);
        long before = System.currentTimeMillis();

        task.expire();

        ArgumentCaptor<Date> cutoff = ArgumentCaptor.forClass(Date.class);
        verify(elicitationService).expirePending(cutoff.capture(), eq(200));
        long expected = before - 30 * 60 * 1000L;
        // cutoff 必须落在「现在减去超时」附近，早于它的 PENDING 卡片才该被清掉。
        assertTrue(Math.abs(cutoff.getValue().getTime() - expected) < 5_000L,
                "cutoff 应为当前时间减去 30 分钟，实际 " + cutoff.getValue());
    }

    /** 定时任务抛出去会被调度器记为失败并可能停掉后续触发，必须自己吞掉。 */
    @Test
    void swallowsFailureSoTheScheduleKeepsRunning() {
        ConversationElicitationExpiryTask task =
                new ConversationElicitationExpiryTask(elicitationService, 30, 200);
        doThrow(new IllegalStateException("db down")).when(elicitationService)
                .expirePending(org.mockito.ArgumentMatchers.any(Date.class), anyInt());

        task.expire();

        verify(elicitationService).expirePending(org.mockito.ArgumentMatchers.any(Date.class), eq(200));
    }
}
