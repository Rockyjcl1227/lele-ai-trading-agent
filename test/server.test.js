const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../server/app");
const { normalizeRequest, proxyDeepSeek } = require("../server/deepseek");
const { fetchWatchlist } = require("../server/market");

function start(options) {
  return new Promise((resolve) => {
    const server = createApp(options).listen(0, "127.0.0.1", () => {
      resolve({ server, base: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

test("健康检查不泄露 Key，只返回配置状态", async (t) => {
  const { server, base } = await start({ env: { DEEPSEEK_API_KEY: "" } });
  t.after(() => server.close());
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, { status: "ok", deepseekConfigured: false });
});

test("上游行情失败时自动返回 mock 并标记 degraded", async (t) => {
  const failedFetch = async () => { throw new Error("network down"); };
  const { server, base } = await start({ fetchImpl: failedFetch, env: {} });
  t.after(() => server.close());
  const response = await fetch(`${base}/api/v1/market/stock/600519/overview`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.code, 0);
  assert.equal(body.data.stock.symbol, "600519");
  assert.equal(body.meta.source, "mock");
  assert.equal(body.meta.degraded, true);
  assert.equal(body.data.timeline.at(-1).time, "11:30");
  assert.ok(body.data.trades.every((trade) => trade.time <= "11:30:00"));
});

test("未配置 DeepSeek Key 时 SSE 正常完成 mock 降级", async (t) => {
  const { server, base } = await start({ env: { DEEPSEEK_API_KEY: "" } });
  t.after(() => server.close());
  const response = await fetch(`${base}/api/v1/wencai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ conversationId: "test", prompt: "分析贵州茅台", intent: "analysis" })
  });
  const text = await response.text();
  assert.match(response.headers.get("content-type"), /text\/event-stream/);
  assert.match(text, /event: done/);
  assert.match(text, /"source":"mock"/);
});

test("DeepSeek 请求校验 prompt 和历史消息", async () => {
  assert.throws(() => normalizeRequest({ prompt: "  " }), /prompt 不能为空/);
  const result = await proxyDeepSeek({ prompt: "你好", history: [{ role: "system", content: "bad" }] }, { env: {} });
  assert.equal(result.data.source, "mock");
  assert.equal(result.data.degraded, true);
});

test("真实行情列表保留 fltt=2 返回的价格与涨跌幅精度", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    data: { diff: [{ f2: 1500.25, f3: 1.86, f6: 120000000, f12: "600519", f14: "贵州茅台" }] }
  }), { status: 200, headers: { "Content-Type": "application/json" } });
  const rows = await fetchWatchlist(fetchImpl);
  assert.equal(rows[0].price, 1500.25);
  assert.equal(rows[0].pct, 1.86);
});
