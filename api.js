(function () {
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const apiBase = () => (window.WENCAI_API_BASE || "").replace(/\/$/, "");

  async function request(path, options) {
    const response = await fetch(`${apiBase()}${path}`, options);
    if (!response.ok) throw new Error(`服务暂时不可用（${response.status}）`);
    const payload = await response.json();
    if (payload.code !== 0) throw new Error(payload.message || "服务返回异常");
    return payload;
  }

  async function fallback(loader) {
    try {
      return await loader();
    } catch (error) {
      console.warn("[StockAPI] BFF 不可用，已降级为本地模拟数据：", error.message);
      return null;
    }
  }

  function localQuote(symbol) {
    const snapshot = MOCK_DB.watchlist.find((item) => item.symbol === symbol) || MOCK_DB.watchlist[0];
    const ratio = snapshot.price / MOCK_DB.stock.price;
    const stock = {
      ...MOCK_DB.stock, ...snapshot,
      changePct: snapshot.pct,
      change: snapshot.price * snapshot.pct / (100 + snapshot.pct),
      prevClose: snapshot.price / (1 + snapshot.pct / 100),
      high: snapshot.high || MOCK_DB.stock.high * ratio,
      low: snapshot.low || MOCK_DB.stock.low * ratio,
      open: snapshot.open || MOCK_DB.stock.open * ratio
    };
    return {
      stock,
      timeline: MOCK_DB.timeline
        .filter((row) => row.time >= "09:30" && row.time <= "11:30")
        .map((row) => ({ ...row, price: row.price * ratio, average: row.average * ratio })),
      kline: MOCK_DB.kline.map((row) => ({ ...row, o: row.o * ratio, c: row.c * ratio, h: row.h * ratio, l: row.l * ratio })),
      orderBook: MOCK_DB.orderBook.map((row) => ({ ...row, price: row.price * ratio })),
      trades: MOCK_DB.trades.map((row, index) => ({
        ...row,
        time: `11:29:${String(52 - index * 7).padStart(2, "0")}`,
        price: row.price * ratio
      }))
    };
  }

  async function readSSE(response, onDelta) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let result = null;
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() || "";
      frames.forEach((frame) => {
        const event = frame.match(/^event:\s*(.+)$/m)?.[1];
        const raw = frame.match(/^data:\s*(.+)$/m)?.[1];
        if (!raw) return;
        const data = JSON.parse(raw);
        if (event === "delta") onDelta?.(data.text || "");
        if (event === "done") result = data;
        if (event === "error") throw new Error(data.message || "问财生成失败");
      });
      if (done) break;
    }
    return result || { code: -1, data: null, message: "问财流异常结束" };
  }

  window.StockAPI = {
    getLocalQuote(symbol) {
      return clone(localQuote(symbol));
    },

    async fetchQuoteDetail(symbol) {
      return await fallback(() => request(`/api/v1/market/stock/${encodeURIComponent(symbol)}/overview`))
        || { code: 0, data: clone(localQuote(symbol)), meta: { source: "mock", degraded: true } };
    },

    async fetchMarketHome() {
      return await fallback(() => request("/api/v1/market/home"))
        || { code: 0, data: clone({ indices: MOCK_DB.indices, watchlist: MOCK_DB.watchlist, sectors: MOCK_DB.sectors }), meta: { source: "mock", degraded: true } };
    },

    async fetchWatchlist({ sort = "default" } = {}) {
      const remote = await fallback(() => request(`/api/v1/watchlist?sort=${encodeURIComponent(sort)}`));
      if (remote) return remote;
      const rows = clone(MOCK_DB.watchlist);
      if (sort === "rise") rows.sort((a, b) => b.pct - a.pct);
      if (sort === "fall") rows.sort((a, b) => a.pct - b.pct);
      return { code: 0, data: rows, total: rows.length, meta: { source: "mock", degraded: true } };
    },

    async fetchMarketOverview() {
      return await fallback(() => request("/api/v1/market/overview"))
        || { code: 0, data: clone({ indices: MOCK_DB.indices, sectors: MOCK_DB.sectors, rankings: MOCK_DB.watchlist }), meta: { source: "mock", degraded: true } };
    },

    async fetchNews({ tab = "要闻" } = {}) {
      const remote = await fallback(() => request(`/api/v1/news?tab=${encodeURIComponent(tab)}`));
      if (remote) return remote;
      const data = clone(MOCK_DB.news).map((item) => tab === "研报" && item.tag !== "研报" ? { ...item, tag: "研报" } : item);
      return { code: 0, data, total: data.length };
    },

    async askWencai({ conversationId, symbol, prompt, history = [], context = {}, intent = "auto", onDelta, signal }) {
      const response = await fetch(`${apiBase()}/api/v1/wencai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        signal,
        body: JSON.stringify({ conversationId, symbol, prompt, history, context, intent })
      });
      if (!response.ok) throw new Error(`问财服务暂时不可用（${response.status}）`);
      return readSSE(response, onDelta);
    },

    async fetchPortfolio() {
      return await fallback(() => request("/api/v1/account/portfolio"))
        || { code: 0, data: clone(MOCK_DB.portfolio), meta: { source: "mock", degraded: true } };
    },

    // TODO: replace with POST /api/v1/account/login
    async login({ account, password }) {
      await delay(600);
      if (account === "18888888888" && password === "123456") {
        return { code: 0, data: { displayName: "模拟投资者" } };
      }
      return { code: 401, data: null, message: "账号或密码不正确" };
    }
  };
})();
