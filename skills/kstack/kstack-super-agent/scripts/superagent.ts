#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

const INTERCOM = path.join(homedir(), ".omp/plugins/node_modules/.bin/pi-intercom");
const STATES = ["planning", "implementing", "review", "blocked", "done"];

interface Peer {
  name: string;
  agentDir: string;
}
type Entry =
  | { at: string; kind: "lead"; lead: Peer & { worktree: string; pgid: number }; router: Peer }
  | {
      at: string;
      kind: "report";
      state: string;
      summary: string;
      ask?: { id: string; text: string };
      delivered: boolean;
    }
  | { at: string; kind: "reply"; to: string; text: string; delivered: boolean };

/**
 * 理由を stderr に出して終了コード 1 を返す。
 */
function fail(message: string) {
  console.error(message);
  return 1;
}

/**
 * 台帳の各行（`- ` に続く JSON）を読み出す。
 */
export function readLedger(file: string) {
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => JSON.parse(line.slice(2)) as Entry);
}

/**
 * 台帳の末尾に 1 行追記する。
 */
export function appendLedger(args: { file: string; entry: Entry }) {
  mkdirSync(path.dirname(args.file), { recursive: true });
  // 追記だけにして、lead と router が同時に書いても互いの行を上書きしない
  appendFileSync(args.file, `- ${JSON.stringify(args.entry)}\n`);
}

/**
 * 質問 id に回答できない理由を返す。回答できるなら undefined を返す。
 * 1. 台帳に無い質問 id なら拒否する
 * 2. 配送済みの回答がある質問なら拒否する
 * 3. それ以外は回答できる
 */
export function replyRefusal(args: { entries: Entry[]; id: string }) {
  // Step 1: 台帳に無い質問 id なら拒否する
  if (!args.entries.some((entry) => entry.kind === "report" && entry.ask?.id === args.id)) {
    return `質問 ${args.id} は台帳にありません`;
  }

  // Step 2: 配送済みの回答がある質問なら拒否する
  if (
    args.entries.some((entry) => entry.kind === "reply" && entry.to === args.id && entry.delivered)
  ) {
    return `質問 ${args.id} には回答を配送済みです`;
  }

  // Step 3: それ以外は回答できる
  return undefined;
}

/**
 * Cwd が属する repo の台帳のファイルを返す。
 */
export function ledgerPath(args: { cwd: string; feature: string }) {
  const commonDir = execFileSync(
    "git",
    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    {
      cwd: args.cwd,
      encoding: "utf8",
    },
  ).trim();
  return path.join(
    homedir(),
    ".superagent/state",
    path.dirname(commonDir).replaceAll("/", "-"),
    `${args.feature}.md`,
  );
}

/**
 * 宛先の profile の broker で生きている同名 session に送り、届いたかを返す。
 * 1. 同名の live session がちょうど 1 つでなければ送らない
 * 2. idle を求められていて作業中なら送らない
 * 3. session id 宛てに送る
 */
