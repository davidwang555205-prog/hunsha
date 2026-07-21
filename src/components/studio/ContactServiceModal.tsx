/**
 * ContactServiceModal -- 积分不足时引导联系客服充值
 *
 * 列表/详情交互由 CustomerServicePanel 承载（生图确认弹窗内嵌复用同一块），
 * 本组件只负责弹窗外壳与标题切换。
 */
import { useState } from "react";
import { Modal } from "../ui/Modal";
import { CustomerServicePanel } from "./CustomerServicePanel";
import type { CustomerService } from "../../types/api";

type ContactServiceModalProps = {
  open: boolean;
  onClose: () => void;
};

export function ContactServiceModal({ open, onClose }: ContactServiceModalProps) {
  const [selected, setSelected] = useState<CustomerService | null>(null);

  return (
    <Modal
      key={open ? "cs-open" : "cs-closed"}
      open={open}
      onClose={onClose}
      title={selected ? selected.nickname : "联系客服充值积分"}
      size="sm"
    >
      <CustomerServicePanel onSelectedChange={setSelected} hint="以下客服可协助您充值积分：" />
    </Modal>
  );
}
