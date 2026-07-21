/**
 * ContactServiceModal -- 积分不足时引导联系客服充值
 *
 * 列表视图：展示当前生效客服（昵称/电话），点击进入详情视图；
 * 详情视图：二维码大图 + 电话 + 微信号（可复制），可返回列表。
 * 数据走既有 listCustomerServicePublic（仅生效客服），交互结构复用 AppHeader 客服详情。
 */
import { useEffect, useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { listCustomerServicePublic } from "../../api/admin";
import type { CustomerService } from "../../types/api";

type ContactServiceModalProps = {
  open: boolean;
  onClose: () => void;
};

export function ContactServiceModal({ open, onClose }: ContactServiceModalProps) {
  const [list, setList] = useState<CustomerService[]>([]);
  const [selected, setSelected] = useState<CustomerService | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 每次打开重新挂载（key=open），挂载即拉取，避免 effect 内同步 setState。
  useEffect(() => {
    if (!open) return;
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

  return (
    <Modal
      key={open ? "cs-open" : "cs-closed"}
      open={open}
      onClose={onClose}
      title={selected ? selected.nickname : "联系客服充值积分"}
      size="sm"
    >
      {selected ? (
        <div className="flex flex-col items-center gap-3 py-2">
          {selected.qrcodeUrl ? (
            <img
              src={selected.qrcodeUrl}
              alt={`${selected.nickname} 微信二维码`}
              className="h-44 w-44 rounded-lg border border-border object-cover"
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
      ) : (
        <div className="py-1">
          {loading ? (
            <p className="py-10 text-center text-sm text-text-subtle">加载中…</p>
          ) : loadError ? (
            <p className="py-10 text-center text-sm text-danger">{loadError}</p>
          ) : list.length === 0 ? (
            <p className="py-10 text-center text-sm text-text-subtle">暂无在线客服，请联系管理员。</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-text-muted">以下客服可协助您充值积分：</p>
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
      )}
    </Modal>
  );
}