function send(args: { peer: Peer; text: string; requireIdle: boolean }) {
  const env = { ...process.env, PI_CODING_AGENT_DIR: args.peer.agentDir };
  try {
    const roster = JSON.parse(
      execFileSync(INTERCOM, ["list", "--json"], { env, encoding: "utf8" }),
    ) as {
      sessions: { name: string; id: string; status: string }[];
    };
    const matches = roster.sessions.filter((session) => session.name === args.peer.name);

    // Step 1: 同名の live session がちょうど 1 つでなければ送らない
    if (matches.length !== 1) {
      return false;
    }

    // Step 2: idle を求められていて作業中なら送らない
    // 非対話の omp は作業中に届いた intercom を捨てるので、送る前に確かめる。status は「idle · <任意の文言>」にもなる
    // Shortcut: list と send の間に作業が始まると取りこぼす。取りこぼしが起きたら ask の受領確認に替える
    if (args.requireIdle && !matches[0].status.startsWith("idle")) {
      return false;
    }

    // Step 3: session id 宛てに送る
    // 名前宛てだと、切断済みの同名 session にも queued として届いてしまう
    execFileSync(INTERCOM, ["send", "--to", matches[0].id, "--text", args.text], {
      env,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Lead の報告を台帳に記録して router に送る。
 */
function report(argv: string[]) {
  const parsed = parseArgs({
    args: argv,
    options: {
      feature: { type: "string" },
      state: { type: "string" },
      summary: { type: "string" },
      ask: { type: "string" },
    },
  });

  if (
    !parsed.values.feature ||
    !parsed.values.state ||
    !parsed.values.summary ||
    !STATES.includes(parsed.values.state)
  ) {
    return fail(
      `usage: report --feature <name> --state <${STATES.join("|")}> --summary <text> [--ask <question>]`,
    );
  }
  const file = ledgerPath({ cwd: process.cwd(), feature: parsed.values.feature });

  if (!existsSync(file)) {
    return fail(`台帳がありません: ${file}`);
  }
  const entries = readLedger(file);
  const lead = entries.find((entry) => entry.kind === "lead");

  if (!lead) {
    return fail(`台帳に lead の行がありません: ${file}`);
  }
  const lines = [
    `[superagent] ${parsed.values.feature} state=${parsed.values.state}: ${parsed.values.summary}`,
  ];
  let ask: { id: string; text: string } | undefined = undefined;

  if (parsed.values.ask) {
    ask = {
      id: `q${entries.filter((entry) => entry.kind === "report" && entry.ask).length + 1}`,
      text: parsed.values.ask,
    };
    lines.push(`質問 ${ask.id}: ${ask.text}`);
  }
  lines.push(`台帳: ${file}`);
  // Router は TUI で、作業中に届いた intercom も捨てずに後ろへ並べるので idle を待たない
  const delivered = send({ peer: lead.router, text: lines.join("\n"), requireIdle: false });
  appendLedger({
    file,
    entry: {
      at: new Date().toISOString(),
      kind: "report",
      state: parsed.values.state,
      summary: parsed.values.summary,
      ask,
      delivered,
    },
  });

  if (!delivered) {
    return fail(`router ${lead.router.name} に届きませんでした。台帳には記録済みです: ${file}`);
  }
  return 0;
}

/**
 * User の回答を台帳に記録して lead に送る。
 */
function reply(argv: string[]) {
  const parsed = parseArgs({
    args: argv,
    options: { ledger: { type: "string" }, to: { type: "string" }, text: { type: "string" } },
  });

  if (!parsed.values.ledger || !parsed.values.to || !parsed.values.text) {
    return fail("usage: reply --ledger <file> --to <question id> --text <answer>");
  }

  if (!existsSync(parsed.values.ledger)) {
    return fail(`台帳がありません: ${parsed.values.ledger}`);
  }
  const entries = readLedger(parsed.values.ledger);
  const refusal = replyRefusal({ entries, id: parsed.values.to });

  if (refusal) {
    return fail(refusal);
  }
  const lead = entries.find((entry) => entry.kind === "lead");

  if (!lead) {
    return fail(`台帳に lead の行がありません: ${parsed.values.ledger}`);
  }
  const delivered = send({
    peer: lead.lead,
    text: `[superagent] ${path.basename(parsed.values.ledger, ".md")} の質問 ${parsed.values.to} への user の回答:\n${parsed.values.text}`,
    requireIdle: true,
  });
  appendLedger({
    file: parsed.values.ledger,
    entry: {
      at: new Date().toISOString(),
      kind: "reply",
      to: parsed.values.to,
      text: parsed.values.text,
      delivered,
    },
  });

  if (!delivered) {
    return fail(
      `lead ${lead.lead.name} が作業中か不在のため未配送です。台帳には未配送として記録済みです`,
    );
  }
  return 0;
}

if (import.meta.main) {
  const commands: Record<string, (argv: string[]) => number> = { report, reply };
  const command = commands[process.argv[2] ?? ""];

  if (!command) {
    process.exit(fail("usage: superagent.ts <report|reply> ..."));
  }
  process.exit(command(process.argv.slice(3)));
}
