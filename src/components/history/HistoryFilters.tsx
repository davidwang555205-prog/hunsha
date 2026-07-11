/**
 * HistoryFilters -- 状态/主题筛选（胶囊式，激活态 primary-50 底）
 */
import type { StatusFilter, TopicFilter } from "../../hooks/useHistory";

type HistoryFiltersProps = {
  status: StatusFilter;
  topic: TopicFilter;
  onStatusChange: (status: StatusFilter) => void;
  onTopicChange: (topic: TopicFilter) => void;
};

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "success", label: "成功" },
  { value: "failed", label: "失败" }
];

const topicOptions: { value: TopicFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "settings", label: "生成设置" },
  { value: "content", label: "小红书内容" }
];

function Pill({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition duration-fast ease-out ${
        active ? "bg-primary-50 text-primary ring-1 ring-primary-100" : "bg-bg text-text-muted ring-1 ring-border hover:bg-primary-50/50"
      }`}
    >
      {label}
    </button>
  );
}

export function HistoryFilters({ status, topic, onStatusChange, onTopicChange }: HistoryFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted">状态</span>
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((option) => (
            <Pill key={option.value} active={status === option.value} label={option.label} onClick={() => onStatusChange(option.value)} />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted">主题</span>
        <div className="flex flex-wrap gap-2">
          {topicOptions.map((option) => (
            <Pill key={option.value} active={topic === option.value} label={option.label} onClick={() => onTopicChange(option.value)} />
          ))}
        </div>
      </div>
    </div>
  );
}
