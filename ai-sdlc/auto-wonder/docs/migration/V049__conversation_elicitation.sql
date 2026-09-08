-- ACP elicitation（Agent 向用户提问）的挂起请求。
--
-- 为什么单独建表而不是复用 agent_conversation_turn_event：
-- 卡片需要可变状态（PENDING → ANSWERED/DECLINED/EXPIRED/CANCELED）与
-- 按 requestId 的唯一约束，而事件表是 append-only 的分片日志。
CREATE TABLE IF NOT EXISTS `agent_conversation_elicitation` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `conversation_id` BIGINT NOT NULL,
  `turn_id` BIGINT NOT NULL,
  `request_id` VARCHAR(64) NOT NULL COMMENT '执行器生成的挂起请求标识',
  `mode` VARCHAR(16) NOT NULL DEFAULT 'form',
  `message` VARCHAR(1024) NULL,
  `schema_json` MEDIUMTEXT NULL COMMENT 'ACP requestedSchema 原样存储',
  `status` VARCHAR(16) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING/ANSWERED/DECLINED/EXPIRED/CANCELED',
  `answer_json` MEDIUMTEXT NULL,
  `gmt_create` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `gmt_modified` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_conv_request` (`tenant_id`, `conversation_id`, `request_id`),
  KEY `idx_turn` (`tenant_id`, `turn_id`),
  KEY `idx_pending_expiry` (`status`, `gmt_create`)
) ENGINE=InnoDB AUTO_INCREMENT=10000 DEFAULT CHARSET=utf8mb4 COMMENT='ACP 问答卡片挂起请求';
