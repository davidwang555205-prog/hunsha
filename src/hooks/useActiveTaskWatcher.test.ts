/**
 * useActiveTaskWatcher 测试
 *
 * 验证：detectTaskTransitions 首次建基线不写通知；queued/processing -> 终态跳变才写通知；
 * 同 taskId 保持终态不重复通知；非 active 起始状态不通知。
 */
import { describe, it, expect } from "vitest";
import { detectTaskTransitions } from "./useActiveTaskWatcher";
import type { GenerationTask } from "../types/api";

function makeTask(overrides: Partial<GenerationTask> = {}): GenerationTask {
  return {
    id: "task-1",
    userId: "user-1",
    categoryId: null,
    channelId: null,
    status: "queued",
    title: "测试标题\n第二行",
    body: "正文",
    tags: [],
    topic: "topic",
    resultImages: [],
    referenceImages: [],
    subTaskStatus: [],
    error: "",
    totalCount: 3,
    completedCount: 0,
    estimatedSeconds: 270,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    ...overrides
  };
}

describe("detectTaskTransitions", () => {
  it("首次快照只建基线不写通知", () => {
    const { transitions, nextBaseline } = detectTaskTransitions(null, [makeTask({ status: "processing" })]);
    expect(transitions).toHaveLength(0);
    expect(nextBaseline).toEqual({ "task-1": "processing" });
  });

  it("processing -> completed 跳变", () => {
    const baseline = { "task-1": "processing" };
    const { transitions } = detectTaskTransitions(baseline, [
      makeTask({ status: "completed", resultImages: [{ id: "i1", url: "u1", downloadUrl: "u1", source: "local" }] })
    ]);
    expect(transitions).toHaveLength(1);
    expect(transitions[0].curStatus).toBe("completed");
  });

  it("processing -> failed 跳变", () => {
    const baseline = { "task-1": "processing" };
    const { transitions } = detectTaskTransitions(baseline, [makeTask({ status: "failed", error: "模型服务异常" })]);
    expect(transitions[0].curStatus).toBe("failed");
  });

  it("queued -> cancelled 跳变", () => {
    const baseline = { "task-1": "queued" };
    const { transitions } = detectTaskTransitions(baseline, [makeTask({ status: "cancelled" })]);
    expect(transitions[0].curStatus).toBe("cancelled");
  });

  it("同 taskId 保持终态不重复通知", () => {
    const baseline = { "task-1": "completed" };
    const { transitions } = detectTaskTransitions(baseline, [makeTask({ status: "completed" })]);
    expect(transitions).toHaveLength(0);
  });

  it("非 active 起始状态不通知", () => {
    const baseline = { "task-1": "failed" };
    const { transitions } = detectTaskTransitions(baseline, [makeTask({ status: "completed" })]);
    expect(transitions).toHaveLength(0);
  });
});
