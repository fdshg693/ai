import { useState } from "react";
import { REQUEST_TIMEOUT_MS, apiErrorMessage, skillHref } from "../../lib/ai-suggest.mjs";

type Skill = {
  path: string;
  name: string;
  description: string;
  tool: string;
  plugin: string;
};

type Suggestion = {
  skill: Skill;
  reason: string;
};

type AISuggestProps = {
  basePath?: string;
  apiHref?: string;
};

export default function AISuggest({ basePath = "", apiHref = "/api/suggest" }: AISuggestProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setStatus("質問を入力してください。");
      return;
    }

    setSubmitting(true);
    setStatus("AIに問い合わせ中...");
    setSuggestions([]);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(apiHref, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmedQuery }),
        signal: controller.signal,
      });

      let payload: { suggestions?: Suggestion[]; error?: string } = {};
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }

      if (!response.ok) {
        setStatus(apiErrorMessage(payload.error, response.status));
        return;
      }

      const matched = Array.isArray(payload.suggestions) ? payload.suggestions : [];
      if (matched.length === 0) {
        setStatus("関連するスキルは見つかりませんでした。");
        return;
      }

      setSuggestions(matched);
      setStatus(`${matched.length}件のスキルを提案しました。`);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setStatus("リクエストがタイムアウトしました。");
      } else {
        setStatus("エラーが発生しました。ネットワーク接続を確認してください。");
      }
    } finally {
      clearTimeout(timeout);
      setSubmitting(false);
    }
  };

  return (
    <details className="ai-suggest-panel">
      <summary className="ai-suggest-summary">
        <p className="eyebrow">AI SUGGEST</p>
        <h2>AIにスキルを提案してもらう</h2>
      </summary>
      <div className="ai-suggest-body">
        <p className="ai-suggest-disclosure">
          質問だけ入力してください。APIキーの入力は不要です（サーバー側で処理します）。
        </p>
        <label className="ai-suggest-query-label">
          <span>やりたいことを入力してください</span>
          <textarea
            data-ai-query
            rows={3}
            placeholder="例: テストを書くときに使えるスキルは？"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="ai-suggest-actions">
          <button
            type="button"
            className="button button-primary"
            data-ai-submit
            disabled={submitting}
            onClick={handleSubmit}
          >
            AIに提案してもらう
          </button>
        </div>
        <p className="ai-suggest-status" data-ai-status aria-live="polite">
          {status}
        </p>
        <ul className="ai-suggest-results" data-ai-results>
          {suggestions.map(({ skill, reason }) => (
            <li key={skill.path}>
              <a href={skillHref(skill.path, basePath)}>
                {skill.name}（{skill.tool} / {skill.plugin}）
              </a>
              {reason ? <p>{reason}</p> : null}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
