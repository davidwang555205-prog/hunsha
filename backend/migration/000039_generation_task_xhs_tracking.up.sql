-- 小红书笔记采集：一条生图任务关联一条笔记，所有刷新结果独立保存为快照。
CREATE TABLE IF NOT EXISTS generation_task_xhs_notes (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v1(),
    task_id uuid NOT NULL UNIQUE REFERENCES generation_tasks(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    note_url varchar NOT NULL,
    canonical_url varchar NOT NULL DEFAULT '',
    work_id varchar NOT NULL DEFAULT '',
    account_user_id varchar NOT NULL DEFAULT '',
    account_id varchar NOT NULL DEFAULT '',
    title varchar NOT NULL DEFAULT '',
    body varchar NOT NULL DEFAULT '',
    cover_url varchar NOT NULL DEFAULT '',
    work_type varchar NOT NULL DEFAULT '',
    published_at varchar NOT NULL DEFAULT '',
    user_refresh_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS generation_task_xhs_notes_user_updated_at
    ON generation_task_xhs_notes(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS generation_task_xhs_snapshots (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v1(),
    tracking_id uuid NOT NULL REFERENCES generation_task_xhs_notes(id) ON DELETE CASCADE,
    sequence integer NOT NULL,
    trigger varchar NOT NULL,
    status varchar NOT NULL DEFAULT 'success',
    error varchar NOT NULL DEFAULT '',
    captured_at timestamptz NOT NULL DEFAULT now(),
    work_updated_at varchar NOT NULL DEFAULT '',
    views integer NOT NULL DEFAULT 0,
    likes integer NOT NULL DEFAULT 0,
    collects integer NOT NULL DEFAULT 0,
    comments integer NOT NULL DEFAULT 0,
    shares integer NOT NULL DEFAULT 0,
    account_name varchar NOT NULL DEFAULT '',
    account_avatar varchar NOT NULL DEFAULT '',
    account_display_id varchar NOT NULL DEFAULT '',
    account_user_id varchar NOT NULL DEFAULT '',
    account_description varchar NOT NULL DEFAULT '',
    account_fans integer NOT NULL DEFAULT 0,
    account_total_works integer NOT NULL DEFAULT 0,
    account_likes integer NOT NULL DEFAULT 0,
    account_collects integer NOT NULL DEFAULT 0,
    account_follows integer NOT NULL DEFAULT 0,
    account_updated_at varchar NOT NULL DEFAULT '',
    similar_accounts jsonb NOT NULL DEFAULT '[]'::jsonb,
    similar_summary varchar NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT generation_task_xhs_snapshots_tracking_sequence UNIQUE (tracking_id, sequence)
);

CREATE INDEX IF NOT EXISTS generation_task_xhs_snapshots_tracking_captured_at
    ON generation_task_xhs_snapshots(tracking_id, captured_at);
