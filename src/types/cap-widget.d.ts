/**
 * Cap.js widget React JSX 类型扩展
 *
 * @cap.js/widget 的 d.ts 用 declare global { interface HTMLElementTagNameMap } 注册了 cap-widget，
 * 但 React 19 的 JSX 类型在 React.JSX 命名空间下（不是全局 JSX）。
 * 这里显式声明 React.JSX.IntrinsicElements['cap-widget']。
 */
import "react";
import type { CapWidget } from "@cap.js/widget";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "cap-widget": React.DetailedHTMLProps<
        React.HTMLAttributes<CapWidget> & {
          "data-cap-api-endpoint"?: string;
          "data-cap-worker-count"?: string;
          "data-cap-hidden-field-name"?: string;
        },
        CapWidget
      >;
    }
  }
}

export {};
