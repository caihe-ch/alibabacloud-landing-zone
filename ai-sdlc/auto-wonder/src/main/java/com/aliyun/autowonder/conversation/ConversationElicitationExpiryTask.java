package com.aliyun.autowonder.conversation;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Date;

/**
 * 问答卡片的兜底过期任务。
 *
 * <p>挂起期间 Qoder 的语义空闲超时被 pendingTools 无限续租，进程不会被回收 ——
 * 这让挂起等待是安全的，但也意味着永不回答的会话会永久占用执行器槽位与
 * Qoder 进程。所以必须有服务端兜底上限。
 */
@Component
public class ConversationElicitationExpiryTask {

    private static final Logger log = LoggerFactory.getLogger(ConversationElicitationExpiryTask.class);

    private final ConversationElicitationService elicitationService;
    private final int timeoutMinutes;
    private final int batchSize;

    public ConversationElicitationExpiryTask(ConversationElicitationService elicitationService,
            @Value("${autowonder.conversation.elicitation.timeout-minutes:30}") int timeoutMinutes,
            @Value("${autowonder.conversation.elicitation.expiry-batch-size:200}") int batchSize) {
        this.elicitationService = elicitationService;
        this.timeoutMinutes = timeoutMinutes;
        this.batchSize = batchSize;
    }

    @Scheduled(fixedDelayString = "${autowonder.conversation.elicitation.expiry-fixed-delay-ms:60000}")
    public void expire() {
        Date cutoff = new Date(System.currentTimeMillis() - timeoutMinutes * 60_000L);
        try {
            elicitationService.expirePending(cutoff, batchSize);
        } catch (RuntimeException e) {
            // 抛出去会被调度器记为失败，必须自己吞掉，否则后续触发可能停摆。
            log.warn("conversation elicitation expiry sweep failed cutoff={}: {}",
                    cutoff, e.getMessage());
        }
    }
}
