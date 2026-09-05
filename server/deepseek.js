const crypto = require("node:crypto");

const SYSTEM_PROMPT = `你是乐乐的 AI Trading Agent 中的问财助手。使用简洁、专业的中文回答。
行情数字只能引用用户上下文，不得自行编造。清晰区分事实、推断与风险；不承诺收益，不代替用户做交易决定。
若问题涉及个股，结合给定价格、分时和指标说明依据，并提醒内容不构成投资建议。`;

function normalizeRequest(body = {}) {
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) throw Object.assign(new Error("prompt 不能为空"), { status: 400 });
  if (prompt.length > 4000) throw Object.assign(new Error("prompt 最长 4000 字"), { status: 400 });
  const history = Array.isArray(body.history) ? body.history.slice(-12)
    .filter((item) => ["user", "assistant"].includes(item?.role) && typeof item.content === "string")
    .map((item) => ({ role: item.role, content: item.content.slice(0, 4000) })) : [];
  return {
    prompt,
    history,
    intent: typeof body.intent === "string" ? body.intent : "auto",
    context: body.context && typeof body.context === "object" ? body.context : {},
    conversationId: String(body.conversationId || crypto.randomUUID())
  };
}

function messagesFor(input) {
  const context = JSON.stringify(input.context).slice(0, 12000);
  return [
    { role: "system", content: SYSTEM_PROMPT },
    ...input.history,
    { role: "user", content: `意图：${input.intent}\n受控行情上下文：${context}\n\n用户问题：${input.prompt}` }
  ];
}

async function proxyDeepSeek(body, { fetchImpl = fetch, env = process.env, onDelta } = {}) {
  const input = normalizeRequest(body);
  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) return {
    code: 0,
    data: { source: "mock", intent: input.intent, text: "", requestId: crypto.randomUUID(), degraded: true, reason: "DEEPSEEK_API_KEY 未配置" }
  };
  const response = await fetchImpl(`${(env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.DEEPSEEK_MODEL || "deepseek-chat",
      messages: messagesFor(input),
      stream: Boolean(onDelta),
      temperature: 0.3,
      max_tokens: 1200
    })
  });
  if (!response.ok) throw Object.assign(new Error(`DeepSeek 上游返回 ${response.status}`), { status: 502 });

  const requestId = response.headers.get("x-request-id") || crypto.randomUUID();
  if (!onDelta) {
    const json = await response.json();
    return { code: 0, data: { source: "deepseek", intent: input.intent, text: json?.choices?.[0]?.message?.content || "", requestId } };
  }

  if (!response.body) throw Object.assign(new Error("DeepSeek 未返回流"), { status: 502 });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content || "";
        if (delta) {
          text += delta;
          onDelta(delta);
        }
      } catch (_) {
        // 忽略上游非 JSON 心跳行。
      }
    }
    if (done) break;
  }
  return { code: 0, data: { source: "deepseek", intent: input.intent, text, requestId } };
}

module.exports = { normalizeRequest, proxyDeepSeek };
