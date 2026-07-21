import { Button } from "./Button";
import type { GenerationFeedback } from "../../lib/generationFeedback";

type FeedbackAlertProps = {
  feedback: GenerationFeedback;
  className?: string;
  /** action=contact-service 时，在文案下渲染「联系客服充值」按钮并触发此回调。 */
  onAction?: () => void;
};

/** 面向用户的失败提示，标题说明问题类别，正文给出下一步动作。 */
export function FeedbackAlert({ feedback, className = "", onAction }: FeedbackAlertProps) {
  const showAction = feedback.action === "contact-service" && typeof onAction === "function";
  return (
    <div className={`rounded-md bg-danger/10 px-3 py-2.5 text-sm text-danger ring-1 ring-danger/20 ${className}`} role="alert" aria-live="assertive">
      <p className="font-medium">{feedback.title}</p>
      <p className="mt-0.5 text-danger/90">{feedback.message}</p>
      {showAction && (
        <Button variant="link" size="sm" className="mt-1 px-0 text-danger" onClick={onAction}>
          联系客服充值
        </Button>
      )}
    </div>
  );
}
