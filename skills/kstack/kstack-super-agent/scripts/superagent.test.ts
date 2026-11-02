import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { appendLedger, ledgerPath, readLedger, replyRefusal } from "./superagent.ts";

describe("ledger", () => {
  it("追記した行を順に読み出す", () => {
    // Arrange
    const dir = mkdtempSync(path.join(tmpdir(), "superagent-"));
    const file = path.join(dir, "feature.md");
    const lead = {
      at: "2026-11-02T00:00:00.000Z",
      kind: "lead" as const,
      lead: { name: "lead-a", agentDir: "/a", worktree: "/w", pgid: 1 },
      router: { name: "superagent", agentDir: "/r" },
    };
    const report = {
      at: "2026-11-02T00:01:00.000Z",
      kind: "report" as const,
      state: "planning",
      summary: "計画",
      delivered: true,
    };
    appendLedger({ file, entry: lead });
    appendLedger({ file, entry: report });

    // Act
    const entries = readLedger(file);

    // Assert
    expect(entries).toStrictEqual([lead, report]);
  });

  it("worktree からも main checkout と同じ台帳を指す", () => {
    // Arrange
    const main = mkdtempSync(path.join(tmpdir(), "superagent-repo-"));
    const worktree = `${main}-wt`;
    execFileSync("git", ["init", "-q"], { cwd: main });
    execFileSync(
      "git",
      ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "init"],
      { cwd: main },
    );
    execFileSync("git", ["worktree", "add", "-q", worktree], { cwd: main });

    // Act
    const fromWorktree = ledgerPath({ cwd: worktree, feature: "f1" });

    // Assert
    expect(fromWorktree).toBe(ledgerPath({ cwd: main, feature: "f1" }));
  });
});

describe("replyRefusal", () => {
  it("台帳に無い質問 id への回答を拒否する", () => {
    // Arrange
    const entries = [
      {
        at: "2026-11-02T00:01:00.000Z",
        kind: "report" as const,
        state: "planning",
        summary: "計画",
        ask: { id: "q1", text: "A か B か" },
        delivered: true,
      },
    ];

    // Act
    const refusal = replyRefusal({ entries, id: "q2" });

    // Assert
    expect(refusal).toBe("質問 q2 は台帳にありません");
  });

  it("配送済みの質問への回答を拒否する", () => {
    // Arrange
    const entries = [
      {
        at: "2026-11-02T00:01:00.000Z",
        kind: "report" as const,
        state: "planning",
        summary: "計画",
        ask: { id: "q1", text: "A か B か" },
        delivered: true,
      },
      {
        at: "2026-11-02T00:02:00.000Z",
        kind: "reply" as const,
        to: "q1",
        text: "A",
        delivered: true,
      },
    ];

    // Act
    const refusal = replyRefusal({ entries, id: "q1" });

    // Assert
    expect(refusal).toBe("質問 q1 には回答を配送済みです");
  });

  it("未配送で終わった質問には回答し直せる", () => {
    // Arrange
    const entries = [
      {
        at: "2026-11-02T00:01:00.000Z",
        kind: "report" as const,
        state: "planning",
        summary: "計画",
        ask: { id: "q1", text: "A か B か" },
        delivered: true,
      },
      {
        at: "2026-11-02T00:02:00.000Z",
        kind: "reply" as const,
        to: "q1",
        text: "A",
        delivered: false,
      },
    ];

    // Act
    const refusal = replyRefusal({ entries, id: "q1" });

    // Assert
    expect(refusal).toBeUndefined();
  });
});
