/**
 * 圧縮後に router の復旧を促す extension を登録する。
 * 1. session 名が superagent でなければ何もしない
 * 2. SKILL の再読と list を促す followUp を送る
 * 3. 自動 shake 以外と、中断・変更なし・失敗の完了通知を無視する
 * 4. 成功した自動 shake の後も復旧を促す
 */
export default function compactReread(pi) {
  const recover = () => {
    // Step 1: session 名が superagent でなければ何もしない
    if (pi.getSessionName() !== "superagent") {
      return;
    }

    // Step 2: SKILL の再読と list を促す followUp を送る
    pi.sendUserMessage("skill://kstack-super-agent を読み直し、list で状態を確認してください。", {
      deliverAs: "followUp",
      attribution: "agent",
    });
  };

  pi.on("session_compact", recover);
  pi.on("auto_compaction_end", (event) => {
    // Step 3: 自動 shake 以外と、中断・変更なし・失敗の完了通知を無視する
    if (
      event.action !== "shake" ||
      event.aborted !== false ||
      event.skipped !== false ||
      event.errorMessage !== undefined
    ) {
      return;
    }

    // Step 4: 成功した自動 shake の後も復旧を促す
    recover();
  });
}
