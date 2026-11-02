import { describe, expect, it } from "bun:test";
import compactReread from "./compact-reread.js";

describe("compactReread", () => {
  it("compaction ごとに現在の名前を読み、superagent にだけ復旧を配送する", () => {
    // Arrange
    const session = { name: undefined };
    const handlers = new Map();
    const deliveredTo = [];
    compactReread({
      on(...args) {
        handlers.set(...args);
      },
      getSessionName() {
        return session.name;
      },
      sendUserMessage() {
        deliveredTo.push(session.name);
      },
    });

    // Act
    for (const name of [
      undefined,
      "lead-feature-123456",
      "superagent",
      "Superagent",
      "superagent-other",
      "superagent",
    ]) {
      session.name = name;
      handlers.get("session_compact")();
    }

    // Assert
    expect(deliveredTo).toEqual(["superagent", "superagent"]);
  });

  it("成功した自動 shake と要約の保存で復旧し、失敗や後続メソッドの完了では重複しない", () => {
    // Arrange
    const session = { name: "superagent", event: null };
    const handlers = new Map();
    const deliveredAfter = [];
    compactReread({
      on(...args) {
        handlers.set(...args);
      },
      getSessionName() {
        return session.name;
      },
      sendUserMessage() {
        deliveredAfter.push(session.event.case);
      },
    });
    const successfulShake = { action: "shake", aborted: false, skipped: false };
    const events = [
      { ...successfulShake, case: "success", willRetry: true },
      { ...successfulShake, case: "cancelled", aborted: true },
      { ...successfulShake, case: "unchanged", skipped: true },
      { ...successfulShake, case: "unknown result", skipped: undefined },
      { ...successfulShake, case: "fallback", errorMessage: "try next method" },
      { ...successfulShake, case: "empty error", errorMessage: "" },
      { ...successfulShake, case: "summary end", action: "context-full" },
    ];

    // Act
    for (const event of events) {
      session.event = event;
      handlers.get("auto_compaction_end")(event);
    }
    session.name = "lead-feature-123456";
    session.event = { case: "wrong alias" };
    handlers.get("auto_compaction_end")(successfulShake);
    session.name = "superagent";
    session.event = { case: "summary commit" };
    handlers.get("session_compact")();

    // Assert
    expect(deliveredAfter).toEqual(["success", "summary commit"]);
  });
});
