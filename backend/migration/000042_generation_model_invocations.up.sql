-- 每一次发往上游模型的生图请求审计。重试和线路降级分别入一条记录。
CREATE TABLE IF NOT EXISTS generation_model_invocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL REFERENCES generation_tasks(id) ON DELETE CASCADE,
    generation_image_id varchar NOT NULL DEFAULT '',
    image_number integer NOT NULL DEFAULT 0,
    user_id uuid NOT NULL,
    username varchar NOT NULL DEFAULT '',
    user_email varchar NOT NULL DEFAULT '',
    user_role varchar NOT NULL DEFAULT '',
    channel_id uuid,
    channel_name varchar NOT NULL DEFAULT '',
    api_base_url text NOT NULL DEFAULT '',
    protocol varchar NOT NULL DEFAULT '',
    model_id varchar NOT NULL DEFAULT '',
    candidate_index integer NOT NULL DEFAULT 0,
    candidate_count integer NOT NULL DEFAULT 0,
    attempt_number integer NOT NULL DEFAULT 0,
    attempt_budget integer NOT NULL DEFAULT 0,
    status varchar NOT NULL DEFAULT 'processing',
    prompt text NOT NULL DEFAULT '',
    prompt_hash varchar NOT NULL DEFAULT '',
    reference_images jsonb NOT NULL DEFAULT '[]'::jsonb,
    size varchar NOT NULL DEFAULT '',
    quality varchar NOT NULL DEFAULT '',
    http_status integer NOT NULL DEFAULT 0,
    latency_ms integer NOT NULL DEFAULT 0,
    response_image_count integer NOT NULL DEFAULT 0,
    error text NOT NULL DEFAULT '',
    requested_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_generation_model_invocations_task_image_time
    ON generation_model_invocations (task_id, image_number, requested_at);
CREATE INDEX IF NOT EXISTS idx_generation_model_invocations_user_time
    ON generation_model_invocations (user_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_model_invocations_channel_time
    ON generation_model_invocations (channel_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_model_invocations_status_time
    ON generation_model_invocations (status, requested_at DESC);
