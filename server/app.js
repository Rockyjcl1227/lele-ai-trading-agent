const express = require("express");
const path = require("node:path");
const market = require("./market");
const { proxyDeepSeek } = require("./deepseek");
const { getMockDb } = require("./mock-store");

function createApp({ fetchImpl = fetch, env = process.env } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));
  app.use(["/api/v1/market", "/api/v1/watchlist", "/api/v1/news"], (_req, res, next) => {
    res.set("Cache-Control", "public, s-maxage=20, stale-while-revalidate=120");
    next();
  });

  const ok = (res, result) => res.json({
    code: 0,
    data: result.data,
    meta: { source: result.source, degraded: Boolean(result.degraded), reason: result.reason }
  });

  app.get("/api/health", (_req, res) => {
    res.json({ code: 0, data: { status: "ok", deepseekConfigured: Boolean(env.DEEPSEEK_API_KEY) } });
  });

  app.get("/api/v1/market/stock/:symbol/overview", async (req, res) => {
    try {
      ok(res, await market.withFallback(
        () => market.fetchQuoteDetail(req.params.symbol, fetchImpl),
        () => market.fallbackQuote(req.params.symbol)
      ));
    } catch (error) {
      res.status(error.status || 500).json({ code: error.status || 500, data: null, message: error.message });
    }
  });

  async function marketSummary(_req, res) {
    const mock = getMockDb();
    const [indices, watchlist] = await Promise.all([
      market.withFallback(() => market.fetchIndices(fetchImpl), () => mock.indices),
      market.withFallback(() => market.fetchWatchlist(fetchImpl), () => mock.watchlist)
    ]);
    ok(res, {
      data: { indices: indices.data, watchlist: watchlist.data, rankings: watchlist.data, sectors: mock.sectors },
      source: indices.source === "eastmoney" && watchlist.source === "eastmoney" ? "eastmoney" : "hybrid",
      degraded: indices.degraded || watchlist.degraded,
      reason: [indices.reason, watchlist.reason].filter(Boolean).join("；")
    });
  }

  app.get("/api/v1/market/home", marketSummary);
  app.get("/api/v1/market/overview", marketSummary);
  app.get("/api/v1/watchlist", async (req, res) => {
    const mock = getMockDb();
    const result = await market.withFallback(() => market.fetchWatchlist(fetchImpl), () => mock.watchlist);
    const rows = result.data;
    if (req.query.sort === "rise") rows.sort((a, b) => b.pct - a.pct);
    if (req.query.sort === "fall") rows.sort((a, b) => a.pct - b.pct);
    res.json({ code: 0, data: rows, total: rows.length, meta: { source: result.source, degraded: Boolean(result.degraded), reason: result.reason } });
  });

  app.post("/api/v1/wencai/chat", async (req, res) => {
    const wantsStream = req.get("accept")?.includes("text/event-stream");
    try {
      if (!wantsStream) return res.json(await proxyDeepSeek(req.body, { fetchImpl, env }));
      res.status(200);
      res.set({ "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" });
      res.flushHeaders();
      const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      const result = await proxyDeepSeek(req.body, { fetchImpl, env, onDelta: (delta) => send("delta", { text: delta }) });
      send("done", result);
      res.end();
    } catch (error) {
      if (res.headersSent) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`);
        return res.end();
      }
      res.status(error.status || 500).json({ code: error.status || 500, data: null, message: error.message });
    }
  });

  app.get("/api/v1/news", (_req, res) => res.json({ code: 0, data: getMockDb().news, meta: { source: "mock" } }));
  app.get("/api/v1/account/portfolio", (_req, res) => res.json({ code: 0, data: getMockDb().portfolio, meta: { source: "mock" } }));

  app.use(express.static(path.join(__dirname, ".."), { extensions: ["html"] }));
  app.get("*splat", (_req, res) => res.sendFile(path.join(__dirname, "..", "index.html")));
  return app;
}

module.exports = { createApp };
