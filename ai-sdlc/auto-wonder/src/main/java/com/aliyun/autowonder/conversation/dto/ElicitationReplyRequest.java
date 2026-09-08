package com.aliyun.autowonder.conversation.dto;

import lombok.Data;

/**
 * 问答卡片的回答入参。
 *
 * <p>{@code content} 用字符串承载而不是 Map：ACP 的 requestedSchema 是任意
 * JSON Schema，答案结构完全由 Agent 决定，服务端不解释也不重排，原样透传
 * 回执行器最安全。
 */
@Data
public class ElicitationReplyRequest {
    /** accept 或 decline（用户点「跳过」）。 */
    private String action;
    /** accept 时必填的答案 JSON 对象字符串；decline 时忽略。 */
    private String content;
}
