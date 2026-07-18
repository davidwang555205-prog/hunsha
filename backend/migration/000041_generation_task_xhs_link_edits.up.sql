-- 小红书笔记链接的普通用户修改次数；管理员修改不计入此额度。
ALTER TABLE generation_task_xhs_notes
    ADD COLUMN IF NOT EXISTS user_link_edit_count integer NOT NULL DEFAULT 0;
