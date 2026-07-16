/**
 * useBodyScrollLock -- body 滚动锁定（模块级引用计数）
 *
 * 旧版「读 prev -> 设 hidden -> 恢复 prev」模式有个要命的坑：多个弹窗/抽屉/
 * 图片预览同时打开时，后开者会把前者设的 "hidden" 当成 prev 存下来，关闭时
 * 把 body 恢复成 "hidden"，导致页面永久不能滚动（prev 快照互相污染）。
 *
 * 这里用引用计数根治：第一个锁定者记下原始 overflow 并设 hidden，最后一个
 * 释放者才恢复原值。中间的锁定/释放只动计数不动 body。Drawer + Lightbox
 * 同时开关也不串味。
 */
import { useEffect } from "react";

let lockCount = 0;
let savedOverflow: string | null = null;

export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    if (lockCount === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount === 0 && savedOverflow !== null) {
        document.body.style.overflow = savedOverflow;
        savedOverflow = null;
      }
    };
  }, [locked]);
}
