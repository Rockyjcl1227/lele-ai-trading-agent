const { getMockDb } = require("./mock-store");

const EASTMONEY = "https://push2.eastmoney.com/api";
const WATCH_SYMBOLS = ["600519", "688256", "601138", "300502", "300308", "600111", "601899", "300750", "002594", "603986", "300476", "300059", "300693"];
const INDEX_SECIDS = ["1.000001", "0.399001", "0.399006"];

const marketOf = (symbol) => String(symbol).startsWith("6") ? "SH" : "SZ";
const secidOf = (symbol) => `${marketOf(symbol) === "SH" ? 1 : 0}.${symbol}`;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const scaled = (value, divisor = 100, fallback = 0) => finite(value, fallback * divisor) / divisor;
const formatAmount = (value) => {
  const number = finite(value);
  if (number >= 1e12) return `${(number / 1e12).toFixed(2)}万亿`;
  if (number >= 1e8) return `${(number / 1e8).toFixed(2)}亿`;
  if (number >= 1e4) return `${(number / 1e4).toFixed(2)}万`;
  return String(Math.round(number));
};

async function getJson(url, fetchImpl = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://quote.eastmoney.com/" }
    });
    if (!response.ok) throw new Error(`上游行情 HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function reasonFor(symbol) {
  return getMockDb().watchlist.find((item) => item.symbol === symbol)?.reason || "A股";
}

function mapSnapshot(row) {
  return {
    symbol: String(row.f12),
    market: marketOf(row.f12),
    name: row.f14 || String(row.f12),
    // ulist 使用 fltt=2，价格和涨跌幅已经是可直接展示的小数。
    price: finite(row.f2),
    pct: finite(row.f3),
    reason: reasonFor(String(row.f12)),
    amount: formatAmount(row.f6)
  };
}

async function fetchSnapshots(secids, fetchImpl) {
  const fields = "f2,f3,f6,f12,f14";
  const url = `${EASTMONEY}/qt/ulist.np/get?fltt=2&invt=2&fields=${fields}&secids=${secids.join(",")}`;
  const json = await getJson(url, fetchImpl);
  const rows = json?.data?.diff;
  if (!Array.isArray(rows) || !rows.length) throw new Error("上游行情无数据");
  return rows;
}

async function fetchIndices(fetchImpl) {
  const rows = await fetchSnapshots(INDEX_SECIDS, fetchImpl);
  return rows.map((row) => ({
    name: row.f14,
    value: finite(row.f2).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    pct: finite(row.f3)
  }));
}

async function fetchWatchlist(fetchImpl) {
  const rows = await fetchSnapshots(WATCH_SYMBOLS.map(secidOf), fetchImpl);
  return rows.map(mapSnapshot);
}

function synthesizeMicrostructure(stock, timeline, mock) {
  const orderBook = Array.from({ length: 10 }, (_, index) => {
    const sell = index < 5;
    const level = sell ? 5 - index : index - 4;
    const direction = sell ? 1 : -1;
    return {
      side: sell ? "卖" : "买",
      level,
      price: stock.price + direction * level * Math.max(.01, stock.price * .00012),
      volume: 15 + ((Number(stock.symbol.slice(-2)) + index * 17) % 70)
    };
  });
  const trades = timeline.slice(-5).reverse().map((point, index) => ({
    time: `${point.time}:${String(52 - index * 7).padStart(2, "0")}`,
    price: point.price,
    volume: Math.max(1, Math.round(point.volume / 100)),
    direction: index % 2 ? "sell" : "buy"
  }));
  return {
    orderBook: orderBook.length ? orderBook : mock.orderBook,
    trades: trades.length ? trades : mock.trades
  };
}

async function fetchQuoteDetail(symbol, fetchImpl) {
  if (!/^(?:[036]\d{5}|68\d{4})$/.test(symbol)) throw Object.assign(new Error("证券代码格式不正确"), { status: 400 });
  const secid = secidOf(symbol);
  const quoteFields = "f57,f58,f43,f44,f45,f46,f47,f48,f60,f116,f162,f168,f169,f170";
  const quoteUrl = `${EASTMONEY}/qt/stock/get?invt=2&fltt=1&secid=${secid}&fields=${quoteFields}`;
  const trendsUrl = `${EASTMONEY}/qt/stock/trends2/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58&ndays=1&iscr=0`;
  const klineUrl = `${EASTMONEY}/qt/stock/kline/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56&klt=101&fqt=1&lmt=60`;
  const [quoteJson, trendsJson, klineJson] = await Promise.all([
    getJson(quoteUrl, fetchImpl), getJson(trendsUrl, fetchImpl), getJson(klineUrl, fetchImpl)
  ]);
  const q = quoteJson?.data;
  if (!q || q.f43 === "-") throw new Error("未获取到证券行情");
  const stock = {
    symbol, market: marketOf(symbol), name: q.f58 || symbol,
    price: scaled(q.f43), change: scaled(q.f169), changePct: scaled(q.f170),
    high: scaled(q.f44), low: scaled(q.f45), open: scaled(q.f46), prevClose: scaled(q.f60),
    turnover: scaled(q.f168), volume: `${(finite(q.f47) / 10000).toFixed(2)}万`,
    amount: formatAmount(q.f48), amplitude: `${((finite(q.f44) - finite(q.f45)) / Math.max(1, finite(q.f60)) * 100).toFixed(2)}%`,
    pe: scaled(q.f162), marketCap: formatAmount(q.f116), reason: reasonFor(symbol)
  };
  const timeline = (trendsJson?.data?.trends || []).map((line) => {
    const [dateTime, price, average, volume] = line.split(",");
    return { time: dateTime.slice(-5), price: finite(price), average: finite(average), volume: finite(volume) };
  }).filter((row) => row.price > 0 && row.time >= "09:30" && row.time <= "11:30");
  const kline = (klineJson?.data?.klines || []).map((line) => {
    const [date, open, close, high, low, volume] = line.split(",");
    return { d: date.slice(5).replace("-", "/"), o: finite(open), c: finite(close), h: finite(high), l: finite(low), v: finite(volume) };
  });
  if (!timeline.length || !kline.length) throw new Error("行情序列不完整");
  const mock = getMockDb();
  return { stock, timeline, kline, ...synthesizeMicrostructure(stock, timeline, mock) };
}

function fallbackQuote(symbol) {
  const mock = getMockDb();
  const snapshot = mock.watchlist.find((item) => item.symbol === symbol) || mock.watchlist[0];
  const ratio = snapshot.price / mock.stock.price;
  const stock = {
    ...mock.stock, ...snapshot,
    changePct: snapshot.pct,
    change: snapshot.price * snapshot.pct / (100 + snapshot.pct),
    prevClose: snapshot.price / (1 + snapshot.pct / 100),
    high: snapshot.high || mock.stock.high * ratio,
    low: snapshot.low || mock.stock.low * ratio,
    open: snapshot.open || mock.stock.open * ratio
  };
  return {
    stock,
    timeline: mock.timeline
      .filter((row) => row.time >= "09:30" && row.time <= "11:30")
      .map((row) => ({ ...row, price: row.price * ratio, average: row.average * ratio })),
    kline: mock.kline.map((row) => ({ ...row, o: row.o * ratio, c: row.c * ratio, h: row.h * ratio, l: row.l * ratio })),
    orderBook: mock.orderBook.map((row) => ({ ...row, price: row.price * ratio })),
    trades: mock.trades.map((row, index) => ({
      ...row,
      time: `11:29:${String(52 - index * 7).padStart(2, "0")}`,
      price: row.price * ratio
    }))
  };
}

async function withFallback(realLoader, fallbackLoader) {
  try {
    return { data: await realLoader(), source: "eastmoney" };
  } catch (error) {
    return { data: fallbackLoader(), source: "mock", degraded: true, reason: error.message };
  }
}

module.exports = { fetchIndices, fetchWatchlist, fetchQuoteDetail, fallbackQuote, withFallback };
