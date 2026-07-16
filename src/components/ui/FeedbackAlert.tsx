import type { GenerationFeedback } from "../../lib/generationFeedback";

type FeedbackAlertProps = {
  feedback: GenerationFeedback;
  className?: string;
};

/** 面向用户的失败提示，标题说明问题类别，正文给出下一步动作。 */
export function FeedbackAlert({ feedback, className = "" }: FeedbackAlertProps) {
  return (
    <div className={`rounded-md bg-danger/10 px-3 py-2.5 text-sm text-danger ring-1 ring-danger/20 ${className}`} role="alert" aria-live="assertive">
      <p className="font-medium">{feedback.title}</p>
      <p className="mt-0.5 text-danger/90">{feedback.message}</p>
    </div>
  );
}
