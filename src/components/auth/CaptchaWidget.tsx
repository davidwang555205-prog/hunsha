/**
 * CaptchaWidget -- 人机验证占位 UI（go-cap 行为验证）
 *
 * 行为：拉 challenge → 展示"请完成 N 个质询" → 用户输入答案 → 回调 onComplete(solutions)
 * 流程：父组件持 captchaToken state；点击"获取验证码"时若 token 空就调 CaptchaWidget
 *
 * 当前是占位 UI（文字提示 + 答案 input），完整行为验证 UI（拼图/拖拽）后续独立 PR。
 * dev 环境：u.config.Debug=true 时后端跳过 captcha 校验，本组件不强制。
 *
 * 重置策略：父组件传 key={resetSignal} prop，React 在 key 变化时自动卸载+重挂载组件，
 * 避免 useEffect setState 的 anti-pattern。
 */
import { useState } from "react";
import { getChallenge } from "../../api/captcha";
import { Spinner } from "../ui/Spinner";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";

type Props = {
  /** 父组件拿到的回调：solutions 给 fetchCaptchaToken 用 */
  onComplete: (solutions: number[]) => void;
};

export function CaptchaWidget({ onComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [challenge, setChallenge] = useState<{ c: number; token: string } | null>(null);
  const [answer, setAnswer] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const c = await getChallenge();
      setChallenge({ c: c.challenge.c, token: c.token });
    } catch (err) {
      setError((err as Error | undefined)?.message || "获取验证质询失败。");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!challenge) return;
    const parts = answer
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (parts.length !== challenge.c) {
      setError(`请输入 ${challenge.c} 个答案（用空格或逗号分隔）。`);
      return;
    }
    const nums = parts.map((s) => Number(s));
    if (nums.some((n) => !Number.isFinite(n))) {
      setError("答案必须为数字。");
      return;
    }
    setError("");
    onComplete(nums);
  };

  if (!challenge) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Spinner size={14} /> : "进行人机验证"}
        </button>
        {error && <p className="text-xs text-danger" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Field
        label={`人机验证：请完成 ${challenge.c} 个质询`}
        hint="输入答案（用空格或逗号分隔，如：1 2 3）"
      >
        <Input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={`${challenge.c} 个数字答案`}
          autoComplete="off"
        />
      </Field>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          className="inline-flex flex-1 items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-white transition hover:bg-primary-600"
        >
          确认验证
        </button>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Spinner size={14} /> : "换一组"}
        </button>
      </div>
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
    </div>
  );
}
