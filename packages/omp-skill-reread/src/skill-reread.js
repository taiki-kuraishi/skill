// 名前空間付きの SKILL（skill://<ns>/<name>）は URL だけでは SKILL 内のファイルと区別できないため、先頭の名前だけを取る
const SKILL_URL = /^skill:\/\/(?<name>[^/:]+)/;

/** 渡された assistant の message から、read で読んだ skill:// の SKILL 名を返す。 */
const readSkillNames = (message) => {
  const names = [];

  for (const block of message.content) {
    const match =
      block.type === "toolCall" && block.name === "read" && SKILL_URL.exec(block.arguments.path);

    if (match) {
      names.push(match.groups.name);
    }
  }

  return names;
};

/**
 * 圧縮後に、session で読み込んだ SKILL の再読を促す extension を登録する。
 * 1. 現在の branch をたどり、read した skill:// と skill-prompt の message の SKILL 名を集める
 * 2. SKILL が無ければ何もしない
 * 3. 集めた SKILL の再読を促す followUp を送る
 * 4. 自動 shake 以外と、中断・変更なし・失敗の完了通知を無視する
 * 5. 成功した自動 shake の後も再読を促す
 */
export default function skillReread(pi) {
  const reread = (ctx) => {
    // Step 1: 現在の branch をたどり、read した skill:// と skill-prompt の message の SKILL 名を集める
    const names = new Set();
    for (const entry of ctx.sessionManager.getBranch()) {
      // /clear より前の SKILL は context に無く、読み直すと user が捨てた指示を戻してしまう
      if (entry.type === "reset_boundary") {
        names.clear();
      }

      if (entry.type === "custom_message" && entry.customType === "skill-prompt") {
        names.add(entry.details.name);
      }

      if (entry.type !== "message" || entry.message.role !== "assistant") {
        continue;
      }

      for (const name of readSkillNames(entry.message)) {
        names.add(name);
      }
    }

    // Step 2: SKILL が無ければ何もしない
    if (names.size === 0) {
      return;
    }

    // Step 3: 集めた SKILL の再読を促す followUp を送る
    const urls = [...names].map((name) => `skill://${name}`).join(", ");
    pi.sendUserMessage(`compaction 前に読み込んだ SKILL を読み直してください: ${urls}`, {
      deliverAs: "followUp",
      attribution: "agent",
    });
  };

  pi.on("session_compact", (_event, ctx) => reread(ctx));
  pi.on("auto_compaction_end", (event, ctx) => {
    // Step 4: 自動 shake 以外と、中断・変更なし・失敗の完了通知を無視する
    if (
      event.action !== "shake" ||
      event.aborted !== false ||
      event.skipped !== false ||
      event.errorMessage !== undefined
    ) {
      return;
    }

    // Step 5: 成功した自動 shake の後も再読を促す
    reread(ctx);
  });
}
