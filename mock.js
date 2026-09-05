window.MOCK_DB = {
  stock: {
    symbol: "600519", market: "SH", name: "贵州茅台", price: 1330.00,
    change: 31.14, changePct: 2.40, high: 1338.86, low: 1295.60,
    open: 1295.88, prevClose: 1298.86, turnover: 0.25,
    volume: "3.16万", amount: "41.90亿", amplitude: "3.33%",
    pe: 19.95, marketCap: "1.67万亿"
  },
  timeline: [
    { time: "09:30", price: 1295.88, average: 1295.88, volume: 620 },
    { time: "09:45", price: 1304.20, average: 1300.42, volume: 418 },
    { time: "10:00", price: 1312.65, average: 1304.31, volume: 536 },
    { time: "10:15", price: 1308.40, average: 1305.76, volume: 315 },
    { time: "10:30", price: 1322.18, average: 1309.84, volume: 586 },
    { time: "10:45", price: 1334.72, average: 1314.32, volume: 498 },
    { time: "11:00", price: 1328.46, average: 1316.66, volume: 337 },
    { time: "11:30", price: 1331.20, average: 1318.01, volume: 318 },
    { time: "13:00", price: 1326.90, average: 1318.58, volume: 382 },
    { time: "13:30", price: 1319.80, average: 1318.95, volume: 492 },
    { time: "14:00", price: 1325.26, average: 1319.62, volume: 435 },
    { time: "14:30", price: 1336.72, average: 1321.48, volume: 591 },
    { time: "15:00", price: 1330.00, average: 1322.72, volume: 438 }
  ],
  kline: [
    { d: "08/24", o: 1272, c: 1284, h: 1289, l: 1268, v: 34 },
    { d: "08/25", o: 1283, c: 1276, h: 1291, l: 1269, v: 28 },
    { d: "08/26", o: 1275, c: 1294, h: 1301, l: 1272, v: 45 },
    { d: "08/27", o: 1296, c: 1288, h: 1305, l: 1280, v: 31 },
    { d: "08/28", o: 1287, c: 1302, h: 1310, l: 1284, v: 52 },
    { d: "08/31", o: 1301, c: 1296, h: 1308, l: 1290, v: 29 },
    { d: "09/01", o: 1295, c: 1300, h: 1306, l: 1289, v: 36 },
    { d: "09/02", o: 1301, c: 1297.50, h: 1308, l: 1291, v: 32 },
    { d: "09/03", o: 1296, c: 1298.86, h: 1304, l: 1290, v: 30 },
    { d: "09/04", o: 1295.88, c: 1330, h: 1338.86, l: 1295.60, v: 63 }
  ],
  orderBook: [
    { side: "卖", level: 5, price: 1331.10, volume: 31 }, { side: "卖", level: 4, price: 1330.88, volume: 18 },
    { side: "卖", level: 3, price: 1330.75, volume: 42 }, { side: "卖", level: 2, price: 1330.60, volume: 27 },
    { side: "卖", level: 1, price: 1330.28, volume: 16 }, { side: "买", level: 1, price: 1330.00, volume: 39 },
    { side: "买", level: 2, price: 1329.88, volume: 25 }, { side: "买", level: 3, price: 1329.60, volume: 51 },
    { side: "买", level: 4, price: 1329.42, volume: 32 }, { side: "买", level: 5, price: 1329.26, volume: 47 }
  ],
  trades: [
    { time: "14:56:52", price: 1330.00, volume: 8, direction: "buy" },
    { time: "14:56:47", price: 1329.88, volume: 3, direction: "sell" },
    { time: "14:56:39", price: 1330.20, volume: 12, direction: "buy" },
    { time: "14:56:31", price: 1329.78, volume: 5, direction: "sell" },
    { time: "14:56:22", price: 1330.08, volume: 6, direction: "buy" }
  ],
  indices: [
    { name: "上证指数", value: "3,812.51", pct: 0.74 },
    { name: "深证成指", value: "12,538.42", pct: 1.12 },
    { name: "创业板指", value: "2,876.39", pct: -0.28 }
  ],
  watchlist: [
    { symbol: "600519", market: "SH", name: "贵州茅台", price: 1330.00, pct: 2.40, reason: "白酒龙头", amount: "41.90亿" },
    { symbol: "688256", market: "SH", name: "寒武纪-U", price: 1284.60, pct: 8.72, reason: "AI芯片", amount: "126.38亿" },
    { symbol: "601138", market: "SH", name: "工业富联", price: 58.16, pct: 6.35, reason: "算力服务器", amount: "188.42亿" },
    { symbol: "300502", market: "SZ", name: "新易盛", price: 286.40, pct: 7.18, reason: "光模块", amount: "143.76亿" },
    { symbol: "300308", market: "SZ", name: "中际旭创", price: 358.72, pct: 5.46, reason: "CPO概念", amount: "132.55亿" },
    { symbol: "600111", market: "SH", name: "北方稀土", price: 46.38, pct: 4.92, reason: "稀土永磁", amount: "96.30亿" },
    { symbol: "601899", market: "SH", name: "紫金矿业", price: 29.74, pct: 3.81, reason: "有色金属", amount: "82.61亿" },
    { symbol: "300750", market: "SZ", name: "宁德时代", price: 324.68, pct: 2.85, reason: "固态电池", amount: "78.44亿" },
    { symbol: "002594", market: "SZ", name: "比亚迪", price: 318.40, pct: 3.42, reason: "新能源汽车", amount: "73.29亿" },
    { symbol: "603986", market: "SH", name: "兆易创新", price: 186.52, pct: -1.26, reason: "存储芯片", amount: "62.18亿" },
    { symbol: "300476", market: "SZ", name: "胜宏科技", price: 168.90, pct: 9.36, reason: "PCB", amount: "118.07亿" },
    { symbol: "300059", market: "SZ", name: "东方财富", price: 28.64, pct: -0.58, reason: "互联网券商", amount: "105.84亿" }
    ,{ symbol: "300693", market: "SZ", name: "盛弘股份", price: 40.13, pct: -2.36, reason: "储能", amount: "4.10亿", open: 41.50, high: 41.80, low: 39.90, volume: "10.10万", turnover: 3.76 }
  ],
  sectors: [
    { name: "固态电池", pct: 5.82, leader: "德福科技" },
    { name: "白酒", pct: 3.46, leader: "舍得酒业" },
    { name: "人形机器人", pct: 2.91, leader: "绿的谐波" },
    { name: "银行", pct: -0.52, leader: "成都银行" }
  ],
  news: [
    { id: 1, time: "11:26", tag: "公司", title: "贵州茅台：将持续推进渠道体系市场化改革", source: "乐乐财经" },
    { id: 2, time: "11:18", tag: "研报", title: "食品饮料行业周报：中秋旺季临近，关注动销改善", source: "国泰海通" },
    { id: 3, time: "11:06", tag: "市场", title: "沪指午盘涨0.62%，消费板块表现活跃", source: "财联社" },
    { id: 4, time: "10:05", tag: "公告", title: "贵州茅台发布生产经营情况说明", source: "交易所公告" },
    { id: 5, time: "09:24", tag: "快讯", title: "北向资金早盘净流入超20亿元", source: "乐乐快讯" }
  ],
  holdings: {
    "600519": { cost: 1288.50, shares: 100, positionPct: 31, profitPct: 3.22 },
    "300750": { cost: 309.26, shares: 200, positionPct: 24, profitPct: 4.99 }
  },
  portfolio: {
    totalAsset: "268,430.52", dailyProfit: "+3,286.40", available: "56,218.32",
    positions: [
      { name: "贵州茅台", shares: 100, cost: 1288.50, price: 1330.00, profit: 4150.00 },
      { name: "宁德时代", shares: 200, cost: 309.26, price: 324.68, profit: 3084.00 }
    ]
  }
};
