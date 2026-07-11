/**
 * HistorySection -- 历史记录区块
 *
 * 组合 HistoryFilters + HistoryCard 网格 + 客户端分页（每页 20）+ HistoryDetailDrawer。
 * 图片懒加载（HistoryCard 内 loading="lazy"），首屏不加载全部远程图。
 * 空态用 EmptyState。
 */
import { useState } from "react";
import { useHistory } from "../../hooks/useHistory";
import { panelClass, mutedClass } from "../../studio/constants";
import { EmptyState } from "../ui/EmptyState";
import { HistoryFilters } from "./HistoryFilters";
import { HistoryCard } from "./HistoryCard";
import { HistoryDetailDrawer } from "./HistoryDetailDrawer";
import { Button } from "../ui/Button";
import type { HistoryRecord } from "../../types/api";

type HistorySectionProps = {
  records: HistoryRecord[];
  onMessage: (message: string) => void;
};

export function HistorySection({ records, onMessage }: HistorySectionProps) {
  const { statusFilter, topicFilter, setStatusFilter, setTopicFilter, visible, hasMore, loadMore, resetPaging, filteredCount } =
    useHistory(records);
  const [detailRecord, setDetailRecord] = useState<HistoryRecord | null>(null);

  const handleStatusChange = (status: typeof statusFilter) => {
    setStatusFilter(status);
    resetPaging();
  };
  const handleTopicChange = (topic: typeof topicFilter) => {
    setTopicFilter(topic);
    resetPaging();
  };

  return (
    <section className={panelClass}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">生图历史</h2>
        <span className="text-sm text-text-muted">共 {filteredCount} 条</span>
      </div>

      {records.length === 0 ? (
        <EmptyState title="还没有生成记录" description="去工作台创建第一组吧" />
      ) : (
        <>
          <div className="mb-4">
            <HistoryFilters status={statusFilter} topic={topicFilter} onStatusChange={handleStatusChange} onTopicChange={handleTopicChange} />
          </div>

          {visible.length === 0 ? (
            <p className={mutedClass}>没有符合筛选条件的记录。</p>
          ) : (
            <div className="grid gap-4">
              {visible.map((record) => (
                <HistoryCard key={record.id} record={record} onOpenDetail={setDetailRecord} onMessage={onMessage} />
              ))}
            </div>
          )}

          {hasMore && (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" onClick={loadMore}>
                加载更多
              </Button>
            </div>
          )}
        </>
      )}

      <HistoryDetailDrawer record={detailRecord} onClose={() => setDetailRecord(null)} />
    </section>
  );
}
