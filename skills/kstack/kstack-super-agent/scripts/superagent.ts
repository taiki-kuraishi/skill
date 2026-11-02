#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
  | { at: string; kind: "reply"; to: string; text: string; delivered: boolean }
  | { at: string; kind: "stop" };

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
 * 指定した profile の broker に登録されている session の一覧を返す。
 */
function roster(agentDir: string) {
  const env = { ...process.env, PI_CODING_AGENT_DIR: agentDir };
  // 同梱の pi-intercom CLI の list --json の出力形で、外部入力ではない
  const parsed: { sessions: { name: string; id: string; status: string }[] } = JSON.parse(
    execFileSync(INTERCOM, ["list", "--json"], { env, encoding: "utf8" }),
  );
  return parsed.sessions;
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
    const matches = roster(args.peer.agentDir).filter((session) => session.name === args.peer.name);

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
  const lead = entries.findLast((entry) => entry.kind === "lead");

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
  const lead = entries.findLast((entry) => entry.kind === "lead");

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

/**
 * Lead の intercom 上の status を返す。broker に届かなければ unknown を返す。
 */
function leadStatus(lead: Peer) {
  try {
    return roster(lead.agentDir).find((entry) => entry.name === lead.name)?.status ?? "absent";
  } catch {
    // その profile の broker が無くても、他の feature の行は出す
    return "unknown";
  }
}

/**
 * Worktree で非対話の lead を起動し、台帳に記録する。
 */
function start(argv: string[]) {
  const parsed = parseArgs({
    args: argv,
    options: {
      feature: { type: "string" },
      worktree: { type: "string" },
      prompt: { type: "string" },
      router: { type: "string", default: "superagent" },
    },
  });

  if (!parsed.values.feature || !parsed.values.worktree || !parsed.values.prompt) {
    return fail(
      "usage: start --feature <name> --worktree <path> --prompt <file> [--router <name>]",
    );
  }

  if (!existsSync(parsed.values.prompt)) {
    return fail(`prompt のファイルがありません: ${parsed.values.prompt}`);
  }
  const file = ledgerPath({ cwd: parsed.values.worktree, feature: parsed.values.feature });

  if (existsSync(file)) {
    const entries = readLedger(file);

    // 同名の lead を 2 つ生かすと回答の宛先が決まらないので、停止を挟ませる
    if (entries.some((entry) => entry.kind === "lead") && entries.at(-1)?.kind !== "stop") {
      return fail(`${parsed.values.feature} の lead が停止されていません。先に stop してください`);
    }
  }
  const fifo = file.replace(/\.md$/, ".in");
  const frames = file.replace(/\.md$/, ".frames");
  // Intercom の名前は broker 全体で一意でないと届かないので、repo ごとの台帳 dir から短いハッシュを付ける
  const repoKey = createHash("sha256").update(path.dirname(file)).digest("hex").slice(0, 6);
  const name = `lead-${parsed.values.feature}-${repoKey}`;
  let profile = "";
  try {
    // Profile は direnv の OMP_PROFILE だけで決まり、omp はそれを agent dir に読み替える
    profile = execFileSync(
      "direnv",
      ["exec", parsed.values.worktree, "sh", "-c", 'printf %s "$OMP_PROFILE"'],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
  } catch {
    return fail(
      `direnv exec ${parsed.values.worktree} に失敗しました。.envrc の allow と worktree を確かめてください`,
    );
  }
  let agentDir = path.join(homedir(), ".pi/agent");

  if (profile) {
    agentDir = path.join(homedir(), ".omp/profiles", profile, "agent");
  }
  mkdirSync(path.dirname(file), { recursive: true });
  // 位置引数の /alias は rpc モードでは実行されないので、名前は stdin の frame で付ける
  writeFileSync(
    frames,
    `${JSON.stringify({ type: "set_session_name", name })}\n${JSON.stringify({ type: "prompt", message: readFileSync(parsed.values.prompt, "utf8") })}\n`,
  );
  rmSync(fifo, { force: true });
  execFileSync("mkfifo", [fifo]);
  // Stdin が閉じると rpc モードの omp は終了するので、sleep に FIFO の書き手を持たせ続ける。
  // Frame も子の cat に書かせ、omp が起動しなくても start 自身は FIFO を開いて止まらないようにする
  const child = spawn(
    "sh",
    [
      "-c",
      'sleep infinity > "$1" & cat "$4" > "$1" & exec direnv exec "$2" omp --mode rpc --no-ui --cwd "$2" < "$1" > "$3" 2>&1',
      "sh",
      fifo,
      parsed.values.worktree,
      file.replace(/\.md$/, ".jsonl"),
      frames,
    ],
    { detached: true, stdio: "ignore" },
  );
  child.unref();

  if (!child.pid) {
    return fail("lead を起動できませんでした");
  }
  appendLedger({
    file,
    entry: {
      at: new Date().toISOString(),
      kind: "lead",
      lead: { name, agentDir, worktree: parsed.values.worktree, pgid: child.pid },
      router: {
        name: parsed.values.router,
        agentDir: process.env.PI_CODING_AGENT_DIR ?? path.join(homedir(), ".pi/agent"),
      },
    },
  });
  console.log(file);
  return 0;
}

/**
 * Cwd の repo の全 feature について、状態・未回答の質問・lead の生存を表にして出す。
 */
function list() {
  const dir = path.dirname(ledgerPath({ cwd: process.cwd(), feature: "_" }));

  if (!existsSync(dir)) {
    return 0;
  }
  const rows = ["| feature | state | 未回答の質問 | lead | 台帳 |", "|---|---|---|---|---|"];
  for (const name of readdirSync(dir).filter((entry) => entry.endsWith(".md"))) {
    const file = path.join(dir, name);
    const entries = readLedger(file);
    const lead = entries.findLast((entry) => entry.kind === "lead");
    const state = entries.findLast((entry) => entry.kind === "report")?.state ?? "starting";
    const open = entries
      .flatMap((entry) => {
        if (entry.kind !== "report" || !entry.ask) {
          return [];
        }
        return [entry.ask.id];
      })
      .filter((id) => !replyRefusal({ entries, id }))
      .join(" ");
    let alive = "stopped";

    if (lead && entries.at(-1)?.kind !== "stop") {
      alive = leadStatus(lead.lead);
    }
    rows.push(`| ${name.slice(0, -3)} | ${state} | ${open} | ${alive} | ${file} |`);
  }
  console.log(rows.join("\n"));
  return 0;
}

/**
 * Lead をプロセスグループごと止め、台帳に記録する。
 */
function stop(argv: string[]) {
  const parsed = parseArgs({ args: argv, options: { feature: { type: "string" } } });

  if (!parsed.values.feature) {
    return fail("usage: stop --feature <name>");
  }
  const file = ledgerPath({ cwd: process.cwd(), feature: parsed.values.feature });

  if (!existsSync(file)) {
    return fail(`台帳がありません: ${file}`);
  }
  const entries = readLedger(file);

  // 停止済みの pgid は別のプロセスグループに再利用されうるので、もう送らない
  if (entries.at(-1)?.kind === "stop") {
    console.error(`${parsed.values.feature} の lead は停止済みです`);
    return 0;
  }
  const lead = entries.findLast((entry) => entry.kind === "lead");

  if (!lead) {
    return fail(`台帳に lead の行がありません: ${file}`);
  }

  // Pgid が 0 以下だと kill が自分のプロセスグループに届く
  if (lead.lead.pgid <= 0) {
    return fail(`台帳の pgid が不正です: ${lead.lead.pgid}`);
  }
  try {
    // Omp だけを止めると、FIFO の書き手の sleep と起動した sh が残る
    process.kill(-lead.lead.pgid, "SIGTERM");
  } catch {
    console.error(`pgid ${lead.lead.pgid} は既に終了しています`);
  }
  appendLedger({ file, entry: { at: new Date().toISOString(), kind: "stop" } });
  // 読み手のいない FIFO を開くと書き込みが止まるので、開かずに消す
  rmSync(file.replace(/\.md$/, ".in"), { force: true });
  return 0;
}

if (import.meta.main) {
  const commands: Record<string, (argv: string[]) => number> = {
    report,
    reply,
    start,
    list,
    stop,
  };
  const command = commands[process.argv[2] ?? ""];

  if (!command) {
    process.exit(fail("usage: superagent.ts <report|reply|start|list|stop> ..."));
  }
  process.exit(command(process.argv.slice(3)));
}
