/**
 * CustomerServicePanel -- 生效客服列表 + 详情（二维码/电话/微信号）
 *
 * 从 ContactServiceModal 抽出的可复用内容区：
 * 积分不足引导弹窗、生图确认弹窗内嵌等多处共用，避免客服交互逻辑重复维护。
 * 挂载即拉取 listCustomerServicePublic（仅生效客服）。
 */
import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { listCustomerServicePublic } from "../../api/admin";
import type { CustomerService } from "../../types/api";

type CustomerServicePanelProps = {
  /** 进入/退出详情视图时回调（外层可用于切换标题等） */
  onSelectedChange?: (cs: CustomerService | null) => void;
  /** 列表顶部提示语；不传则不渲染（外层已有提示文案时省去重复） */
  hint?: string;
};

export function CustomerServicePanel({ onSelectedChange, hint = "以下客服可协助您充值积分：" }: CustomerServicePanelProps) {
  const [list, setList] = useState<CustomerService[]>([]);
  const [selected, setSelectedState] = useState<CustomerService | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const setSelected = (cs: CustomerService | null) => {
    setSelectedState(cs);
    onSelectedChange?.(cs);
  };

  useEffect(() => {
    let cancelled = false;
    listCustomerServicePublic()
      .then((resp) => {
        if (cancelled) return;
        setList(resp.customerService ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError("客服列表加载失败，请稍后重试或联系管理员。");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (selected) {
    return (
      <div className="flex flex-col items-center gap-3 py-2">
        {selected.qrcodeUrl ? (
          <img
            src={selected.qrcodeUrl}
            alt={`${selected.nickname} 微信二维码`}
            className="max-h-72 max-w-full rounded-lg border border-border object-contain"
          />
        ) : (
          <p className="text-sm text-text-subtle">暂未上传微信二维码</p>
        )}
        <p className="text-xs text-text-muted">微信扫一扫，添加客服咨询充值</p>
        <div className="w-full space-y-2 pt-1 text-sm">
          {selected.phone && (
            <div className="flex items-center justify-between rounded-md bg-bg px-3 py-2">
              <span className="text-text-muted">电话</span>
              <span className="font-medium text-text">{selected.phone}</span>
            </div>
          )}
          {selected.wechatId && (
            <div className="flex items-center justify-between gap-2 rounded-md bg-bg px-3 py-2">
              <span className="text-text-muted">微信号</span>
              <span className="flex items-center gap-2">
                <span className="font-medium text-text">{selected.wechatId}</span>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => void navigator.clipboard?.writeText(selected.wechatId)}
                >
                  复制
                </Button>
              </span>
            </div>
          )}
        </div>
        <Button variant="secondary" size="sm" className="mt-2" onClick={() => setSelected(null)}>
          返回列表
        </Button>
      </div>
    );
  }

  return (
    <div className="py-1">
      {loading ? (
        <p className="py-10 text-center text-sm text-text-subtle">加载中…</p>
      ) : loadError ? (
        <p className="py-10 text-center text-sm text-danger">{loadError}</p>
      ) : list.length === 0 ? (
        <p className="py-10 text-center text-sm text-text-subtle">暂无在线客服，请联系管理员。</p>
      ) : (
        <>
          {hint && <p className="mb-3 text-sm text-text-muted">{hint}</p>}
          <ul className="space-y-2">
            {list.map((cs) => (
              <li key={cs.id}>
                <button
                  type="button"
                  onClick={() => setSelected(cs)}
                  className="flex w-full items-center justify-between rounded-md border border-border bg-surface px-3 py-2.5 text-left transition hover:bg-bg"
                >
                  <span className="font-medium text-text">{cs.nickname}</span>
                  <span className="text-sm text-text-muted">{cs.phone || "点击查看"}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
