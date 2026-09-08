-- 工作空间逻辑删除 + 回收站 + 删除后可重建同名（F2/F3/F4）。
--
-- 1) active_name_key（D2）：名称唯一性从「所有行」收敛到「在用行」。
--    MySQL 唯一键允许多个 NULL，因此软删除时把 active_name_key 置 NULL 即可释放名称，
--    而 name 原样保留供回收站展示与恢复。
--    并发同名创建由 uk_active_name 兜底：只有一个赢家，其余收到唯一键冲突。
-- 2) deleted_at / deleted_by：回收站列表按 deleted_at DESC 排序并展示删除人与删除时间。
ALTER TABLE `org`
    ADD COLUMN `active_name_key` VARCHAR(128) DEFAULT NULL COMMENT '在用名称键；软删除后置 NULL 以释放名称占位' AFTER `name`,
    ADD COLUMN `deleted_at`      DATETIME(3)  DEFAULT NULL COMMENT '逻辑删除时间' AFTER `is_deleted`,
    ADD COLUMN `deleted_by`      BIGINT UNSIGNED DEFAULT NULL COMMENT '执行逻辑删除的 user_id' AFTER `deleted_at`;

-- 历史数据回填：在用行占用名称，已删除行释放名称。
UPDATE `org` SET `active_name_key` = `name` WHERE `is_deleted` = 0;
UPDATE `org` SET `active_name_key` = NULL  WHERE `is_deleted` = 1;

-- 唯一键迁移：uk_name(name) -> uk_active_name(active_name_key)。
ALTER TABLE `org`
    DROP INDEX `uk_name`,
    ADD UNIQUE KEY `uk_active_name` (`active_name_key`);

-- 回收站分页按 (is_deleted, deleted_at DESC, id DESC) 扫描，避免全表排序。
ALTER TABLE `org`
    ADD KEY `idx_org_recycle_bin` (`is_deleted`, `deleted_at`, `id`);
