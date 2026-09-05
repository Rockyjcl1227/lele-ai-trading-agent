(function () {
  const app = document.getElementById("app-content");
  const modalRoot = document.getElementById("modal-root");
  const toastRoot = document.getElementById("toast-root");
  const viewport = document.querySelector(".app-viewport");

  Object.assign(AppState, {
    activeNav: "market",
    view: "quote",
    chartTab: "分时",
    detailTab: "盘口",
    quotePanel: "五档",
    indicator: "MACD",
    searchQuery: "",
    watchSort: "default",
    watchlisted: true,
    selectedSymbol: "600519",
    darkMarket: false,
    newsTab: "要闻",
    chartZoom: 1,
    chartOffset: 0,
    aiReady: false,
    aiAnchor: null,
    aiContextAnchor: null,
    holdingOverride: null,
    wencaiMessages: [],
    wencaiThinking: false,
    wencaiThinkingType: "analysis",
    wencaiStreamText: "",
    wencaiRequestId: 0,
    wencaiContextMode: "generic",
    wencaiHistoryOpen: false,
    wencaiSkillsOpen: false,
    activeThreadKey: "",
    stockThreads: {},
    wencaiThreads: [
      { id: 1, key: "stock:600519", symbol: "600519", title: "贵州茅台盘面解读", time: "刚刚" },
      { id: 2, key: "stock:688256", symbol: "688256", title: "寒武纪-U 走势研判", time: "昨天" },
      { id: 3, key: "stock:300693", symbol: "300693", title: "盛弘股份关键位置", time: "周二" }
    ],
    searchReturnView: "market",
    searchReturnNav: "market"
  });
  try {
    const saved=JSON.parse(localStorage.getItem("lele-ai-trading-state")||"null");
    if(saved&&typeof saved==="object")Object.assign(AppState,{
      stockThreads:saved.stockThreads||{},
      wencaiThreads:Array.isArray(saved.wencaiThreads)?saved.wencaiThreads:AppState.wencaiThreads
    });
  } catch (_) {}
  let wencaiController = null;
  const viewCache = new Map();
  const viewCacheTtl = 30000;
  const stockInsightCache = new Map();

  const svg = (body, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
  const I = {
    back: svg('<path d="m15 18-6-6 6-6"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'),
    more: svg('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'),
    star: svg('<path d="m12 2 3 6.2 6.8 1-4.9 4.8 1.2 6.8-6.1-3.2-6.1 3.2 1.2-6.8-4.9-4.8 6.8-1Z"/>'),
    bell: svg('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>'),
    moon: svg('<path d="M20 15.2A8 8 0 0 1 8.8 4 8 8 0 1 0 20 15.2Z"/>'),
    expand: svg('<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/>'),
    gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>'),
    chevron: svg('<path d="m9 18 6-6-6-6"/>'),
    refresh: svg('<path d="M20 7v5h-5M4 17v-5h5M6.2 9A7 7 0 0 1 18 7l2 5M4 12l2 5a7 7 0 0 0 11.8-2"/>')
  };

  const fmtPct = (v) => `${v >= 0 ? "+" : ""}${Number(v).toFixed(2)}%`;
  const tone = (v) => Number(v) >= 0 ? "rise" : "fall";
  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));

  function clock() {
    document.getElementById("system-time").textContent = "11:30";
  }

  function updateNav() {
    document.querySelectorAll("[data-nav]").forEach((button) => {
      const active = button.dataset.nav === AppState.activeNav;
      button.classList.toggle("active", active);
      button.classList.toggle("ai-ready", button.dataset.nav === "ai" && AppState.aiReady);
      active ? button.setAttribute("aria-current", "page") : button.removeAttribute("aria-current");
    });
  }

  function loadingView() {
    return `<div class="screen"><header class="red-header"><strong>乐乐交易</strong></header>
      <div class="dense-loading">${Array.from({length: 11}, (_, i) => `<i style="--i:${i}"></i>`).join("")}</div></div>`;
  }

  function errorView(message) {
    return `<div class="screen"><header class="red-header"><strong>行情服务</strong></header>
      <div class="empty-state">${I.refresh}<b>行情暂时无法加载</b><span>${message}</span>
      <button data-action="retry">重新加载</button></div></div>`;
  }

  function renderQuote(data) {
    const s = data.stock;
    const indicatorValues = getAnalysis(data).indicators;
    const periodTabs = ["分时", "五日", "日K", "周K", "月K", "更多"];
    const details = ["盘口", "资金", "资讯", "公告", "简况"];
    return `<div class="screen quote-screen ${AppState.darkMarket ? "market-dark" : ""}">
      <header class="quote-header">
        <button class="header-icon" data-action="market-overview" aria-label="返回行情">${I.back}</button>
        <div class="security-title"><b>${s.name}</b><small>${s.symbol} ${s.market || "SH"} · 午间休市</small></div>
        <button class="header-icon" data-action="search" aria-label="搜索">${I.search}</button>
        <button class="header-icon" data-action="toggle-theme" aria-label="切换看盘主题">${I.moon}</button>
      </header>

      <section class="quote-overview">
        <div class="quote-primary">
          <strong class="${tone(s.changePct)}">${s.price.toFixed(2)}</strong>
          <span class="${tone(s.changePct)}">${s.change >= 0 ? "+" : ""}${s.change.toFixed(2)}&nbsp;&nbsp;${fmtPct(s.changePct)}</span>
          <em>${s.reason || "沪股通"}&nbsp;&nbsp;11:30 快照</em>
        </div>
        <div class="quote-metrics">
          <dl><dt>今开</dt><dd class="rise">${s.open.toFixed(2)}</dd><dt>最高</dt><dd class="rise">${s.high.toFixed(2)}</dd><dt>成交量</dt><dd>${s.volume}</dd></dl>
          <dl><dt>昨收</dt><dd>${s.prevClose.toFixed(2)}</dd><dt>最低</dt><dd class="fall">${s.low.toFixed(2)}</dd><dt>成交额</dt><dd>${s.amount}</dd></dl>
          <dl><dt>换手</dt><dd>${s.turnover}%</dd><dt>市盈率</dt><dd>${s.pe}</dd><dt>总市值</dt><dd>${s.marketCap}</dd></dl>
        </div>
      </section>

      <div class="quote-ribbon">
        <button data-action="toggle-watch" class="${AppState.watchlisted ? "selected" : ""}">${I.star}<span>${AppState.watchlisted ? "已自选" : "加自选"}</span></button>
        <button data-action="alert">${I.bell}<span>预警</span></button>
        <div><span>标签</span><b>${s.reason || "热门个股"}</b></div>
        <div><span>状态</span><b>融资净买入</b></div>
      </div>

      <section class="terminal">
        <div class="period-tabs" role="tablist">
          ${periodTabs.map(tab => `<button role="tab" aria-selected="${AppState.chartTab === tab}" class="${AppState.chartTab === tab ? "active" : ""}" data-chart-tab="${tab}">${tab}</button>`).join("")}
        </div>
        <div class="terminal-grid">
          <div class="chart-column">
            <div class="chart-readout" id="chart-readout">
              <span class="rise">价 ${s.price.toFixed(2)}</span><span class="avg">均 ${data.timeline.at(-1).average.toFixed(2)}</span><span>量 338</span><button class="ai-inline" data-action="ai-current">问财解盘</button>
            </div>
            <span class="chart-gesture-tip">长按分时图 · 问财解读时点</span>
            <canvas id="market-chart" aria-label="${s.name}${AppState.chartTab}行情图"></canvas>
            <button id="chart-point-ai" class="ai-point-cta" data-action="ai-point">问财解读此处</button>
            <div class="indicator-readout">${AppState.indicator==="MACD"?`DIF ${indicatorValues.macd.dif}　DEA ${indicatorValues.macd.dea}　MACD ${indicatorValues.macd.bar}`:AppState.indicator==="KDJ"?`K ${indicatorValues.kdj.k}　D ${indicatorValues.kdj.d}　J ${indicatorValues.kdj.j}`:AppState.indicator==="RSI"?`RSI(6) ${indicatorValues.rsi}`:`VOL 量比 ${indicatorValues.volRatio}`}</div>
            <div class="indicator-tabs">
              ${["MACD","KDJ","RSI","VOL"].map(x => `<button class="${AppState.indicator === x ? "active" : ""}" data-indicator="${x}">${x}</button>`).join("")}
              <button data-action="chart-settings" aria-label="图表设置">${I.gear}</button>
              <button data-action="expand-chart" aria-label="展开图表">${I.expand}</button>
            </div>
          </div>
          <aside class="order-panel">
            <div class="mini-tabs"><button class="${AppState.quotePanel === "五档" ? "active" : ""}" data-quote-panel="五档">五档</button><button class="${AppState.quotePanel === "明细" ? "active" : ""}" data-quote-panel="明细">明细</button></div>
            <div id="order-content">${renderOrderContent(data)}</div>
          </aside>
        </div>
      </section>

      <div class="detail-tabs">
        ${details.map(tab => `<button class="${AppState.detailTab === tab ? "active" : ""}" data-detail-tab="${tab}">${tab}</button>`).join("")}
      </div>
      <section class="detail-content">${renderQuoteDetail(data)}</section>

      <div class="quote-actions">
        <button data-action="toggle-watch">${AppState.watchlisted ? "删自选" : "加自选"}</button>
        <button class="ai-action" data-action="ai-current">问财解盘</button>
        <button class="sell" data-action="open-trade">卖出</button>
        <button class="buy" data-action="open-trade">买入</button>
      </div>
    </div>`;
  }

  function renderOrderContent(data) {
    if (AppState.quotePanel === "明细") {
      return `<div class="tick-list"><div class="order-head"><span>时间</span><span>价格</span><span>现量</span></div>
        ${[...data.trades, ...data.trades].slice(0,10).map((r, i) => `<div><span>${r.time.slice(0,5)}</span><b class="${r.direction === "buy" ? "rise" : "fall"}">${(r.price + (i > 4 ? -.12 : 0)).toFixed(2)}</b><em>${r.volume + i}</em></div>`).join("")}</div>`;
    }
    const sells = data.orderBook.filter(x => x.side === "卖").sort((a,b) => b.level-a.level);
    const buys = data.orderBook.filter(x => x.side === "买").sort((a,b) => a.level-b.level);
    return `<div class="order-book">
      ${sells.map(r => `<div><span>卖${r.level}</span><b class="rise">${r.price.toFixed(2)}</b><em>${r.volume}</em></div>`).join("")}
      <div class="last-deal"><span>委比</span><b class="rise">+12.46%</b></div>
      ${buys.map(r => `<div><span>买${r.level}</span><b class="fall">${r.price.toFixed(2)}</b><em>${r.volume}</em></div>`).join("")}
    </div>`;
  }

  function renderQuoteDetail(data) {
    if (AppState.detailTab === "资金") {
      return `<div class="capital-panel"><div class="capital-ring"><b>1.82亿</b><span>主力净流入</span></div>
        <div class="capital-bars">${[["超大单",.84,"+0.96亿"],["大单",.72,"+0.86亿"],["中单",-.44,"-0.52亿"],["小单",-.88,"-1.30亿"]].map(x => `<div><span>${x[0]}</span><i><u class="${x[1] > 0 ? "up" : "down"}" style="width:${Math.abs(x[1])*100}%"></u></i><b class="${x[1] > 0 ? "rise" : "fall"}">${x[2]}</b></div>`).join("")}</div></div>`;
    }
    if (AppState.detailTab === "资讯" || AppState.detailTab === "公告") {
      return `<div class="compact-news">${MOCK_DB.news.slice(0,4).map(n => `<button data-action="news-detail"><span>${n.title}</span><time>${n.time}</time></button>`).join("")}</div>`;
    }
    if (AppState.detailTab === "简况") {
      return `<div class="company-grid"><div><span>所属概念</span><b>${data.stock.reason || "核心资产"}</b></div><div><span>每股收益</span><b>${(1.2 + Number(data.stock.symbol.slice(-1))*.37).toFixed(2)}</b></div><div><span>总股本</span><b>${(8.6 + Number(data.stock.symbol.slice(-2))*.21).toFixed(2)}亿</b></div><div><span>净资产收益率</span><b>${(8.3 + Number(data.stock.symbol.slice(-1))*1.7).toFixed(2)}%</b></div><div><span>机构持仓</span><b>${(32.4 + Number(data.stock.symbol.slice(-2))*.43).toFixed(2)}%</b></div><div><span>股东人数</span><b>${(7.2 + Number(data.stock.symbol.slice(-1))*1.8).toFixed(2)}万</b></div></div>`;
    }
    return `<div class="handicap-summary">
      <h3>盘口异动</h3><div class="signal-line"><span>11:18 大笔买入</span><b class="rise">${(data.stock.price*.998).toFixed(2)}</b><em>326手</em></div>
      <div class="signal-line"><span>10:56 火箭发射</span><b class="rise">+1.36%</b><em>强度 82</em></div>
      <div class="sector-link"><div><span>所属板块</span><b>${data.stock.reason || "核心资产"}&nbsp;&nbsp;融资融券&nbsp;&nbsp;A股</b></div>${I.chevron}</div>
      <div class="breadth"><span>外盘 <b class="rise">1.52万</b></span><span>内盘 <b class="fall">1.31万</b></span><span>量比 <b>1.12</b></span></div>
    </div>`;
  }

  function renderIndices(indices) {
    return `<div class="market-index-strip">${indices.map(x => `<button data-action="index-detail"><b>${x.name}</b><strong class="${tone(x.pct)}">${x.value}</strong><span class="${tone(x.pct)}">${fmtPct(x.pct)}</span><i class="spark ${tone(x.pct)}"></i></button>`).join("")}</div>`;
  }

  function renderHome(data) {
    return `<div class="screen">
      <header class="red-header"><b>乐乐交易</b><div class="red-search" data-action="search">${I.search}<span>股票 / 基金 / 问财</span></div><button data-action="message">${I.bell}</button></header>
      <div class="channel-tabs"><button class="active">首页</button><button>A股</button><button>港股</button><button>美股</button><button>基金</button><button>期货</button></div>
      <div class="closing-tip"><b>午间休市</b><span>13:00 继续交易</span><button data-action="show-toast" data-message="午盘点评已更新">午盘点评 ${I.chevron}</button></div>
      ${renderIndices(data.indices)}
      <div class="tool-grid">${["涨停聚焦","市场热榜","龙虎榜","选股","研报","资金流向","智能盯盘","全部"].map((x,i) => `<button data-action="show-toast" data-message="${x}功能演示"><i>${["涨","热","龙","选","研","资","盯","全"][i]}</i><span>${x}</span></button>`).join("")}</div>
      <section class="flat-section"><div class="section-title"><b>市场机会</b><button>更多 ${I.chevron}</button></div>
        <div class="opportunity-grid">${data.sectors.slice(0,3).map((x,i) => `<button><span>${["领涨板块","人气风向","主力关注"][i]}</span><b>${x.name}</b><em class="${tone(x.pct)}">${fmtPct(x.pct)}</em><small>${x.leader}</small></button>`).join("")}</div>
      </section>
      <section class="flat-section"><div class="section-title"><b>自选动态</b><button data-nav-jump="watch">全部 ${I.chevron}</button></div>${renderStockRows(data.watchlist.slice(0,5))}</section>
      <section class="flat-section"><div class="section-title"><b>7×24 快讯</b><button data-action="news-list">更多 ${I.chevron}</button></div>${renderNewsRows(MOCK_DB.news.slice(0,4))}</section>
    </div>`;
  }

  function renderStockRows(rows) {
    if (!rows.length) return `<div class="empty-inline">没有找到匹配股票</div>`;
    return `<div class="stock-table"><div class="stock-head"><span>名称代码</span><span>最新价</span><span>涨跌幅</span></div>
      ${rows.map(x => `<button data-stock="${x.symbol}"><span><b>${x.name}</b><small>${x.symbol}</small></span><strong class="${tone(x.pct)}">${x.price.toFixed(2)}</strong><em class="${tone(x.pct)}">${fmtPct(x.pct)}</em></button>`).join("")}</div>`;
  }

  function renderWatch(data) {
    const q = AppState.searchQuery.trim().toLowerCase();
    const rows = data.filter(x => `${x.name}${x.symbol}`.toLowerCase().includes(q));
    return `<div class="screen">
      <header class="red-header"><b>自选</b><div class="header-actions"><button data-action="search">${I.search}</button><button data-action="more">${I.more}</button></div></header>
      <div class="channel-tabs"><button class="active">全部</button><button>沪深</button><button>港股</button><button>美股</button><button>基金</button></div>
      <div class="watch-toolbar"><label>${I.search}<input id="watch-search" value="${AppState.searchQuery}" placeholder="搜索自选股"></label>
        ${[["default","默认"],["rise","涨幅"],["fall","跌幅"]].map(x => `<button class="${AppState.watchSort === x[0] ? "active" : ""}" data-sort="${x[0]}">${x[1]}</button>`).join("")}</div>
      <div class="watch-banner"><span>自选动态分组</span><b>发现 3 只趋势转强股票</b><button>立即查看</button></div>
      ${renderStockRows(rows)}
      <section class="flat-section"><div class="section-title"><b>自选资讯</b><button>更多 ${I.chevron}</button></div>${renderNewsRows(MOCK_DB.news.slice(0,3))}</section>
    </div>`;
  }

  function renderMarket(data) {
    return `<div class="screen">
      <header class="red-header"><b>行情</b><div class="red-search" data-action="search">${I.search}<span>输入代码 / 名称 / 拼音</span></div></header>
      <div class="channel-tabs"><button class="active">A股</button><button>港股</button><button>美股</button><button>ETF</button><button>期货</button><button>基金</button></div>
      ${renderIndices(data.indices)}
      <div class="breadth-panel"><div><b>上涨 <em class="rise">3215</em></b><i><u style="width:72%"></u></i><b>下跌 <em class="fall">1128</em></b></div><small>涨停 147&nbsp;&nbsp; 跌停 8&nbsp;&nbsp; 平盘 196</small></div>
      <section class="flat-section"><div class="section-title"><b>热门板块</b><button>更多 ${I.chevron}</button></div>
        <div class="sector-table">${data.sectors.map(x => `<button><span><b>${x.name}</b><small>${x.leader}</small></span><strong class="${tone(x.pct)}">${fmtPct(x.pct)}</strong><em class="${tone(x.pct)}">${x.pct > 0 ? "领涨" : "领跌"}</em></button>`).join("")}</div>
      </section>
      <section class="flat-section"><div class="rank-tabs"><button class="active">涨幅榜</button><button>跌幅榜</button><button>成交额</button><button>换手率</button></div>${renderStockRows([...data.rankings].sort((a,b)=>b.pct-a.pct))}</section>
    </div>`;
  }

  function renderNewsPage(rows) {
    const tabs = ["要闻", "快讯", "机会", "研报", "公告"];
    const expanded = [...rows, ...rows.map((item, index) => ({
      ...item,
      id: item.id + 20,
      time: ["09:36","10:02","10:28","10:54","11:20"][index],
      title: ["算力产业链成交活跃，多只核心标的获主力资金关注","沪深两市成交额连续放大，科技成长方向表现强势","机构策略：关注高景气赛道与业绩确定性品种","盘后公告速递：多家公司披露回购与增持计划","全球市场观察：主要股指多数上涨"][index]
    }))];
    return `<div class="screen">
      <header class="red-header"><b>资讯</b><div class="red-search" data-action="search">${I.search}<span>搜索资讯、股票和主题</span></div><button data-action="message">${I.bell}</button></header>
      <div class="channel-tabs news-channels">${tabs.map((tab) => `<button class="${AppState.newsTab === tab ? "active" : ""}" data-news-tab="${tab}">${tab}</button>`).join("")}</div>
      <section class="headline-card"><span>市场焦点</span><h2>AI 算力与高端制造持续活跃，资金关注景气方向</h2><p>上午盘面热点快速轮动，成交额维持高位，注意节奏与风险。</p><div><b>乐乐财经</b><time>11:28</time></div></section>
      <div class="news-topic-strip"><button>算力产业链</button><button>主力资金</button><button>机器人</button><button>固态电池</button></div>
      <section class="flat-section news-feed-section">${expanded.map((item, index) => `<button class="news-card" data-action="news-detail">
        <div><span class="news-type">${index % 3 === 0 ? "快讯" : item.tag}</span><time>${item.time}</time></div>
        <h3>${item.title}</h3><p>${index % 2 ? "梳理行业最新变化、市场表现及机构观点，数据仅作产品展示。" : "多项公开信息显示板块关注度上升，相关个股成交明显活跃。"}</p>
        <footer><span>${item.source}</span><em>${18 + index * 7}万阅读</em></footer>
      </button>`).join("")}</section>
    </div>`;
  }

  function renderNewsRows(rows) {
    return `<div class="feed">${rows.map(n => `<button data-action="news-detail"><time>${n.time}</time><span><b>${n.title}</b><small>${n.source} · ${n.tag}</small></span></button>`).join("")}</div>`;
  }

  function renderTrade(data) {
    return `<div class="screen">
      <header class="red-header"><b>交易</b><div class="header-actions"><button data-action="message">${I.bell}</button><button data-action="more">${I.more}</button></div></header>
      <div class="trade-account"><div><span>总资产（元）</span><b>${data.totalAsset}</b><button data-action="privacy">◉</button></div><div><span>今日盈亏 <b class="rise">${data.dailyProfit}</b></span><span>可用资金 <b>${data.available}</b></span></div></div>
      <div class="trade-tools">${["买入","卖出","撤单","持仓","当日成交","银证转账","新股申购","更多"].map((x,i)=>`<button data-action="${i < 2 ? "open-trade" : "show-toast"}" data-message="${x}功能演示"><i>${["买","卖","撤","仓","成","转","新","全"][i]}</i><span>${x}</span></button>`).join("")}</div>
      <section class="flat-section"><div class="section-title"><b>持仓</b><button data-action="show-toast" data-message="持仓已刷新">${I.refresh}</button></div>
        <div class="position-head"><span>证券/持仓</span><span>现价/成本</span><span>盈亏/比例</span></div>
        ${data.positions.map(x=>`<button class="position-row" data-stock="${x.name === "贵州茅台" ? "600519" : "300750"}"><span><b>${x.name}</b><small>${x.shares}股</small></span><span><b>${x.price.toFixed(2)}</b><small>${x.cost.toFixed(2)}</small></span><span><b class="rise">+${x.profit.toFixed(2)}</b><small class="rise">+${(x.profit/(x.cost*x.shares)*100).toFixed(2)}%</small></span></button>`).join("")}
      </section>
      <section class="flat-section"><div class="section-title"><b>今日委托</b><button>全部 ${I.chevron}</button></div><div class="empty-inline">暂无今日委托</div></section>
    </div>`;
  }

  function renderProfile() {
    return `<div class="screen">
      <header class="red-header"><b>我的</b><div class="header-actions"><button data-action="message">${I.bell}</button><button data-action="settings">${I.gear}</button></div></header>
      <section class="profile-hero"><div class="avatar">投</div><div><b>模拟投资者</b><span>普通用户 · 交易日 238 天</span></div><button data-action="login">登录/切换</button></section>
      <div class="profile-stats"><div><b>12</b><span>自选分组</span></div><div><b>36</b><span>关注</span></div><div><b>8</b><span>浏览历史</span></div><div><b>4</b><span>订阅服务</span></div></div>
      <section class="menu-list">${[["我的账户","资产、持仓与收益分析"],["消息中心","预警、公告与互动消息"],["模拟炒股","20万模拟金练习"],["Level-2中心","十档行情与逐笔明细"],["投资学院","课程、直播与训练营"],["设置","主题、字体与行情偏好"]].map(x=>`<button data-action="show-toast" data-message="${x[0]}功能演示"><span><b>${x[0]}</b><small>${x[1]}</small></span>${I.chevron}</button>`).join("")}</section>
    </div>`;
  }

  function currentHolding(stock) {
    const saved = MOCK_DB.holdings?.[stock.symbol] || null;
    if (AppState.holdingOverride === false) return null;
    if (AppState.holdingOverride === true) return saved || { cost: stock.price * .94, shares: 300, positionPct: 28, profitPct: 6.38 };
    return saved;
  }

  function getAnalysis(data, anchor = null) {
    return AIEngine.analyze({ quote: data, holding: currentHolding(data.stock), anchor });
  }

  function factorText(value) {
    return `${value >= 0 ? "+" : ""}${value}`;
  }

  function renderAIReport(analysis, expanded = false, conversational = false) {
    const scoreClass = analysis.score >= 56 ? "bull" : analysis.score <= 44 ? "bear" : "flat";
    const bull=analysis.score,bear=100-analysis.score;
    return `<section class="ai-report ${expanded ? "expanded" : ""}">
      <div class="ai-report-head"><div><span class="ai-kicker">${analysis.mode}</span><h2>${analysis.direction}</h2><small>多空评分，不代表上涨概率</small></div><div class="ai-score ${scoreClass}" style="--score:${analysis.score}"><b>${analysis.score}</b><span>/ 100</span></div></div>
      <div class="ai-horizons">${analysis.horizons.map((item)=>`<div><span>${item.label}</span><b>${item.value}</b><em>${item.score}</em></div>`).join("")}</div>
      <div class="sentiment-label"><span>当日倾向与交易入口</span><b>看多 ${bull}% · 看空 ${bear}%</b></div>
      <div class="sentiment-actions" style="--bull:${bull}fr;--bear:${bear}fr"><button class="bull-button" data-action="wencai-buy">买 ${bull}%</button><button class="bear-button" data-action="wencai-sell">卖 ${bear}%</button></div>
      <div class="ai-evidence">${analysis.factors.map((item)=>`<div><span>${item.key}</span><i><u class="${item.value >= 0 ? "positive" : "negative"}" style="--factor:${Math.min(100,Math.abs(item.value)/item.max*100)}%"></u></i><b class="${item.value >= 0 ? "rise" : "fall"}">${factorText(item.value)}</b></div>`).join("")}</div>
      <div class="ai-section"><h3>当前判断</h3><p>${analysis.context}</p><p class="ai-conflict">${analysis.conflict}</p></div>
      <div class="ai-section ai-advice"><h3>${analysis.held ? "已持仓建议" : "未持仓建议"}</h3>${analysis.held ? `<div class="holding-line"><span>成本 ${analysis.holding.cost.toFixed(2)}</span><span>仓位 ${analysis.holding.positionPct}%</span><span class="${analysis.holding.profitPct >= 0 ? "rise" : "fall"}">盈亏 ${analysis.holding.profitPct >= 0 ? "+" : ""}${analysis.holding.profitPct.toFixed(2)}%</span></div>` : ""}<strong>${analysis.action}</strong></div>
      <div class="ai-levels"><div><span>支撑</span><b>${analysis.levels.support.toFixed(2)}</b></div><div><span>压力</span><b>${analysis.levels.pressure.toFixed(2)}</b></div><div><span>止损参考</span><b>${analysis.levels.stop.toFixed(2)}</b></div><div><span>突破确认</span><b>${analysis.levels.breakout.toFixed(2)}</b></div></div>
      ${expanded ? `<div class="ai-method"><h3>评分说明</h3><p>以 50 分为多空平衡点，综合趋势、量价、板块、技术和资金五类信号；冲突指标会相互抵消，而不是由模型随意给出概率。</p></div>` : ""}
      <small class="ai-disclaimer">${analysis.disclaimer}</small>
      ${conversational ? "" : `<footer><button class="ai-ask" data-action="ask-ai">继续问问财</button><button class="ai-trade" data-action="set-signal">设条件提醒</button></footer>`}
    </section>`;
  }

  function composeWencaiPrompt(data, anchor = null) {
    const stock=data.stock,holding=currentHolding(stock);
    const anchorPct=anchor ? Number(anchor.changePct ?? anchor.pct ?? 0) : 0;
    const moment=anchor ? `${anchor.time}，价格 ${anchor.price.toFixed(2)} 元，涨跌幅 ${anchorPct >= 0 ? "+" : ""}${anchorPct.toFixed(2)}%` : `当前时点，价格 ${stock.price.toFixed(2)} 元，日内涨跌幅 ${fmtPct(stock.changePct)}`;
    return `请帮我分析 ${stock.name}（${stock.symbol}）在${moment}的盘面。结合分时走势、成交量、均价线、技术指标、大盘、${stock.reason || "所属板块"}和资金情况，判断日内、短线与中期强弱，说明理由，并给出${holding ? `我成本 ${holding.cost.toFixed(2)} 元、仓位 ${holding.positionPct}% 时的持有或减仓建议` : "未持仓情况下的介入建议"}、关键支撑压力和风险点。`;
  }

  function classifyQuestion(question) {
    const text=question.trim();
    if(/你好|您好|hi|hello|嗨|哈喽|在吗|谢谢/i.test(text)&&!/分析|股票|走势|行情|买|卖|板块|指标/.test(text))return "greeting";
    if(/你是谁|能做什么|怎么用|帮助/.test(text))return "help";
    if(/一定|保证|必涨|稳赚|准确预测/.test(text))return "data_gap";
    if(/公告|新闻|财报|业绩|事件|利好|利空|催化/.test(text))return "event";
    if(/提醒|异动|预警|放量|突破/.test(text))return "signal";
    if(/选股|筛选|股票池|机会股|哪些股票/.test(text))return "selection";
    if(/大盘|指数|市场情绪|市场环境/.test(text))return "market";
    if(/板块|行业|同类股|同业|相对强弱/.test(text))return "sector";
    if(/持仓|成本|仓位|浮盈|浮亏/.test(text))return "holding";
    if(/买点|卖点|买入|卖出|加仓|减仓|止盈|止损|交易计划|支撑|压力/.test(text))return "trade_plan";
    if(/MACD|KDJ|RSI|VOL|技术指标|均线|BOLL/i.test(text))return "indicator";
    if(/午后|下午|明天|未来|收盘|推演/.test(text))return "forecast";
    if(/股票|个股|走势|行情|分时|均价|成交量|开盘|涨|跌/i.test(text))return "analysis";
    return "general";
  }

  function buildWencaiResponse(question,data,analysis,externalText = "",forcedType = "") {
    const type=forcedType||classifyQuestion(question),stock=data.stock;
    if(type==="greeting")return {role:"assistant",type,content:externalText||`你好，我是问财。你可以直接问我日常问题，也可以从当前的 ${stock.name} 开始做个股分析。`};
    if(type==="help")return {role:"assistant",type,content:externalText||"我支持日常问答、个股解盘、分时异动、技术指标、持仓诊断和条件提醒。"};
    if(type==="general")return {role:"assistant",type,content:externalText||(/时间/.test(question)?"当前产品时间固定为 11:30。":/笑话/.test(question)?"当然可以：为什么交易员总盯着 K 线？因为它比心电图更容易让人心跳加速。":"这是一个通用问题。接入外部模型后我会直接正常回答，而不会强行生成股票研判报告。")};
    if(type==="data_gap")return {role:"assistant",type,content:externalText||"我不能保证某只股票必涨或给出确定收益。可以改为分析触发条件、风险区间和不同情景下的应对方案。"};
    if(type==="event")return {role:"assistant",type,content:externalText||`当前 Demo 尚未接入实时公告与新闻源，因此不会编造 ${stock.name} 的事件信息。接入事件 API 后，可按公告、财报和新闻分别检索并标注来源时间。`};
    if(type==="market")return {role:"assistant",type,content:externalText||"我已读取主要指数和市场宽度，用于判断当前个股所处的市场环境。",analysis};
    if(type==="sector")return {role:"assistant",type,content:externalText||`我已比较 ${stock.name} 与所属板块及同类热门股票的相对强弱。`,analysis};
    if(type==="selection")return {role:"assistant",type,content:externalText||"我按热度、涨跌幅和题材信号整理了候选股票，结果仅用于演示筛选逻辑。",analysis};
    if(type==="signal")return {role:"assistant",type,content:externalText||"我已提取当前盘面的特殊信号，并转成可设置提醒的触发条件。",analysis};
    return {role:"assistant",type,analysis,question,llmText:externalText};
  }

  function renderSimpleAnswer(message,data) {
    const starters=message.type==="greeting"?["分析当前股票","看看今天大盘","有哪些异动信号"]:["分析分时异动","比较所属板块","诊断我的持仓"];
    return `<div class="wencai-answer simple"><div class="wencai-avatar">问</div><div class="simple-answer-body"><div class="answer-meta">问财</div><p>${message.content}</p><div>${starters.map(item=>`<button data-wencai-prompt="${item}">${item}</button>`).join("")}</div></div></div>`;
  }

  function renderContextAnswer(message,data) {
    const analysis=message.analysis,stock=data.stock;
    if(message.type==="market")return `<div class="wencai-answer"><div class="wencai-avatar">问</div><div class="wencai-answer-body"><div class="answer-meta">问财 · 大盘 Skill</div><p class="answer-lead">${message.content}</p><section class="market-context-card">${MOCK_DB.indices.map(index=>`<div><span>${index.name}</span><b class="${tone(index.pct)}">${index.value}</b><em class="${tone(index.pct)}">${fmtPct(index.pct)}</em></div>`).join("")}<footer>市场温度 <b>中性偏强</b> · 上涨 2876 家 / 下跌 1935 家</footer></section></div></div>`;
    if(message.type==="sector"||message.type==="selection"){const peers=MOCK_DB.watchlist.filter(item=>item.symbol!==stock.symbol).sort((a,b)=>b.pct-a.pct).slice(0,4);return `<div class="wencai-answer"><div class="wencai-avatar">问</div><div class="wencai-answer-body"><div class="answer-meta">问财 · ${message.type==="selection"?"智能选股":"板块对比"} Skill</div><p class="answer-lead">${message.content}</p><section class="peer-card"><header><b>${message.type==="selection"?"热门候选":"相对强弱"}</b><span>模拟行情样本</span></header>${peers.map((item,index)=>`<div><em>${index+1}</em><span>${item.name}<small>${item.reason}</small></span><b class="${tone(item.pct)}">${fmtPct(item.pct)}</b></div>`).join("")}</section></div></div>`;}
    const signals=[analysis.score>=56?["趋势信号","股价运行在均价线强势区","up"]:["趋势信号","价格弱于均价线，等待修复","down"],analysis.indicators.volRatio>1?["量能信号",`近期量比 ${analysis.indicators.volRatio}，成交活跃`,"up"]:["量能信号","量能暂未形成确认","flat"],analysis.indicators.rsi>70?["风险信号",`RSI ${analysis.indicators.rsi}，短线偏热`,"warn"]:["指标信号",`RSI ${analysis.indicators.rsi}，处于中性区`,"flat"]];
    return `<div class="wencai-answer"><div class="wencai-avatar">问</div><div class="wencai-answer-body"><div class="answer-meta">问财 · 异动监控 Skill</div><p class="answer-lead">${message.content}</p><section class="signal-cards">${signals.map(item=>`<article class="${item[2]}"><i></i><div><b>${item[0]}</b><span>${item[1]}</span></div><button data-action="set-signal">设提醒</button></article>`).join("")}</section></div></div>`;
  }

  function renderWencaiAnswer(message,data) {
    if(["greeting","help","general","event","data_gap"].includes(message.type))return renderSimpleAnswer(message,data);
    if(["signal","market","sector","selection"].includes(message.type))return renderContextAnswer(message,data);
    const analysis=message.analysis,indicators=analysis.indicators;
    const caseMeta={indicator:"技术指标联合研判",holding:"持仓诊断",trade_plan:"交易计划",forecast:"午后情景推演",analysis:"个股综合解盘"}[message.type]||"个股综合解盘";
    return `<div class="wencai-answer"><div class="wencai-avatar">问</div><div class="wencai-answer-body">
      <div class="answer-meta">问财 · ${caseMeta}</div>
      <div class="skill-result"><header><span>11:30 模拟快照 · 已调用 4 个 Skill</span><b>综合研判</b></header><div><span>分时解构</span><span>技术指标</span><span>板块对比</span><span>交易计划</span></div></div>
      ${renderAIReport(analysis,false,true)}
      <section class="indicator-snapshot"><h3>技术指标快照</h3><div><article><span>MACD</span><b class="${indicators.macd.bar>=0?"rise":"fall"}">${indicators.macd.signal}</b><small>DIF ${indicators.macd.dif}</small></article><article><span>KDJ</span><b>${indicators.kdj.k}/${indicators.kdj.d}</b><small>J ${indicators.kdj.j}</small></article><article><span>RSI</span><b>${indicators.rsi}</b><small>${indicators.rsi>70?"偏热":indicators.rsi<30?"偏冷":"中性"}</small></article><article><span>VOL</span><b>${indicators.volRatio}</b><small>近期量比</small></article></div></section>
      ${renderStockContext(data,analysis)}
      ${renderIntradayProjection(analysis)}
    </div></div>`;
  }

  function renderStockContext(data,analysis) {
    const peers=MOCK_DB.watchlist.filter(item=>item.symbol!==data.stock.symbol).sort((a,b)=>Math.abs(b.pct)-Math.abs(a.pct)).slice(0,3);
    return `<section class="stock-context-card"><header><h3>市场与板块</h3><span>${data.stock.reason}</span></header><div class="index-mini">${MOCK_DB.indices.slice(0,3).map(index=>`<span>${index.name}<b class="${tone(index.pct)}">${fmtPct(index.pct)}</b></span>`).join("")}</div><div class="peer-mini">${peers.map(item=>`<span>${item.name}<b class="${tone(item.pct)}">${fmtPct(item.pct)}</b></span>`).join("")}</div><footer>${analysis.score>=56?"个股强度高于市场基准，关注板块能否继续同步。":"个股暂未形成相对强势，优先观察板块修复。"}</footer></section>`;
  }

  function wencaiAnswerLead(question,analysis) {
    if(/为什么|拉升|跳水|异动/.test(question))return `核心原因是趋势与量价信号正在${analysis.score>=56?"形成正向共振":"转弱"}，但仍需结合板块同步性确认，不能仅根据单根分时线追涨杀跌。`;
    if(/持仓|止盈|止损|减仓/.test(question))return `我已按持仓用户路径生成条件化建议：不直接替你下单，而是把减仓、止损和继续持有的触发价格列清楚。`;
    if(/选股|机会|自选/.test(question))return `我先用量价、板块和资金三项筛选，再用趋势与技术指标复核；当前结果会优先展示信号共振而非单纯涨幅靠前。`;
    if(/明天|收盘|推演|午间/.test(question))return `下面给出强势延续、横盘消化和转弱回踩三种路径，关键不是猜一条线，而是观察价格触发哪个条件。`;
    return `我已把当前盘面拆成可验证的信号，并将结论、冲突点和操作条件分开呈现。`;
  }

  function renderIntradayProjection(analysis) {
    const color=analysis.score>=56?"#f04a52":analysis.score<=44?"#13a36d":"#d59b34";
    return `<section class="projection-card"><header><div><h3>午后情景推演</h3><span>上午实际走势截至 11:30，右侧为条件推演</span></div><b>${analysis.direction}</b></header><svg viewBox="0 0 300 92" role="img" aria-label="上午走势与午后情景推演图"><rect class="future-zone" x="160" y="8" width="134" height="70" rx="3"/><path class="projection-grid" d="M6 20H294M6 46H294M6 72H294"/><path class="actual-line" d="M8 62 C28 59 36 67 52 53 S79 39 94 47 S122 35 145 30"/><path class="divider" d="M153 8V79"/><path class="future-main" style="stroke:${color}" d="M160 30 C184 28 203 20 224 25 S262 17 292 12"/><path class="future-alt" d="M160 30 C188 38 213 32 238 39 S270 38 292 43"/><path class="future-down" d="M160 30 C184 39 207 48 232 51 S269 64 292 68"/><text x="8" y="89">09:30</text><text x="130" y="89">11:30</text><text x="163" y="89">13:00</text><text x="267" y="89">15:00</text></svg><div class="scenario-list">${analysis.scenarios.map(item=>`<div class="${item.tone}"><i></i><span>${item.key}</span><b>${item.label}</b></div>`).join("")}</div></section>`;
  }

  function renderWencaiThinking() {
    if(["greeting","help","general","event","data_gap"].includes(AppState.wencaiThinkingType))return `<div class="wencai-answer thinking simple-thinking"><div class="wencai-avatar">问</div><div class="thinking-dots"><i></i><i></i><i></i><span>问财正在思考</span><button data-action="cancel-wencai">停止</button></div></div>`;
    return `<div class="wencai-answer thinking"><div class="wencai-avatar">问</div><div class="thinking-card"><header><div><b>问财正在研判</b><span>读取 11:30 模拟行情与上下文</span></div><button data-action="cancel-wencai">停止</button></header>${[["分时解构","已读取价格、均价线与量能"],["指标计算","正在计算 MACD / KDJ / RSI / VOL"],["环境对比","对比大盘、板块与资金"],["策略生成","生成关键价位与操作条件"]].map((item,index)=>`<div style="--delay:${index}"><i></i><span><b>${item[0]}</b><small>${item[1]}</small></span></div>`).join("")}</div></div>`;
  }

  function renderWencai(data) {
    const stock=data.stock,messages=AppState.wencaiMessages,anchor=AppState.aiContextAnchor,isStockContext=AppState.wencaiContextMode==="stock";
    const skills=[["个股解盘","分析趋势、量价与关键位"],["分时异动","解释某个时刻为何涨跌"],["技术指标","联合 MACD/KDJ/RSI"],["板块对比","比较个股与板块强弱"],["持仓诊断","结合成本与仓位建议"],["交易计划","生成买卖触发条件"],["事件追踪","关联公告与新闻催化"],["条件预警","监控突破、跌破与放量"]];
    const welcomeAction=isStockContext?`<button data-wencai-prompt="${escapeHTML(composeWencaiPrompt(data))}">深度分析 ${stock.name}</button>`:`<button data-wencai-prompt="看看今天的市场行情和主要机会">开始问问财</button>`;
    const commonCases=isStockContext?`<button data-wencai-prompt="分析当前个股的量价、板块与关键位置"><i>解</i><span><b>个股解盘</b><small>趋势、量价、关键位置</small></span></button><button data-wencai-prompt="分析当前持仓风险，按止盈、减仓、止损分层给建议"><i>诊</i><span><b>持仓诊断</b><small>成本与仓位联合分析</small></span></button><button data-wencai-prompt="解释当前股票为什么突然拉升或跳水"><i>异</i><span><b>异动解读</b><small>定位分时关键时刻</small></span></button><button data-wencai-prompt="根据当前盘面生成收盘前的三种情景推演"><i>推</i><span><b>日内推演</b><small>强势、震荡、转弱</small></span></button>`:`<button data-wencai-prompt="看看今天大盘和市场情绪"><i>盘</i><span><b>市场解读</b><small>指数、情绪与市场温度</small></span></button><button data-wencai-prompt="帮我寻找今天值得关注的股票"><i>选</i><span><b>智能选股</b><small>先找方向，再选择个股</small></span></button><button data-wencai-prompt="我想分析一只股票"><i>股</i><span><b>个股分析</b><small>输入名称或代码后开始</small></span></button><button data-wencai-prompt="介绍一下你能做什么"><i>问</i><span><b>使用帮助</b><small>了解问财的完整能力</small></span></button>`;
    return `<div class="screen wencai-screen">
      <header class="wencai-header"><button class="thread-menu" data-action="wencai-history" aria-label="历史对话"><svg viewBox="0 0 24 24"><path d="M5 7h14M5 12h14M5 17h9"/></svg></button><div class="wencai-brand"><i>问</i><div><b>问财</b><span>乐乐金融智能助手</span></div></div><button data-action="wencai-new">新对话</button></header>
      ${isStockContext?`<div class="wencai-stock-context ${anchor?"has-anchor":""}"><button data-action="search"><span>${stock.name} ${stock.symbol}</span><strong class="${tone(stock.changePct)}">${stock.price.toFixed(2)} ${fmtPct(stock.changePct)}</strong>${I.chevron}</button>${anchor?`<button class="anchor-chip" data-action="clear-ai-anchor"><span>${anchor.time} 时点</span>×</button>`:""}</div>`:""}
      <main class="wencai-conversation" id="wencai-conversation">${messages.length ? messages.map((message)=>message.role==="user" ? `<div class="wencai-user" id="${message.id||""}">${escapeHTML(message.content)}</div>` : renderWencaiAnswer(message,data)).join("") : `<section class="wencai-welcome"><div class="wencai-orb"><i>问</i><span></span></div><h1>你好，我是问财</h1><p>${isStockContext?`已带入 ${stock.name} 行情，可以直接开始分析。`:"这是一个全新的对话，直接告诉我你想了解什么。"}</p><div class="welcome-skills"><span>行情解读</span><span>智能选股</span><span>持仓诊断</span><span>条件策略</span></div>${welcomeAction}</section><section class="wencai-cases"><h3>常用能力</h3><div>${commonCases}</div></section>`}${AppState.wencaiThinking?renderWencaiThinking():""}</main>
      <div class="wencai-composer"><div class="composer-tools"><button class="active" data-action="show-toast" data-message="深度思考已开启">深度思考</button><button data-action="show-toast" data-message="个股分析 Skill 已启用">股票分析</button>${isStockContext?`<button data-action="show-toast" data-message="已读取当前行情">当前行情</button>`:""}<button class="skill-add" data-action="wencai-skills" aria-label="打开 Skill 库">＋</button></div><form id="wencai-form"><textarea name="question" rows="1" placeholder="${isStockContext?`继续问 ${stock.name}…`:"输入你的问题…"}"></textarea><button aria-label="发送"><svg viewBox="0 0 24 24"><path d="m5 12 14-7-4 14-3-6-7-1Z"/></svg></button></form><small>AI 生成内容仅供参考，不构成投资建议</small></div>
      ${AppState.wencaiSkillsOpen?`<section class="skill-library"><header><div><b>Skill 库</b><span>为当前问题添加专业能力</span></div><button data-action="wencai-skills">×</button></header><div>${skills.map((skill,index)=>`<button data-skill-prompt="${skill[0]}：${isStockContext?`请针对 ${stock.name} `:""}${skill[1]}"><i>${["解","时","技","比","诊","策","事","醒"][index]}</i><span><b>${skill[0]}</b><small>${skill[1]}</small></span></button>`).join("")}</div></section><button class="skill-mask" data-action="wencai-skills" aria-label="关闭 Skill 库"></button>`:""}
      ${AppState.wencaiHistoryOpen?`<div class="thread-drawer"><header><b>历史对话</b><button data-action="wencai-history">×</button></header><button class="new-thread" data-action="wencai-new">＋ 新建对话</button><div>${AppState.wencaiThreads.map(thread=>`<button data-thread="${thread.id}"><span><b>${thread.title}</b><small>${thread.time}</small></span>${I.more}</button>`).join("")}</div></div><button class="drawer-mask" data-action="wencai-history" aria-label="关闭历史对话"></button>`:""}
    </div>`;
  }

  function render() {
    updateNav();
    if (AppState.loading) return void (app.innerHTML = loadingView());
    if (AppState.error) return void (app.innerHTML = errorView(AppState.error));
    const renderers = {
      quote: () => renderQuote(AppState.data),
      home: () => renderHome(AppState.data),
      watch: () => renderWatch(AppState.data),
      market: () => renderMarket(AppState.data),
      news: () => renderNewsPage(AppState.data),
      ai: () => renderWencai(AppState.data),
      trade: () => renderTrade(AppState.data),
      profile: renderProfile,
      search: () => renderSearchPage(AppState.data)
    };
    app.innerHTML = renderers[AppState.view]();
    if (AppState.view === "quote") requestAnimationFrame(mountChart);
  }

  function symbolSeed(extra = 0) {
    return [...String(AppState.selectedSymbol)].reduce((sum, char) => sum * 31 + char.charCodeAt(0), 17) + extra;
  }

  function seeded(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6D2B79F5;
      let t = value;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function denseTimeline(dayOffset = 0) {
    const anchors = AppState.data?.timeline || MOCK_DB.timeline;
    const random = seeded(symbolSeed(dayOffset * 97));
    const priceBase = AppState.data?.stock?.price || MOCK_DB.stock.price;
    const out = [];
    for (let a = 0; a < anchors.length - 1; a++) {
      const start = anchors[a], end = anchors[a + 1];
      for (let j = 0; j < 20; j++) {
        const t = j / 20;
        const index = a * 20 + j;
        const wave = (Math.sin(index * (1.31 + dayOffset * .07)) * .55 + Math.sin(index * .39 + dayOffset) * .28 + (random() - .5) * .44) * priceBase * .0007;
        out.push({
          price: start.price + (end.price - start.price) * t + wave,
          average: start.average + (end.average - start.average) * t,
          volume: Math.max(24, start.volume * (1 - t) + end.volume * t + wave * 42),
          time: start.time
        });
      }
    }
    out.push(anchors.at(-1));
    return out;
  }

  function generatedKlines() {
    const source = AppState.data?.kline || MOCK_DB.kline;
    const span = AppState.chartTab === "周K" ? 5 : AppState.chartTab === "月K" ? 21 : 1;
    const random = seeded(symbolSeed(span * 131));
    const endPrice = AppState.data?.stock?.price || source.at(-1).c;
    const volatility = Math.max(.012, Math.min(.065, Math.abs(AppState.data?.stock?.changePct || 2) / 100 + .018)) * Math.sqrt(span);
    let close = endPrice * (1 - (random() - .35) * .18);
    const rows = Array.from({length: 58}, (_, i) => {
      const cycle = Math.sin(i * (.31 + span * .006) + random()) * volatility * .45;
      const move = (random() - .47) * volatility + cycle;
      const open = close * (1 + (random() - .5) * volatility * .34);
      close = Math.max(.2, open * (1 + move));
      const high = Math.max(open, close) * (1 + random() * volatility * .38);
      const low = Math.min(open, close) * (1 - random() * volatility * .38);
      return { o: open, c: close, h: high, l: low, v: 18 + random() * 82 * Math.sqrt(span), d: span === 1 ? `08/${String(1 + i % 28).padStart(2,"0")}` : span === 5 ? `${1 + i % 12}周` : `${2022 + Math.floor(i/12)}/${String(1+i%12).padStart(2,"0")}` };
    });
    const ratio = endPrice / rows.at(-1).c;
    return rows.map((row) => ({ ...row, o: row.o * ratio, c: row.c * ratio, h: row.h * ratio, l: row.l * ratio }));
  }

  function canvasSize(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: rect.width, h: rect.height };
  }

  function mountChart() {
    const canvas = document.getElementById("market-chart");
    if (!canvas) return;
    const redraw = (point = null) => drawMarketChart(canvas, point);
    const pointAI = document.getElementById("chart-point-ai");
    let dragStart=null,longPressTimer=null,longPressActive=false,lastPoint=null;
    const clearLongPress=()=>{clearTimeout(longPressTimer);longPressTimer=null;};
    const setPointAI=(point)=>{
      if(!pointAI||AppState.chartTab!=="分时")return;
      const rect=canvas.getBoundingClientRect(),left=33,right=rect.width-34,morningRight=left+(right-left)/2;
      const ratio=Math.max(0,Math.min(1,(point.x-left)/(morningRight-left)));
      const totalMinutes=Math.round(ratio*120),hour=9+Math.floor((30+totalMinutes)/60),minute=(30+totalMinutes)%60;
      const time=`${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}`;
      const rows=denseTimeline(),index=Math.max(0,Math.min(rows.length-1,Math.round(ratio*(rows.length-1)))),row=rows[index];
      AppState.aiAnchor={index,time,price:row.price,average:row.average,volume:row.volume,changePct:(row.price/AppState.data.stock.prevClose-1)*100};
      pointAI.textContent=`${time} · 问财解读此处`;
      pointAI.style.left=`${Math.max(72,Math.min(rect.width-72,point.x))}px`;
      pointAI.classList.add("visible");
    };
    redraw();
    canvas.addEventListener("pointermove", e => {
      const r = canvas.getBoundingClientRect();
      const point={x:e.clientX-r.left,y:e.clientY-r.top};
      if(AppState.chartTab==="分时"){
        if(dragStart!==null&&Math.abs(e.clientX-dragStart)>8&&!longPressActive)clearLongPress();
        if(longPressActive){lastPoint=point;redraw(point);setPointAI(point);}
        return;
      }
      redraw(point);
    });
    canvas.addEventListener("pointerleave", () => {if(AppState.chartTab!=="分时")redraw();});
    canvas.addEventListener("wheel", event => {
      if(!["日K","周K","月K"].includes(AppState.chartTab))return;
      event.preventDefault();
      AppState.chartZoom=Math.max(1,Math.min(2.5,AppState.chartZoom+(event.deltaY<0?.2:-.2)));
      redraw();
    },{passive:false});
    canvas.addEventListener("contextmenu",event=>event.preventDefault());
    canvas.addEventListener("pointerdown",event=>{
      dragStart=event.clientX;canvas.setPointerCapture(event.pointerId);
      if(AppState.chartTab!=="分时")return;
      pointAI?.classList.remove("visible");
      const r=canvas.getBoundingClientRect(),point={x:event.clientX-r.left,y:event.clientY-r.top},morningRight=33+(r.width-34-33)/2;
      if(point.x<33||point.x>morningRight)return;
      clearLongPress();
      longPressTimer=setTimeout(()=>{longPressActive=true;lastPoint=point;redraw(point);setPointAI(point);if(navigator.vibrate)navigator.vibrate(18);},420);
    });
    canvas.addEventListener("pointerup",event=>{
      clearLongPress();
      if(longPressActive){longPressActive=false;dragStart=null;return;}
      if(dragStart===null)return;
      const delta=event.clientX-dragStart;
      if(Math.abs(delta)>18&&["日K","周K","月K"].includes(AppState.chartTab)){AppState.chartOffset=Math.max(0,Math.min(20,AppState.chartOffset+(delta>0?2:-2)));redraw();}
      dragStart=null;
    });
    canvas.addEventListener("pointercancel",()=>{clearLongPress();longPressActive=false;dragStart=null;if(lastPoint)redraw(lastPoint);});
    canvas.addEventListener("dblclick",event=>{
      if(AppState.chartTab!=="分时")return;
      const r=canvas.getBoundingClientRect(),point={x:event.clientX-r.left,y:event.clientY-r.top},morningRight=33+(r.width-34-33)/2;
      if(point.x<33||point.x>morningRight)return;
      lastPoint=point;redraw(point);setPointAI(point);
    });
  }

  function chartGrid(ctx, left, top, right, bottom, rows = 4, cols = 4) {
    ctx.strokeStyle = AppState.darkMarket ? "#2a3241" : "#e9eaed";
    ctx.lineWidth = .6;
    ctx.setLineDash([2, 2]);
    for (let i = 0; i <= rows; i++) {
      const y = top + (bottom - top) * i / rows;
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
    }
    for (let i = 0; i <= cols; i++) {
      const x = left + (right - left) * i / cols;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawMarketChart(canvas, pointer) {
    const {ctx,w,h} = canvasSize(canvas);
    ctx.clearRect(0,0,w,h);
    if (AppState.chartTab === "分时") drawMinute(ctx,w,h,pointer);
    else if (AppState.chartTab === "五日") drawFiveDay(ctx,w,h,pointer);
    else drawCandles(ctx,w,h,pointer);
  }

  function drawMinuteIndicator(ctx,rows,x,V,B,maxV) {
    if(AppState.indicator==="VOL"){
      rows.forEach((row,index)=>{const height=(B-V)*row.volume/maxV;ctx.fillStyle=index&&row.price<rows[index-1].price?"rgba(19,163,104,.74)":"rgba(239,67,67,.72)";ctx.fillRect(x(index),B-height,.8,height);});return;
    }
    const prices=rows.map(row=>row.price),ema=(values,period)=>values.reduce((out,value,index)=>{const factor=2/(period+1);out.push(index?value*factor+out[index-1]*(1-factor):value);return out;},[]);
    let lines=[];
    if(AppState.indicator==="MACD"){const e12=ema(prices,12),e26=ema(prices,26),dif=prices.map((_,index)=>e12[index]-e26[index]),dea=ema(dif,9);lines=[[dif,"#d99c1d"],[dea,"#7352b8"]];}
    if(AppState.indicator==="RSI"){const rsi=prices.map((_,index)=>{const window=prices.slice(Math.max(0,index-8),index+1);let gains=0,losses=0;for(let i=1;i<window.length;i++){const change=window[i]-window[i-1];change>=0?gains+=change:losses-=change;}return losses===0?78:100-100/(1+gains/losses);});lines=[[rsi,"#7352b8"]];}
    if(AppState.indicator==="KDJ"){let k=50,d=50;const values=prices.map((price,index)=>{const window=prices.slice(Math.max(0,index-8),index+1),high=Math.max(...window),low=Math.min(...window),rsv=high===low?50:(price-low)/(high-low)*100;k=k*2/3+rsv/3;d=d*2/3+k/3;return{k,d,j:3*k-2*d};});lines=[[values.map(item=>item.k),"#d99c1d"],[values.map(item=>item.d),"#2670d8"],[values.map(item=>item.j),"#8a55bd"]];}
    const values=lines.flatMap(line=>line[0]),min=Math.min(...values),max=Math.max(...values),range=Math.max(.001,max-min),y=value=>V+(max-value)/range*(B-V);
    lines.forEach(([items,color])=>{ctx.strokeStyle=color;ctx.lineWidth=.8;ctx.beginPath();items.forEach((value,index)=>index?ctx.lineTo(x(index),y(value)):ctx.moveTo(x(index),y(value)));ctx.stroke();});
  }

  function drawMinute(ctx,w,h,pointer) {
    const rows = denseTimeline(), prev = AppState.data.stock.prevClose;
    const L=33,R=w-34,M=L+(R-L)/2,T=10,P=Math.round(h*.64),V=P+17,B=h-19;
    const prices=rows.map(x=>x.price), deviation=Math.max(...prices.map(x=>Math.abs(x-prev)), 8)*1.08;
    const max=prev+deviation,min=prev-deviation,maxV=Math.max(...rows.map(x=>x.volume));
    const x=i=>L+(M-L)*i/(rows.length-1), y=v=>T+(max-v)/(max-min)*(P-T);
    chartGrid(ctx,L,T,R,P,4,4); chartGrid(ctx,L,V,R,B,2,4);
    ctx.strokeStyle=AppState.darkMarket?"#596274":"#b9bcc3";ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(L,y(prev));ctx.lineTo(R,y(prev));ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle="rgba(34,105,210,.08)";ctx.beginPath();ctx.moveTo(x(0),P);rows.forEach((r,i)=>ctx.lineTo(x(i),y(r.price)));ctx.lineTo(x(rows.length-1),P);ctx.closePath();ctx.fill();
    ctx.strokeStyle="#2670d8";ctx.lineWidth=1.25;ctx.beginPath();rows.forEach((r,i)=>i?ctx.lineTo(x(i),y(r.price)):ctx.moveTo(x(i),y(r.price)));ctx.stroke();
    ctx.strokeStyle="#e6a11a";ctx.lineWidth=1.05;ctx.beginPath();rows.forEach((r,i)=>i?ctx.lineTo(x(i),y(r.average)):ctx.moveTo(x(i),y(r.average)));ctx.stroke();
    drawMinuteIndicator(ctx,rows,x,V,B,maxV);
    ctx.font='9px "SFMono-Regular", monospace';ctx.textBaseline="top";
    [max,(max+prev)/2,prev,(min+prev)/2,min].forEach((v,i)=>{const yy=T+(P-T)*i/4;ctx.fillStyle=v>=prev?"#ef4343":"#13a368";ctx.textAlign="left";ctx.fillText(v.toFixed(2),1,yy-4);ctx.textAlign="right";ctx.fillText(`${((v/prev-1)*100).toFixed(2)}%`,w-1,yy-4);});
    ctx.fillStyle=AppState.darkMarket?"#8790a1":"#90949c";ctx.textAlign="left";ctx.fillText("09:30",L,B+4);ctx.textAlign="center";ctx.fillText("11:30/13:00",M,B+4);ctx.textAlign="right";ctx.fillText("15:00",R,B+4);
    if(pointer&&pointer.x>=L&&pointer.x<=M){const idx=Math.max(0,Math.min(rows.length-1,Math.round((pointer.x-L)/(M-L)*(rows.length-1))));const px=x(idx),py=y(rows[idx].price);ctx.strokeStyle="#6f737b";ctx.setLineDash([3,2]);ctx.beginPath();ctx.moveTo(px,T);ctx.lineTo(px,B);ctx.moveTo(L,py);ctx.lineTo(R,py);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle="#333";ctx.fillRect(Math.max(L,px-26),P-16,52,14);ctx.fillStyle="#fff";ctx.textAlign="center";ctx.fillText(rows[idx].price.toFixed(2),Math.max(L+26,Math.min(M-26,px)),P-14);const cta=document.getElementById("chart-point-ai");if(cta)cta.style.top=`${Math.max(46,Math.min(P-24,py+14))}px`;const read=document.getElementById("chart-readout");if(read)read.innerHTML=`<span class="${rows[idx].price>=prev?"rise":"fall"}">价 ${rows[idx].price.toFixed(2)}</span><span class="avg">均 ${rows[idx].average.toFixed(2)}</span><span>量 ${Math.round(rows[idx].volume)}</span><button class="ai-inline" data-action="ai-current">问财解盘</button>`;}
  }

  function drawFiveDay(ctx,w,h,pointer) {
    const current = AppState.data.stock;
    const L=34,R=w-34,T=10,P=Math.round(h*.72),B=h-18;
    const sessions = Array.from({length:5},(_,day)=>{
      const base=denseTimeline(day+1);
      const drift=(day-4)*current.prevClose*.006;
      return base.filter((_,index)=>index%5===0).map((point)=>({...point,price:point.price+drift,average:point.average+drift,day}));
    });
    const rows=sessions.flat(),prices=rows.map(row=>row.price),min=Math.min(...prices)*.997,max=Math.max(...prices)*1.003;
    const x=index=>L+(R-L)*index/(rows.length-1),y=value=>T+(max-value)/(max-min)*(P-T);
    chartGrid(ctx,L,T,R,P,4,5);
    sessions.forEach((session,day)=>{
      const start=day*session.length;
      ctx.strokeStyle="#2670d8";ctx.lineWidth=1.05;ctx.beginPath();
      session.forEach((point,index)=>index?ctx.lineTo(x(start+index),y(point.price)):ctx.moveTo(x(start),y(point.price)));ctx.stroke();
      ctx.strokeStyle="#e3a116";ctx.lineWidth=.8;ctx.beginPath();
      session.forEach((point,index)=>index?ctx.lineTo(x(start+index),y(point.average)):ctx.moveTo(x(start),y(point.average)));ctx.stroke();
    });
    ctx.font='9px "SFMono-Regular",monospace';ctx.fillStyle=AppState.darkMarket?"#8790a1":"#90949c";
    ["周一","周二","周三","周四","周五"].forEach((label,index)=>{ctx.textAlign="center";ctx.fillText(label,L+(R-L)*(index+.5)/5,B);});
    [max,(max+min)/2,min].forEach((value,index)=>{ctx.textAlign="left";ctx.fillStyle=value>=current.prevClose?"#ef4343":"#13a368";ctx.fillText(value.toFixed(2),1,T+(P-T)*index/2);});
    if(pointer&&pointer.x>=L&&pointer.x<=R){
      const idx=Math.max(0,Math.min(rows.length-1,Math.round((pointer.x-L)/(R-L)*(rows.length-1)))),point=rows[idx],px=x(idx),py=y(point.price);
      ctx.strokeStyle="#6f737b";ctx.setLineDash([3,2]);ctx.beginPath();ctx.moveTo(px,T);ctx.lineTo(px,P);ctx.moveTo(L,py);ctx.lineTo(R,py);ctx.stroke();ctx.setLineDash([]);
      const read=document.getElementById("chart-readout");if(read)read.innerHTML=`<span class="${point.price>=current.prevClose?"rise":"fall"}">五日价 ${point.price.toFixed(2)}</span><span class="avg">均 ${point.average.toFixed(2)}</span><span>第 ${point.day+1} 日</span><button class="ai-inline" data-action="ai-current">问财解盘</button>`;
    }
  }

  function indicatorSeries(rows) {
    const closes=rows.map(row=>row.c);
    const ema=(values,period)=>values.reduce((out,value,index)=>{const factor=2/(period+1);out.push(index?value*factor+out[index-1]*(1-factor):value);return out;},[]);
    const ema12=ema(closes,12),ema26=ema(closes,26),dif=closes.map((_,index)=>ema12[index]-ema26[index]),dea=ema(dif,9),macd=dif.map((value,index)=>(value-dea[index])*2);
    let k=50,d=50;const kdj=rows.map((row,index)=>{const window=rows.slice(Math.max(0,index-8),index+1),high=Math.max(...window.map(item=>item.h)),low=Math.min(...window.map(item=>item.l)),rsv=high===low?50:(row.c-low)/(high-low)*100;k=k*2/3+rsv/3;d=d*2/3+k/3;return{k,d,j:3*k-2*d};});
    const rsi=rows.map((_,index)=>{const window=rows.slice(Math.max(0,index-6),index+1);let gains=0,losses=0;for(let i=1;i<window.length;i++){const change=window[i].c-window[i-1].c;change>=0?gains+=change:losses-=change;}return losses===0?78:100-100/(1+gains/losses);});
    return {dif,dea,macd,kdj,rsi};
  }

  function drawIndicatorPanel(ctx,rows,L,R,V,B,step,x,maxV) {
    const type=AppState.indicator,series=indicatorSeries(rows);
    if(type==="VOL"){
      rows.forEach((row,index)=>{ctx.fillStyle=row.c>=row.o?"rgba(239,67,67,.75)":"rgba(19,163,104,.75)";ctx.fillRect(x(index)-step*.28,B-(B-V)*row.v/maxV,step*.56,(B-V)*row.v/maxV);});
      return;
    }
    if(type==="MACD"){
      const range=Math.max(...series.macd.map(Math.abs),...series.dif.map(Math.abs),.001),mid=(V+B)/2,y=value=>mid-value/range*(B-V)*.42;
      series.macd.forEach((value,index)=>{ctx.fillStyle=value>=0?"#ef4343":"#13a368";const yy=y(value);ctx.fillRect(x(index)-step*.2,Math.min(mid,yy),step*.4,Math.max(1,Math.abs(mid-yy)));});
      [[series.dif,"#d99c1d"],[series.dea,"#7155bd"]].forEach(([values,color])=>{ctx.strokeStyle=color;ctx.lineWidth=.8;ctx.beginPath();values.forEach((value,index)=>index?ctx.lineTo(x(index),y(value)):ctx.moveTo(x(index),y(value)));ctx.stroke();});
      return;
    }
    const lines=type==="KDJ"?[[series.kdj.map(item=>item.k),"#d99c1d"],[series.kdj.map(item=>item.d),"#2670d8"],[series.kdj.map(item=>item.j),"#8a55bd"]]:[[series.rsi,"#7352b8"]];
    const values=lines.flatMap(line=>line[0]),min=Math.min(...values,0),max=Math.max(...values,100),y=value=>V+(max-value)/(max-min)*(B-V);
    lines.forEach(([items,color])=>{ctx.strokeStyle=color;ctx.lineWidth=.9;ctx.beginPath();items.forEach((value,index)=>index?ctx.lineTo(x(index),y(value)):ctx.moveTo(x(index),y(value)));ctx.stroke();});
    ctx.strokeStyle=AppState.darkMarket?"#3e4657":"#e3e4e8";ctx.setLineDash([2,2]);[30,70].forEach(value=>{ctx.beginPath();ctx.moveTo(L,y(value));ctx.lineTo(R,y(value));ctx.stroke();});ctx.setLineDash([]);
  }

  function drawCandles(ctx,w,h,pointer) {
    const allRows=generatedKlines(),visible=Math.max(17,Math.round(allRows.length/AppState.chartZoom)),end=Math.max(visible,allRows.length-AppState.chartOffset),rows=allRows.slice(Math.max(0,end-visible),end),L=8,R=w-34,T=10,P=Math.round(h*.66),V=P+16,B=h-19;
    const min=Math.min(...rows.map(x=>x.l)),max=Math.max(...rows.map(x=>x.h)),maxV=Math.max(...rows.map(x=>x.v));
    const step=(R-L)/rows.length,x=i=>L+step*(i+.5),y=v=>T+(max-v)/(max-min)*(P-T);
    chartGrid(ctx,L,T,R,P,4,4);chartGrid(ctx,L,V,R,B,2,4);
    rows.forEach((r,i)=>{const up=r.c>=r.o,color=up?"#ef4343":"#13a368",xx=x(i);ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(xx,y(r.h));ctx.lineTo(xx,y(r.l));ctx.stroke();ctx.fillStyle=color;const yy=Math.min(y(r.o),y(r.c)),hh=Math.max(1,Math.abs(y(r.o)-y(r.c)));ctx.fillRect(xx-step*.28,yy,step*.56,hh);});
    drawIndicatorPanel(ctx,rows,L,R,V,B,step,x,maxV);
    const ma=n=>rows.map((_,i)=>i<n-1?null:rows.slice(i-n+1,i+1).reduce((s,r)=>s+r.c,0)/n);
    [[5,"#e1a318"],[10,"#7d68c7"],[20,"#2690c9"]].forEach(([n,color])=>{ctx.strokeStyle=color;ctx.lineWidth=.9;ctx.beginPath();ma(n).forEach((v,i)=>{if(v===null)return;const xx=x(i),yy=y(v);i===n-1?ctx.moveTo(xx,yy):ctx.lineTo(xx,yy)});ctx.stroke();});
    ctx.font='9px "SFMono-Regular", monospace';ctx.fillStyle=AppState.darkMarket?"#8790a1":"#8b9098";ctx.textAlign="right";ctx.fillText(max.toFixed(2),w-1,T);ctx.fillText(((max+min)/2).toFixed(2),w-1,(T+P)/2);ctx.fillText(min.toFixed(2),w-1,P-5);ctx.textAlign="left";ctx.fillText(rows[0].d,L,B+4);ctx.textAlign="center";ctx.fillText(rows[Math.floor(rows.length/2)].d,(L+R)/2,B+4);ctx.textAlign="right";ctx.fillText(rows.at(-1).d,R,B+4);
    if(pointer&&pointer.x>=L&&pointer.x<=R){const idx=Math.max(0,Math.min(rows.length-1,Math.floor((pointer.x-L)/step)));ctx.strokeStyle="#6f737b";ctx.setLineDash([3,2]);ctx.beginPath();ctx.moveTo(x(idx),T);ctx.lineTo(x(idx),B);ctx.stroke();ctx.setLineDash([]);const r=rows[idx],read=document.getElementById("chart-readout");if(read)read.innerHTML=`<span>开 ${r.o.toFixed(2)}</span><span class="${r.c>=r.o?"rise":"fall"}">收 ${r.c.toFixed(2)}</span><span>高 ${r.h.toFixed(2)} 低 ${r.l.toFixed(2)}</span><button class="ai-inline" data-action="ai-current">问财解盘</button>`;}
  }

  function viewCacheKey(view) {
    if(view==="quote"||view==="ai")return `${view}:${AppState.selectedSymbol}`;
    if(view==="watch")return `${view}:${AppState.watchSort}`;
    if(view==="news")return `${view}:${AppState.newsTab}`;
    return view;
  }

  function quickViewData(view) {
    if(view==="quote"||view==="ai")return StockAPI.getLocalQuote(AppState.selectedSymbol);
    if(view==="home")return {indices:MOCK_DB.indices,watchlist:MOCK_DB.watchlist,sectors:MOCK_DB.sectors};
    if(view==="watch")return [...MOCK_DB.watchlist].sort((a,b)=>AppState.watchSort==="rise"?b.pct-a.pct:AppState.watchSort==="fall"?a.pct-b.pct:0);
    if(view==="market")return {indices:MOCK_DB.indices,sectors:MOCK_DB.sectors,rankings:MOCK_DB.watchlist};
    if(view==="news")return MOCK_DB.news;
    if(view==="trade")return MOCK_DB.portfolio;
    return {};
  }

  async function loadView(view, nav=view) {
    if(view==="profile"){AppState.set({view,activeNav:nav,loading:false,error:"",data:{}});return;}
    const cacheKey=viewCacheKey(view),cached=viewCache.get(cacheKey);
    AppState.set({view,activeNav:nav,loading:false,error:"",data:cached?.data||quickViewData(view)});
    viewport.scrollTop=0;
    if(cached&&Date.now()-cached.at<viewCacheTtl)return;
    try {
      let response;
      if(view==="quote") response=await StockAPI.fetchQuoteDetail(AppState.selectedSymbol);
      if(view==="home") response=await StockAPI.fetchMarketHome();
      if(view==="watch") response=await StockAPI.fetchWatchlist({sort:AppState.watchSort});
      if(view==="market") response=await StockAPI.fetchMarketOverview();
      if(view==="news") response=await StockAPI.fetchNews({tab:AppState.newsTab});
      if(view==="ai") response=await StockAPI.fetchQuoteDetail(AppState.selectedSymbol);
      if(view==="trade") response=await StockAPI.fetchPortfolio();
      if(!response||response.code!==0) throw new Error(response?.message||"行情返回异常");
      viewCache.set(cacheKey,{data:response.data,at:Date.now()});
      if(AppState.view===view&&viewCacheKey(view)===cacheKey)AppState.set({loading:false,data:response.data});
    } catch(error) {
      console.warn("[View] 后台刷新失败，继续使用本地快照：",error.message);
    }
  }

  function toast(message) {
    toastRoot.innerHTML=`<div class="toast">${message}</div>`;
    clearTimeout(toast.timer);toast.timer=setTimeout(()=>toastRoot.innerHTML="",1800);
  }

  function openSearchPage() {
    if(AppState.view!=="search"){AppState.searchReturnView=AppState.view;AppState.searchReturnNav=AppState.activeNav;}
    AppState.set({view:"search",loading:false,error:"",data:MOCK_DB.watchlist});
    requestAnimationFrame(()=>document.getElementById("app-search")?.focus());
  }

  function renderSearchPage(rows) {
    return `<div class="screen mobile-search">
      <header><button data-action="search-back">${I.back}</button><label>${I.search}<input id="app-search" autocomplete="off" placeholder="股票名称、代码或题材" autofocus></label><button data-action="search-back">取消</button></header>
      <section class="search-suggest"><b>热门搜索</b><div>${rows.slice(0,8).map((item)=>`<button data-stock="${item.symbol}">${item.name}</button>`).join("")}</div></section>
      <section><div class="search-section-title">股票</div><div id="app-search-results" class="search-results">${renderSearchResults(rows)}</div></section>
    </div>`;
  }

  function renderSearchResults(rows) {
    if(!rows.length)return `<div class="empty-inline">没有找到匹配的 A 股</div>`;
    return rows.map((item)=>`<button data-stock="${item.symbol}">
      <span><b>${item.name}</b><small>${item.symbol}.${item.market} · ${item.reason}</small></span>
      <strong class="${tone(item.pct)}">${item.price.toFixed(2)}</strong><em class="${tone(item.pct)}">${fmtPct(item.pct)}</em>
    </button>`).join("");
  }

  function prepareStockInsight(symbol) {
    if(stockInsightCache.has(symbol))return stockInsightCache.get(symbol);
    const data=StockAPI.getLocalQuote(symbol);
    const insight={data,analysis:getAnalysis(data),preparedAt:Date.now()};
    stockInsightCache.set(symbol,insight);
    return insight;
  }

  function warmStockInsights() {
    MOCK_DB.watchlist.forEach((item,index)=>{
      setTimeout(()=>prepareStockInsight(item.symbol),index*24);
    });
  }

  function goToWencai(anchor = null, question = "") {
    clearTimeout(goToWencai.timer);
    AppState.wencaiContextMode="stock";
    AppState.aiContextAnchor=anchor;
    const sourceData=AppState.data,analysis=getAnalysis(sourceData,anchor);
    const prompt=question||composeWencaiPrompt(sourceData,anchor);
    const key=`stock:${sourceData.stock.symbol}`,existing=AppState.stockThreads[key]||[];
    AppState.activeThreadKey=key;
    if(!AppState.wencaiThreads.some(thread=>thread.key===key))AppState.wencaiThreads=[{id:Date.now(),key,symbol:sourceData.stock.symbol,title:`${sourceData.stock.name}盘面解读`,time:"刚刚"},...AppState.wencaiThreads].slice(0,8);
    const userMessage={role:"user",content:prompt,id:`m${Date.now()}`};
    AppState.wencaiMessages=[...existing,userMessage];
    AppState.stockThreads[key]=AppState.wencaiMessages;
    AppState.wencaiThinking=true;
    AppState.wencaiThinkingType="analysis";
    AppState.wencaiStreamText="";
    const requestId=++AppState.wencaiRequestId;
    wencaiController?.abort();wencaiController=new AbortController();
    const externalRequest=StockAPI.askWencai({conversationId:key,symbol:sourceData.stock.symbol,prompt,history:existing.filter(item=>item.role==="user").map(item=>({role:"user",content:item.content})),context:{asOf:"11:30",stock:sourceData.stock,timeline:sourceData.timeline,indicators:analysis.indicators,indices:MOCK_DB.indices,sectors:MOCK_DB.sectors},intent:"analysis",signal:wencaiController.signal,onDelta:(delta)=>{if(requestId!==AppState.wencaiRequestId)return;AppState.wencaiStreamText+=delta;}}).catch(()=>({code:-1,data:null}));
    loadView("ai","ai");
    goToWencai.timer=setTimeout(()=>{
      if(requestId!==AppState.wencaiRequestId)return;
      const updated=[...(AppState.stockThreads[key]||[]),buildWencaiResponse(prompt,sourceData,analysis,"","analysis")];
      AppState.stockThreads[key]=updated;
      if(AppState.activeThreadKey===key){AppState.wencaiMessages=updated;AppState.wencaiThinking=false;AppState.wencaiStreamText="";AppState.set({wencaiMessages:updated,wencaiThinking:false,wencaiStreamText:""});focusWencaiMessage(userMessage.id);}
    },850);
    externalRequest.then((external)=>{
      if(!external?.data?.text)return;
      const thread=AppState.stockThreads[key]||[];
      const last=thread.at(-1);
      if(last?.role==="assistant"){last.llmText=external.data.text;persistWencaiState();}
    });
  }

  function submitWencaiQuestion(question) {
    const text=question.trim();if(!text)return;
    clearTimeout(goToWencai.timer);
    const mentionedStock=MOCK_DB.watchlist.find(item=>text.includes(item.name)||text.includes(item.symbol));
    if(AppState.wencaiContextMode==="generic"&&mentionedStock){
      AppState.selectedSymbol=mentionedStock.symbol;
      AppState.wencaiContextMode="stock";
      AppState.data=StockAPI.getLocalQuote(mentionedStock.symbol);
    }
    const sourceData=AppState.data,analysis=getAnalysis(sourceData,AppState.aiContextAnchor);
    const intent=classifyQuestion(text);
    const needsStock=["analysis","indicator","holding","trade_plan","forecast","signal","sector"].includes(intent);
    const effectiveIntent=AppState.wencaiContextMode==="generic"&&needsStock?"general":intent;
    const isNewThread=!AppState.activeThreadKey;
    const key=AppState.activeThreadKey||(AppState.wencaiContextMode==="stock"?`stock:${sourceData.stock.symbol}:${Date.now()}`:`chat:${Date.now()}`),userMessage={role:"user",content:text,id:`m${Date.now()}`};
    AppState.activeThreadKey=key;
    if(isNewThread)AppState.wencaiThreads=[{id:Date.now(),key,symbol:AppState.wencaiContextMode==="stock"?sourceData.stock.symbol:"",title:AppState.wencaiContextMode==="stock"?`${sourceData.stock.name}新对话`:"问财新对话",time:"刚刚"},...AppState.wencaiThreads].slice(0,8);
    AppState.wencaiMessages=[...AppState.wencaiMessages,userMessage];
    AppState.stockThreads[key]=AppState.wencaiMessages;
    AppState.wencaiThinking=true;
    AppState.wencaiThinkingType=effectiveIntent;
    AppState.wencaiStreamText="";
    AppState.set({wencaiMessages:AppState.wencaiMessages,wencaiThinking:true,wencaiThinkingType:effectiveIntent,wencaiStreamText:""});
    focusWencaiMessage(userMessage.id);
    const requestId=++AppState.wencaiRequestId;
    wencaiController?.abort();wencaiController=new AbortController();
    const stockContext=AppState.wencaiContextMode==="stock";
    const externalRequest=StockAPI.askWencai({conversationId:key,symbol:stockContext?sourceData.stock.symbol:"",prompt:text,history:AppState.wencaiMessages.filter(item=>item.role==="user").slice(-8).map(item=>({role:"user",content:item.content})),context:stockContext?{asOf:"11:30",stock:sourceData.stock,timeline:sourceData.timeline,indicators:analysis.indicators,indices:MOCK_DB.indices,sectors:MOCK_DB.sectors}:{asOf:"11:30",indices:MOCK_DB.indices,sectors:MOCK_DB.sectors},intent:effectiveIntent,signal:wencaiController.signal,onDelta:(delta)=>{if(requestId!==AppState.wencaiRequestId)return;AppState.wencaiStreamText+=delta;}}).catch(()=>({code:-1,data:null}));
    clearTimeout(submitWencaiQuestion.timer);
    submitWencaiQuestion.timer=setTimeout(async()=>{
      const external=await externalRequest;
      if(requestId!==AppState.wencaiRequestId)return;
      const updated=[...(AppState.stockThreads[key]||[]),buildWencaiResponse(text,sourceData,analysis,external?.data?.text||"",effectiveIntent)];
      AppState.stockThreads[key]=updated;
      if(AppState.activeThreadKey===key){AppState.wencaiMessages=updated;AppState.wencaiThinking=false;AppState.wencaiStreamText="";AppState.set({wencaiMessages:updated,wencaiThinking:false,wencaiStreamText:""});focusWencaiMessage(userMessage.id);}
    },["greeting","help","general","event","data_gap"].includes(effectiveIntent)?1000:1400);
  }

  function focusWencaiMessage(messageId) {
    requestAnimationFrame(()=>document.getElementById(messageId)?.scrollIntoView({block:"start",behavior:"smooth"}));
  }

  function openTradeModal(side = "买入") {
    const stock = AppState.data?.stock || MOCK_DB.stock;
    modalRoot.innerHTML=`<div class="modal-backdrop" data-action="close-modal"><form class="trade-modal" id="trade-form">
      <div class="modal-title"><b>${side} ${stock.name}</b><button type="button" data-action="close-modal">×</button></div>
      <label>委托价格<div><button type="button" data-step="-1">−</button><input name="price" value="${stock.price.toFixed(2)}" inputmode="decimal"><button type="button" data-step="1">＋</button></div></label>
      <label>委托数量<div><button type="button" data-step="-100">−</button><input name="amount" value="100" inputmode="numeric"><button type="button" data-step="100">＋</button></div></label>
      <p>可买 300 股&nbsp;&nbsp; 预计金额 ${(stock.price*100).toLocaleString("zh-CN",{minimumFractionDigits:2})} 元</p><div id="trade-error" class="form-error"></div>
      <button class="confirm-buy ${side === "卖出" ? "sell-confirm" : ""}" type="submit">确认${side}</button><small>AI 仅预填委托，最终操作由用户确认</small>
    </form></div>`;
  }

  app.addEventListener("click", event => {
    const jump=event.target.closest("[data-nav-jump]");if(jump)return loadView(jump.dataset.navJump);
    const skillButton=event.target.closest("[data-skill-prompt]");if(skillButton){const prompt=skillButton.dataset.skillPrompt;AppState.wencaiSkillsOpen=false;AppState.set({wencaiSkillsOpen:false});requestAnimationFrame(()=>{const input=app.querySelector('#wencai-form textarea');if(input){input.value=prompt;input.focus();}});return;}
    const threadButton=event.target.closest("[data-thread]");if(threadButton){const thread=AppState.wencaiThreads.find(item=>String(item.id)===threadButton.dataset.thread);if(!thread)return;if(thread.symbol)AppState.selectedSymbol=thread.symbol;AppState.wencaiContextMode=thread.symbol?"stock":"generic";AppState.activeThreadKey=thread.key;AppState.wencaiMessages=AppState.stockThreads[thread.key]||[];AppState.wencaiThinking=false;AppState.wencaiHistoryOpen=false;return loadView("ai","ai");}
    const promptButton=event.target.closest("[data-wencai-prompt]");if(promptButton){AppState.aiContextAnchor=null;return submitWencaiQuestion(promptButton.dataset.wencaiPrompt);}
    const question=event.target.closest("[data-ai-question]");if(question){AppState.aiContextAnchor=null;return submitWencaiQuestion(question.dataset.aiQuestion);}
    const stock=event.target.closest("[data-stock]");if(stock){AppState.selectedSymbol=stock.dataset.stock;AppState.aiAnchor=null;AppState.holdingOverride=null;return loadView("quote","market");}
    const chart=event.target.closest("[data-chart-tab]");if(chart){const tab=chart.dataset.chartTab;if(tab==="更多")return toast("支持1分、5分、15分、30分、60分");AppState.aiAnchor=null;AppState.set({chartTab:tab});return;}
    const detail=event.target.closest("[data-detail-tab]");if(detail)return AppState.set({detailTab:detail.dataset.detailTab});
    const panel=event.target.closest("[data-quote-panel]");if(panel)return AppState.set({quotePanel:panel.dataset.quotePanel});
    const indicator=event.target.closest("[data-indicator]");if(indicator)return AppState.set({indicator:indicator.dataset.indicator});
    const sort=event.target.closest("[data-sort]");if(sort){AppState.watchSort=sort.dataset.sort;return loadView("watch");}
    const newsTab=event.target.closest("[data-news-tab]");if(newsTab){AppState.newsTab=newsTab.dataset.newsTab;return loadView("news");}
    const action=event.target.closest("[data-action]");if(!action)return;
    const name=action.dataset.action;
    if(name==="market-overview")loadView("market");
    else if(name==="toggle-watch"){AppState.set({watchlisted:!AppState.watchlisted});toast(AppState.watchlisted?"已加入自选":"已从自选移除");}
    else if(name==="open-trade"||name==="login")openTradeModal(action.classList.contains("sell")||action.textContent.includes("卖")?"卖出":"买入");
    else if(name==="search")openSearchPage();
    else if(name==="search-back")loadView(AppState.searchReturnView,AppState.searchReturnNav);
    else if(name==="toggle-theme"){AppState.darkMarket=!AppState.darkMarket;AppState.set({darkMarket:AppState.darkMarket});}
    else if(name==="ai-current")goToWencai();
    else if(name==="ai-point")goToWencai(AppState.aiAnchor);
    else if(name==="ask-ai")goToWencai();
    else if(name==="wencai-new"){clearTimeout(goToWencai.timer);clearTimeout(submitWencaiQuestion.timer);wencaiController?.abort();AppState.wencaiRequestId+=1;AppState.wencaiContextMode="generic";AppState.activeThreadKey="";AppState.aiContextAnchor=null;AppState.wencaiMessages=[];AppState.wencaiThinking=false;AppState.wencaiHistoryOpen=false;AppState.set({wencaiMessages:[],wencaiThinking:false,wencaiHistoryOpen:false});}
    else if(name==="wencai-history"){AppState.wencaiHistoryOpen=!AppState.wencaiHistoryOpen;AppState.set({wencaiHistoryOpen:AppState.wencaiHistoryOpen});}
    else if(name==="wencai-skills"){AppState.wencaiSkillsOpen=!AppState.wencaiSkillsOpen;AppState.set({wencaiSkillsOpen:AppState.wencaiSkillsOpen});}
    else if(name==="cancel-wencai"){clearTimeout(goToWencai.timer);clearTimeout(submitWencaiQuestion.timer);wencaiController?.abort();AppState.wencaiRequestId+=1;AppState.wencaiThinking=false;AppState.wencaiStreamText="";AppState.set({wencaiThinking:false,wencaiStreamText:""});toast("已停止生成");}
    else if(name==="clear-ai-anchor"){AppState.aiContextAnchor=null;AppState.aiAnchor=null;AppState.set({aiContextAnchor:null,aiAnchor:null});toast("已切换为当前盘面");}
    else if(name==="set-signal")toast("异动提醒已添加，将在触发关键条件时通知");
    else if(name==="wencai-buy")openTradeModal("买入");
    else if(name==="wencai-sell")openTradeModal("卖出");
    else if(name==="ai-trade"){
      const analysis=getAnalysis(AppState.data);
      ["去买入","加仓","减仓","去卖出"].includes(analysis.actionLabel)?openTradeModal(["减仓","去卖出"].includes(analysis.actionLabel)?"卖出":"买入"):toast(`${analysis.actionLabel}：已为你设置关键价位提醒`);
    }
    else if(name==="retry")loadView(AppState.view,AppState.activeNav);
    else if(name==="close-modal")modalRoot.innerHTML="";
    else toast(action.dataset.message||({diagnose:"综合诊断 78 分：趋势偏强",alert:"已开启价格异动提醒",more:"更多行情工具",message:"暂无未读消息","chart-settings":"图表参数设置","expand-chart":"横屏看盘功能演示","news-detail":"资讯详情功能演示","index-detail":"指数详情功能演示",settings:"设置功能演示",privacy:"资产金额已隐藏"}[name]||"功能演示"));
  });

  app.addEventListener("input", event => {
    if(event.target.id==="app-search"){
      const query=event.target.value.trim().toLowerCase(),rows=MOCK_DB.watchlist.filter(item=>`${item.name}${item.symbol}${item.reason}`.toLowerCase().includes(query));
      const target=app.querySelector("#app-search-results");if(target)target.innerHTML=renderSearchResults(rows);return;
    }
    if(event.target.id!=="watch-search")return;
    AppState.searchQuery=event.target.value;
    const q=AppState.searchQuery.trim().toLowerCase(),rows=(AppState.data||[]).filter(x=>`${x.name}${x.symbol}`.toLowerCase().includes(q));
    const table=app.querySelector(".stock-table,.empty-inline");if(table)table.outerHTML=renderStockRows(rows);
  });

  app.addEventListener("submit",event=>{
    if(event.target.id==="wencai-form"){
      event.preventDefault();const input=event.target.question;submitWencaiQuestion(input.value);input.value="";
    }
  });

  document.querySelector(".bottom-nav").addEventListener("click",event=>{const button=event.target.closest("[data-nav]");if(!button)return;if(button.dataset.nav==="ai"){clearTimeout(goToWencai.timer);clearTimeout(submitWencaiQuestion.timer);wencaiController?.abort();AppState.wencaiRequestId+=1;AppState.wencaiContextMode="generic";AppState.activeThreadKey="";AppState.wencaiMessages=[];AppState.wencaiThinking=false;AppState.wencaiStreamText="";AppState.aiContextAnchor=null;AppState.wencaiHistoryOpen=false;AppState.wencaiSkillsOpen=false;}loadView(button.dataset.nav);});
  modalRoot.addEventListener("click",event=>{
    const searchStock=event.target.closest("[data-search-stock]");
    if(searchStock){AppState.selectedSymbol=searchStock.dataset.searchStock;AppState.aiAnchor=null;AppState.holdingOverride=null;modalRoot.innerHTML="";loadView("quote","market");return;}
    const action=event.target.closest("[data-action]");
    if(action?.dataset.action==="ai-trade"){
      const analysis=getAnalysis(AppState.data,AppState.aiAnchor);
      modalRoot.innerHTML="";
      ["去买入","加仓","减仓","去卖出"].includes(analysis.actionLabel)?openTradeModal(["减仓","去卖出"].includes(analysis.actionLabel)?"卖出":"买入"):toast(`${analysis.actionLabel}：已为你设置关键价位提醒`);
      return;
    }
    if(event.target.classList.contains("modal-backdrop"))modalRoot.innerHTML="";
    const close=event.target.closest('[data-action="close-modal"]');if(close)modalRoot.innerHTML="";
  });
  modalRoot.addEventListener("input",event=>{
    if(event.target.id!=="global-search")return;
    const query=event.target.value.trim().toLowerCase();
    const rows=MOCK_DB.watchlist.filter((item)=>`${item.name}${item.symbol}${item.reason}`.toLowerCase().includes(query));
    const target=modalRoot.querySelector("#global-search-results");if(target)target.innerHTML=renderSearchResults(rows);
  });
  modalRoot.addEventListener("submit",event=>{
    event.preventDefault();
    const amount=Number(event.target.amount.value);if(!amount||amount%100){event.target.querySelector("#trade-error").textContent="委托数量必须为100股的整数倍";return;}modalRoot.innerHTML="";toast("模拟委托已提交");
  });
  modalRoot.addEventListener("click",event=>{const step=event.target.closest("[data-step]");if(!step)return;const input=step.parentElement.querySelector("input");const delta=Number(step.dataset.step);input.value=(Number(input.value)+delta).toFixed(Math.abs(delta)===1?2:0);});

  function persistWencaiState(){
    try{localStorage.setItem("lele-ai-trading-state",JSON.stringify({stockThreads:AppState.stockThreads,wencaiThreads:AppState.wencaiThreads}));}catch(_){}
  }
  AppState.subscribe(()=>{persistWencaiState();render();});
  clock();
  setTimeout(()=>{AppState.aiReady=true;updateNav();},8500);
  loadView("quote","market");
  setTimeout(warmStockInsights,120);
})();
