import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ login: vi.fn(), isAuthenticated: false, isAdmin: false }),
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
