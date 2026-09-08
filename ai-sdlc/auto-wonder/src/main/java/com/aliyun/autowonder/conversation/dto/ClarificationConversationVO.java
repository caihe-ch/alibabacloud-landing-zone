package com.aliyun.autowonder.conversation.dto;

import lombok.Builder;
import lombok.Data;
import java.util.Date;
import java.util.List;

@Data
@Builder
public class ClarificationConversationVO {
    private Long id;
    private Long agentId;
    private String agentName;
    private String channelConversationId;
    private String status;
    private boolean executorOnline;
    private boolean streamingSupported;
    private boolean cancelSupported;
    /** 执行器声明 CONVERSATION_ACP_INTERACTION_V1 时为 true，前端据此启用卡片交互。 */
    private boolean acpInteractionSupported;
    private String cliSessionRef;
    private String processingStatus;
    private Long processingTurnId;
    private Date lastTurnAt;
    private Date gmtCreate;
    private List<ClarificationTurnVO> turns;
    /** 仅详情接口填充：刷新页面后据此恢复未解决的问答卡片。 */
    private List<ClarificationElicitationVO> pendingElicitations;
}
