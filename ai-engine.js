(function () {
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const round = (value, digits = 0) => Number(value.toFixed(digits));

  function ema(values, period) {
    const factor = 2 / (period + 1);
    return values.reduce((rows, value, index) => {
      rows.push(index ? value * factor + rows[index - 1] * (1 - factor) : value);
      return rows;
    }, []);
  }

  function calculateIndicators(kline, timeline) {
    const closes = kline.map((item) => item.c);
    const ema12 = ema(closes, 12), ema26 = ema(closes, 26);
    const dif = closes.map((_, index) => ema12[index] - ema26[index]);
    const dea = ema(dif, 9), macd = (dif.at(-1) - dea.at(-1)) * 2;
    let gains = 0, losses = 0;
    closes.slice(-7).forEach((close, index, rows) => {
      if (!index) return;
      const change = close - rows[index - 1];
      change >= 0 ? gains += change : losses -= change;
    });
    const rsi = losses === 0 ? 78 : 100 - 100 / (1 + gains / losses);
    let k = 50, d = 50;
    kline.forEach((item, index) => {
      const window = kline.slice(Math.max(0, index - 8), index + 1);
      const high = Math.max(...window.map((row) => row.h));
      const low = Math.min(...window.map((row) => row.l));
      const rsv = high === low ? 50 : (item.c - low) / (high - low) * 100;
      k = k * 2 / 3 + rsv / 3;
      d = d * 2 / 3 + k / 3;
    });
    const recentVolume = timeline.slice(-2).reduce((sum, item) => sum + item.volume, 0) / 2;
    const averageVolume = timeline.reduce((sum, item) => sum + item.volume, 0) / timeline.length;
    return {
      macd: { dif: round(dif.at(-1), 3), dea: round(dea.at(-1), 3), bar: round(macd, 3), signal: macd >= 0 ? "多头" : "空头" },
      kdj: { k: round(k, 1), d: round(d, 1), j: round(3 * k - 2 * d, 1) },
      rsi: round(clamp(rsi, 0, 100), 1),
      volRatio: round(recentVolume / averageVolume, 2)
    };
  }

  function analyze({ quote, holding = null, anchor = null }) {
    const { stock, timeline } = quote;
    const points = anchor ? timeline.slice(0, Math.max(2, anchor.index + 1)) : timeline;
    const point = anchor || { ...points.at(-1), index: points.length - 1 };
    const first = points[0];
    const previous = points[Math.max(0, points.length - 4)];
    const averageVolume = points.reduce((sum, item) => sum + item.volume, 0) / points.length;
    const volumeRatio = point.volume / averageVolume;
    const intradayPct = (point.price / stock.prevClose - 1) * 100;
    const slopePct = (point.price / previous.price - 1) * 100;
    const aboveAveragePct = (point.price / point.average - 1) * 100;
    const indicators = calculateIndicators(quote.kline, timeline);
    const sectorBase = {
      "AI芯片": 9, "算力服务器": 8, "光模块": 9, "CPO概念": 8,
      "稀土永磁": 5, "有色金属": 4, "固态电池": 6, "新能源汽车": 4,
      "PCB": 8, "白酒龙头": 2, "存储芯片": 6, "互联网券商": 3,
      "储能": 5
    };

    const trend = round(clamp(intradayPct * 4.2 + slopePct * 3 + aboveAveragePct * 4, -20, 20));
    const volumePrice = round(clamp((volumeRatio - 1) * 10 + Math.sign(slopePct) * Math.min(5, Math.abs(slopePct) * 2), -12, 12));
    const sector = clamp(sectorBase[stock.reason] || 3, -10, 10);
    const estimatedRsi = indicators.rsi;
    const technicalRaw = trend * .55 + (aboveAveragePct >= 0 ? 5 : -5) - (estimatedRsi > 74 ? 8 : 0) + (estimatedRsi < 30 ? 6 : 0);
    const technical = round(clamp(technicalRaw, -15, 15));
    const capital = round(clamp((stock.turnover - 2) * 1.8 + Math.sign(intradayPct) * Math.min(5, Math.abs(intradayPct)), -8, 8));
    const score = round(clamp(50 + trend + volumePrice + sector + technical + capital, 18, 88));
    const conflicts = [];
    if (score >= 58 && estimatedRsi > 72) conflicts.push("趋势偏强，但 RSI 进入偏高区，追高性价比下降");
    if (trend > 5 && volumePrice < 0) conflicts.push("价格走强但量能未确认，突破有效性仍需观察");
    if (trend < -5 && sector > 4) conflicts.push("板块表现较强，但个股当前明显弱于板块");
    if (!conflicts.length) conflicts.push(score >= 55 ? "趋势、量价与板块方向基本一致" : "多空信号接近，暂未形成强共振");

    const direction = score >= 68 ? "偏多" : score >= 56 ? "震荡偏多" : score <= 32 ? "偏空" : score <= 44 ? "震荡偏空" : "中性";
    const shortDirection = clamp(score + Math.round(slopePct * 2), 18, 88);
    const midDirection = clamp(Math.round(score * .78 + 11), 22, 82);
    const support = round(Math.max(stock.low, point.average * .994), 2);
    const pressure = round(Math.max(stock.high, point.price * 1.012), 2);
    const stop = round(support * .985, 2);
    const breakout = round(pressure * 1.002, 2);
    const held = Boolean(holding);

    let action;
    let actionLabel;
    if (held) {
      if (score >= 68) { action = `继续持有；回踩 ${support.toFixed(2)} 附近企稳，可考虑小幅加仓。`; actionLabel = "加仓"; }
      else if (score >= 48) { action = `继续观察；有效跌破 ${support.toFixed(2)}，建议降低仓位。`; actionLabel = "减仓"; }
      else { action = `趋势转弱；跌破 ${support.toFixed(2)} 后优先减仓，${stop.toFixed(2)} 为止损参考。`; actionLabel = "去卖出"; }
    } else {
      if (score >= 72 && estimatedRsi < 74) { action = `可关注 ${support.toFixed(2)}–${round(support * 1.006, 2).toFixed(2)} 回踩区间，确认承接后再尝试介入。`; actionLabel = "去买入"; }
      else if (score >= 56) { action = `当前位置不建议追高；等待回踩 ${support.toFixed(2)} 附近或放量突破 ${breakout.toFixed(2)}。`; actionLabel = "关注买点"; }
      else { action = `暂不介入，等待重新站上均价线并出现量价共振。`; actionLabel = "暂不介入"; }
    }

    const context = anchor
      ? `${anchor.time || "所选时点"}前，股价${aboveAveragePct >= 0 ? "运行在均价线上方" : "跌至均价线下方"}，局部涨跌 ${slopePct >= 0 ? "+" : ""}${slopePct.toFixed(2)}%，量比约 ${volumeRatio.toFixed(2)}。`
      : `当前价 ${stock.price.toFixed(2)} 元，日内 ${stock.changePct >= 0 ? "+" : ""}${stock.changePct.toFixed(2)}%；股价${aboveAveragePct >= 0 ? "位于均价线上方" : "位于均价线下方"}，量比约 ${volumeRatio.toFixed(2)}。`;

    return {
      mode: anchor ? "时点研判" : "当前研判",
      score,
      direction,
      horizons: [
        { label: "日内", value: direction, score },
        { label: "短线 1–5日", value: shortDirection >= 58 ? "偏多" : shortDirection <= 42 ? "偏空" : "震荡", score: shortDirection },
        { label: "中期 1–4周", value: midDirection >= 58 ? "偏多" : midDirection <= 42 ? "偏空" : "震荡", score: midDirection }
      ],
      factors: [
        { key: "趋势", value: trend, max: 20 },
        { key: "量价", value: volumePrice, max: 12 },
        { key: "板块", value: sector, max: 10 },
        { key: "技术", value: technical, max: 15 },
        { key: "资金", value: capital, max: 8 }
      ],
      metrics: { estimatedRsi, volumeRatio: round(volumeRatio, 2), aboveAveragePct: round(aboveAveragePct, 2) },
      indicators,
      context,
      conflict: conflicts[0],
      action,
      actionLabel,
      held,
      holding,
      levels: { support, pressure, stop, breakout },
      scenarios: [
        { key: "强势延续", label: `放量站上 ${breakout.toFixed(2)}`, path: [0, 1, 2, 4, 6], tone: "up" },
        { key: "横盘消化", label: `围绕 ${point.average.toFixed(2)} 震荡`, path: [0, .4, -.2, .5, .2], tone: "flat" },
        { key: "转弱回踩", label: `跌破 ${support.toFixed(2)}`, path: [0, -.6, -1.5, -2.1, -3], tone: "down" }
      ],
      disclaimer: "AI 多空评分用于表达当前信号强弱，不代表未来上涨概率，不构成投资建议。"
    };
  }

  window.AIEngine = { analyze };
})();
