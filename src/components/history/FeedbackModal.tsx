/**
 * FeedbackModal -- 小红书发布反馈弹窗
 *
 * 用户发布笔记后回填：笔记链接 + 阅读/点赞/收藏/评论/转发（互动率前端算，不单独存）。
 * 复用 Modal + Field + Input + Button，视觉统一。
 *
 * 数值指标用 string state 而非 number：number state 下清空输入框时 Number("")===0，
 * 导致初始的 0 无法删除、无法输入新值。string state 允许中间空态，提交时再转 number。
 */
import { useEffect, useState } from "react";
import { Modal } from "../ui/Modal";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { submitFeedback } from "../../api/generation";
import type { HistoryRecord, SubmitFeedbackRequest, TaskFeedback } from "../../types/api";

type FeedbackModalProps = {
  open: boolean;
  onClose: () => void;
  taskId: string;
  /** 编辑时回填，null/空=新增 */
  initial?: TaskFeedback | null;
  /** 提交成功回调，回传更新后的 task */
  onSubmitted?: (task: HistoryRecord) => void;
};

export function FeedbackModal({ open, onClose, taskId, initial, onSubmitted }: FeedbackModalProps) {
  const [noteUrl, setNoteUrl] = useState("");
  const [views, setViews] = useState("0");
  const [likes, setLikes] = useState("0");
  const [collects, setCollects] = useState("0");
  const [comments, setComments] = useState("0");
  const [shares, setShares] = useState("0");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // open 变 true 时回填初始值（编辑场景），切换记录也重置
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNoteUrl(initial?.noteUrl ?? "");
    setViews(String(initial?.views ?? 0));
    setLikes(String(initial?.likes ?? 0));
    setCollects(String(initial?.collects ?? 0));
    setComments(String(initial?.comments ?? 0));
    setShares(String(initial?.shares ?? 0));
    setError("");
  }, [open, initial]);

  const handleSubmit = async () => {
    const url = noteUrl.trim();
    if (!url) {
      setError("请填写小红书笔记链接。");
      return;
    }
    try {
      new URL(url);
    } catch {
      setError("笔记链接格式不正确。");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const req: SubmitFeedbackRequest = {
        noteUrl: url,
        views: Number(views) || 0,
        likes: Number(likes) || 0,
        collects: Number(collects) || 0,
        comments: Number(comments) || 0,
        shares: Number(shares) || 0
      };
      const { task } = await submitFeedback(taskId, req);
      onSubmitted?.(task);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="发布反馈"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            提交
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="小红书笔记链接" hint="发布后复制笔记链接粘贴于此" error={error || undefined}>
          <Input
            type="url"
            placeholder="https://www.xiaohongshu.com/explore/..."
            value={noteUrl}
            onChange={(e) => setNoteUrl(e.target.value)}
            error={!!error}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="阅读量">
            <Input type="number" min={0} value={views} onChange={(e) => setViews(e.target.value)} />
          </Field>
          <Field label="点赞数">
            <Input type="number" min={0} value={likes} onChange={(e) => setLikes(e.target.value)} />
          </Field>
          <Field label="收藏数">
            <Input type="number" min={0} value={collects} onChange={(e) => setCollects(e.target.value)} />
          </Field>
          <Field label="评论数">
            <Input type="number" min={0} value={comments} onChange={(e) => setComments(e.target.value)} />
          </Field>
          <Field label="转发数">
            <Input type="number" min={0} value={shares} onChange={(e) => setShares(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
