import { describe, expect, it } from "bun:test";
import skillReread from "../src/skill-reread.js";

const readCall = (path) => ({
  type: "message",
  message: {
    role: "assistant",
    content: [{ type: "toolCall", name: "read", arguments: { path } }],
  },
});
const skillPrompt = (name) => ({
  type: "custom_message",
  customType: "skill-prompt",
  details: { name },
});

const setup = (branch) => {
  const handlers = new Map();
  const sent = [];
  skillReread({
    on(...args) {
      handlers.set(...args);
    },
    sendUserMessage(...args) {
      sent.push(args);
    },
  });
  const ctx = { sessionManager: { getBranch: () => branch } };
  return { handlers, sent, ctx };
};

describe("skillReread", () => {
  it("read した skill:// と skill-prompt の SKILL を、重複なしで読み込んだ順に followUp で再読させる", () => {
    // Arrange
    const { handlers, sent, ctx } = setup([
      skillPrompt("kstack-root-driven-development"),
      readCall("skill://kstack-git"),
      readCall("skill://crit/references/cli.md:10-20"),
      readCall("skill://kstack-git:raw"),
      readCall("packages/omp-skill-reread/README.md"),
      { type: "message", message: { role: "user", content: "skill://kstack-react" } },
      { type: "custom_message", customType: "skillful-notice", details: { name: "kstack-vite" } },
      { type: "compaction" },
    ]);

    // Act
    handlers.get("session_compact")({}, ctx);

    // Assert
    expect(sent).toEqual([
      [
        "compaction 前に読み込んだ SKILL を読み直してください: skill://kstack-root-driven-development, skill://kstack-git, skill://crit",
        { deliverAs: "followUp", attribution: "agent" },
      ],
    ]);
  });

  it("/clear より前の SKILL は再読させない", () => {
    // Arrange
    const { handlers, sent, ctx } = setup([
      readCall("skill://kstack-git"),
      { type: "reset_boundary" },
      readCall("skill://crit"),
    ]);

    // Act
    handlers.get("session_compact")({}, ctx);

    // Assert
    expect(sent.map(([text]) => text)).toEqual([
      "compaction 前に読み込んだ SKILL を読み直してください: skill://crit",
    ]);
  });

  it("再読させる SKILL が無ければ送らない", () => {
    // Arrange
    const { handlers, sent, ctx } = setup([
      readCall("skill://kstack-git"),
      { type: "reset_boundary" },
      { type: "compaction" },
    ]);

    // Act
    handlers.get("session_compact")({}, ctx);

    // Assert
    expect(sent).toEqual([]);
  });

  it("成功した自動 shake の後だけ再読させ、失敗や後続メソッドの完了では送らない", () => {
    // Arrange
    const { handlers, sent, ctx } = setup([readCall("skill://kstack-git")]);
    const successfulShake = { action: "shake", aborted: false, skipped: false };
    const events = [
      { ...successfulShake, willRetry: true },
      { ...successfulShake, aborted: true },
      { ...successfulShake, skipped: true },
      { ...successfulShake, skipped: undefined },
      { ...successfulShake, errorMessage: "try next method" },
      { ...successfulShake, errorMessage: "" },
      { ...successfulShake, action: "context-full" },
    ];

    // Act
    const delivered = events.map((event) => {
      const before = sent.length;
      handlers.get("auto_compaction_end")(event, ctx);
      return sent.length > before;
    });

    // Assert
    expect(delivered).toEqual([true, false, false, false, false, false, false]);
  });
});
