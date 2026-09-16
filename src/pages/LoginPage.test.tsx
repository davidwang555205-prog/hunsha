// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage";
import type { ApiError } from "../types/api";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// Mock HTMLMediaElement play/pause to avoid jsdom warnings
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.HTMLMediaElement.prototype.pause = () => {};

const mockLogin = vi.fn();

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ login: mockLogin, isAuthenticated: false, isAdmin: false }),
}));

vi.mock("../components/auth/CaptchaWidget", () => ({
  CaptchaWidget: ({ onToken }: { onToken: (token: string) => void }) => {
    return createElement(
      "button",
      {
        "data-testid": "mock-captcha",
        type: "button",
        onClick: () => onToken("dummy-token"),
      },
      "完成人机验证"
    );
  },
}));

describe("LoginPage ICP filing", () => {
  it("renders the filing number as a link to the MIIT filing system", () => {
    const markup = renderToStaticMarkup(
      createElement(MemoryRouter, null, createElement(LoginPage))
    );

    expect(markup).toContain("蜀ICP备2026040143号");
    expect(markup).toContain('href="https://beian.miit.gov.cn/"');
    expect(markup).toContain('target="_blank"');
  });
});

describe("LoginPage - 人机验证与错误处理", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockLogin.mockReset();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  function setInputValue(input: HTMLInputElement, value: string) {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;
    nativeSetter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  it("登录返回密码错误时，应重置验证码，再次点击登录需提示重新完成人机验证而非直接提交旧 token", async () => {
    mockLogin.mockRejectedValue(Object.assign(new Error("邮箱或密码不正确"), { statusCode: 200, code: 10606 }) as ApiError);

    await act(async () => {
      root.render(createElement(MemoryRouter, null, createElement(LoginPage)));
    });

    const accountInput = container.querySelector('input[autocomplete="username"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[autocomplete="current-password"]') as HTMLInputElement;

    await act(async () => {
      setInputValue(accountInput, "test@example.com");
      setInputValue(passwordInput, "wrong-password");
    });

    // 1. 完成人机验证
    const captchaBtn = container.querySelector('[data-testid="mock-captcha"]') as HTMLButtonElement;
    await act(async () => {
      captchaBtn.click();
    });

    // 2. 点击登录
    const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    await act(async () => {
      submitBtn.click();
    });

    // 此时显示密码错误
    expect(container.textContent).toContain("邮箱或密码不正确，请检查后重试。");
    expect(mockLogin).toHaveBeenCalledTimes(1);

    // 3. 再次点击登录（未重新通过人机验证），应当拦截提示「请先完成人机验证」，而不是带着失效 token 再次请求
    await act(async () => {
      submitBtn.click();
    });

    expect(container.textContent).toContain("请先完成人机验证。");
    expect(mockLogin).toHaveBeenCalledTimes(1); // 没有发生第二次无效请求
  });

  it("登录返回 403 时，展示「人机验证已失效，请重新完成验证后再登录。」", async () => {
    mockLogin.mockRejectedValue(Object.assign(new Error("Forbidden"), { statusCode: 403 }) as ApiError);

    await act(async () => {
      root.render(createElement(MemoryRouter, null, createElement(LoginPage)));
    });

    const accountInput = container.querySelector('input[autocomplete="username"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[autocomplete="current-password"]') as HTMLInputElement;

    await act(async () => {
      setInputValue(accountInput, "test@example.com");
      setInputValue(passwordInput, "password123");
    });

    const captchaBtn = container.querySelector('[data-testid="mock-captcha"]') as HTMLButtonElement;
    await act(async () => {
      captchaBtn.click();
    });

    const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    await act(async () => {
      submitBtn.click();
    });

    expect(container.textContent).toContain("人机验证已失效，请重新完成验证后再登录。");
  });
});
