-- 平台管理员标识（D3）：不新增 RBAC 表，直接在 user 上加 is_admin。
-- 语义：is_admin = 1 的用户是平台管理员，可查看/恢复所有工作空间的回收站记录。
--
-- 升级约定：把「系统第一个启用用户」置为平台管理员，与 SystemAdminService 既有的
-- isFirstActiveUser 语义保持一致，避免升级后无人能管理回收站。
ALTER TABLE `user`
    ADD COLUMN `is_admin` TINYINT NOT NULL DEFAULT 0 COMMENT '0 普通用户 / 1 平台管理员' AFTER `status`;

UPDATE `user`
SET `is_admin` = 1
WHERE `is_deleted` = 0 AND `status` = 0
ORDER BY `id` ASC
LIMIT 1;
