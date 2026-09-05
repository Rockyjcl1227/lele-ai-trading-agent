(function () {
  const app = document.getElementById("app-content");
  const modalRoot = document.getElementById("modal-root");
  const toastRoot = document.getElementById("toast-root");

  const icons = {
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 3 6.2 6.8 1-4.9 4.8 1.2 6.8-6.1-3.2-6.1 3.2 1.2-6.8-4.9-4.8 6.8-1Z"/></svg>',
    starred: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 2 3 6.2 6.8 1-4.9 4.8 1.2 6.8-6.1-3.2-6.1 3.2 1.2-6.8-4.9-4.8 6.8-1Z"/></svg>',
    retry: '<svg class="empty-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6.1 9a7 7 0 0 1 11.5-2L20 12M4 12l2.4 5a7 7 0 0 0 11.5-2"/></svg>',
    empty: '<svg class="empty-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM8 9h8M8 13h5"/></svg>',
    calendar: '<svg viewBox="0 0 24 24"><path d="M5 4h14a1 1 0 0 1 1 1v15H4V5a1 1 0 0 1 1-1ZM8 2v4M16 2v4M4 9h16"/></svg>',
    bolt: '<svg viewBox="0 0 24 24"><path d="m13 2-9 12h8l-1 8 9-12h-8Z"/></svg>',
    chart: '<svg viewBox="0 0 24 24"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>',
    alert: '<svg viewBox="0 0 24 24"><path d="M12 3 2 20h20L12 3Zm0 6v5m0 3h.01"/></svg>'
  };

  function fmtPct(value) {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  }

  function priceClass(value) {
    return value >= 0 ? "rise" : "fall";
  }

  function setClock() {
    const now = new Date();
    document.getElementById("system-time").textContent =
      `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }

  function updateNav() {
    document.querySelectorAll("[data-nav]").forEach((button) => {
      const active = button.dataset.nav === AppState.activeNav;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  }

  function loadingView() {
    return `<div class="view"><div class="topbar"><h1>行情加载中</h1><small>实时数据</small></div>
      <div class="state-panel"><div class="skeleton" aria-label="加载中">
        <div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div>
        <div class="skeleton-line"></div><div class="skeleton-line"></div>
      </div></div></div>`;
  }

  function errorView(message) {
    return `<div class="view"><div class="topbar"><h1>数据服务</h1></div>
      <div class="state-panel"><div>${icons.retry}<h2>暂时无法加载</h2>
      <p>${message || "行情服务开小差了，请稍后再试"}</p>
      <button class="action-button primary" data-action="retry">重新加载</button></div></div></div>`;
  }

  function drawTimeline(points) {
    const width = 388, priceTop = 8, priceBottom = 142, volumeTop = 157, volumeBottom = 194;
    const prices = points.flatMap((p) => [p.price, p.average]);
    const min = Math.min(...prices) - 2, max = Math.max(...prices) + 2;
    const maxVolume = Math.max(...points.map((p) => p.volume));
    const x = (i) => 26 + i * (width - 52) / (points.length - 1);
    const y = (value) => priceBottom - (value - min) / (max - min) * (priceBottom - priceTop);
    const line = points.map((p, i) => `${x(i)},${y(p.price)}`).join(" ");
    const average = points.map((p, i) => `${x(i)},${y(p.average)}`).join(" ");
    const area = `M${x(0)},${priceBottom} L${points.map((p, i) => `${x(i)},${y(p.price)}`).join(" L")} L${x(points.length - 1)},${priceBottom} Z`;
    const bars = points.map((p, i) => {
      const h = p.volume / maxVolume * (volumeBottom - volumeTop);
      const cls = i === 0 || p.price >= points[i - 1].price ? "volume-up" : "volume-down";
      return `<rect class="${cls}" x="${x(i) - 4}" y="${volumeBottom - h}" width="7" height="${h}"/>`;
    }).join("");
    return `<svg viewBox="0 0 ${width} 202" role="img" aria-label="贵州茅台分时价格与成交量图">
      <defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f04444" stop-opacity=".16"/><stop offset="1" stop-color="#f04444" stop-opacity=".01"/></linearGradient></defs>
      <path class="chart-grid" d="M26 8H362M26 42H362M26 75H362M26 109H362M26 142H362M26 157H362M26 194H362"/>
      <path class="chart-grid" d="M26 8V194M110 8V194M194 8V194M278 8V194M362 8V194"/>
      <path class="chart-zero" d="M26 ${y(MOCK_DB.stock.prevClose)}H362"/>
      <path class="area-fill" d="${area}"/><polyline class="chart-line" points="${line}"/><polyline class="avg-line" points="${average}"/>
      ${bars}
      <text class="axis-label" x="2" y="13">${max.toFixed(0)}</text><text class="axis-label" x="2" y="145">${min.toFixed(0)}</text>
      <text class="axis-label" x="26" y="201">09:30</text><text class="axis-label" x="180" y="201">11:30/13:00</text><text class="axis-label" x="335" y="201">15:00</text>
    </svg>`;
  }

  function drawKline(rows) {
    const width = 388, top = 8, bottom = 156, volumeTop = 165, volumeBottom = 194;
    const min = Math.min(...rows.map((r) => r.l)) - 5, max = Math.max(...rows.map((r) => r.h)) + 5;
    const maxV = Math.max(...rows.map((r) => r.v));
    const y = (v) => bottom - (v - min) / (max - min) * (bottom - top);
    const candle = rows.map((r, i) => {
      const x = 30 + i * 34;
      const up = r.c >= r.o;
      const cls = up ? "volume-up" : "volume-down";
      const color = up ? "#f04444" : "#14a06f";
      const bodyY = Math.min(y(r.o), y(r.c));
      const bodyH = Math.max(2, Math.abs(y(r.o) - y(r.c)));
      const vh = r.v / maxV * (volumeBottom - volumeTop);
      return `<path d="M${x} ${y(r.h)}V${y(r.l)}" stroke="${color}"/><rect x="${x - 7}" y="${bodyY}" width="14" height="${bodyH}" fill="${color}"/><rect class="${cls}" x="${x - 7}" y="${volumeBottom - vh}" width="14" height="${vh}"/>`;
    }).join("");
    return `<svg viewBox="0 0 ${width} 202" role="img" aria-label="贵州茅台日K线图">
      <path class="chart-grid" d="M20 8H374M20 45H374M20 82H374M20 119H374M20 156H374M20 165H374M20 194H374"/>
      ${candle}
      <text class="axis-label" x="1" y="13">${max.toFixed(0)}</text><text class="axis-label" x="1" y="158">${min.toFixed(0)}</text>
      <text class="axis-label" x="23" y="201">08/25</text><text class="axis-label" x="175" y="201">09/01</text><text class="axis-label" x="336" y="201">09/05</text>
    </svg>`;
  }

  function renderQuote(data) {
    const s = data.stock;
    const chart = AppState.chartTab === "分时" ? drawTimeline(data.timeline) : drawKline(data.kline);
    const bookRows = data.orderBook.map((row) => `<div class="data-row">
      <span>${row.side}${row.level}</span><span class="${row.side === "卖" ? "rise" : "fall"}">${row.price.toFixed(2)}</span><span>${row.volume}</span>
    </div>`).join("");
    const tradeRows = data.trades.map((row) => `<div class="data-row">
      <span>${row.time.slice(0,5)}</span><span class="${row.direction === "buy" ? "rise" : "fall"}">${row.price.toFixed(2)}</span><span>${row.volume}</span>
    </div>`).join("");
    return `<div class="view quote-view">
      <header class="topbar">
        <button class="icon-button" data-action="market-overview" aria-label="返回行情">${icons.back}</button>
        <h1>${s.name}</h1>
        <button class="icon-button ${AppState.watchlisted ? "rise" : ""}" data-action="toggle-watch" aria-label="${AppState.watchlisted ? "取消自选" : "加入自选"}">${AppState.watchlisted ? icons.starred : icons.star}</button>
      </header>
      <section class="quote-hero">
        <div class="quote-title"><strong>${s.name}</strong><span>${s.symbol}.${s.market}</span><span class="badge">沪股通</span></div>
        <div class="quote-main"><span class="quote-price">${s.price.toFixed(2)}</span><span class="quote-change">+${s.change.toFixed(2)}<br>+${s.changePct.toFixed(2)}%</span></div>
        <div class="quote-stats">
          <span>今开 <b>${s.open.toFixed(2)}</b></span><span>最高 <b class="rise">${s.high.toFixed(2)}</b></span><span>换手 <b>${s.turnover}%</b></span><span>成交量 <b>${s.volume}</b></span>
          <span>昨收 <b>${s.prevClose.toFixed(2)}</b></span><span>最低 <b class="fall">${s.low.toFixed(2)}</b></span><span>市盈率 <b>${s.pe}</b></span><span>成交额 <b>${s.amount}</b></span>
        </div>
      </section>
      <section class="section">
        <div class="tabs" role="tablist" aria-label="行情图表">
          ${["分时","日K","周K","月K","资金","资讯"].map((tab) => `<button role="tab" aria-selected="${AppState.chartTab === tab}" class="${AppState.chartTab === tab ? "active" : ""}" data-chart-tab="${tab}">${tab}</button>`).join("")}
        </div>
        <div class="chart-wrap">${chart}</div>
        <div class="legend"><span><i style="background:#f04444"></i>${AppState.chartTab === "分时" ? "价格" : "K线"}</span><span><i style="background:#c68b19"></i>${AppState.chartTab === "分时" ? "均价 1474.72" : "MA5 1469.36"}</span><span>量 ${s.volume}</span></div>
      </section>
      <section class="section">
        <div class="book-panel">
          <div class="book-side">
            <div class="book-tabs"><button class="${AppState.bookTab === "五档" ? "active" : ""}" data-book-tab="五档">五档</button><button class="${AppState.bookTab === "逐笔" ? "active" : ""}" data-book-tab="逐笔">逐笔</button></div>
            ${AppState.bookTab === "五档" ? bookRows : tradeRows}
          </div>
          <div class="book-side">
            <div class="book-tabs"><button class="active">资金</button><button data-action="show-toast" data-message="更多资金指标将在正式版开放">诊断</button></div>
            <div class="data-row"><span>主力</span><span class="rise">+1.82亿</span><span>净流入</span></div>
            <div class="data-row"><span>超大</span><span class="rise">+0.96亿</span><span>23.1%</span></div>
            <div class="data-row"><span>大单</span><span class="rise">+0.86亿</span><span>20.4%</span></div>
            <div class="data-row"><span>中单</span><span class="fall">-0.52亿</span><span>25.8%</span></div>
            <div class="data-row"><span>小单</span><span class="fall">-1.30亿</span><span>30.7%</span></div>
          </div>
        </div>
        <div class="action-bar">
          <button class="action-button" data-action="toggle-watch">${AppState.watchlisted ? "已自选" : "+ 自选"}</button>
          <button class="action-button" data-action="open-news">资讯</button>
          <button class="action-button sell" data-action="open-trade">卖出</button>
          <button class="action-button primary" data-action="open-trade">买入</button>
        </div>
      </section>
    </div>`;
  }

  function renderIndices(indices) {
    return `<div class="index-grid">${indices.map((item) => `<div class="index-card">
      <span>${item.name}</span><strong class="${priceClass(item.pct)}">${item.value}</strong><em class="${priceClass(item.pct)}">${fmtPct(item.pct)}</em>
    </div>`).join("")}</div>`;
  }

  function renderStocks(rows) {
    if (!rows.length) return `<div class="state-panel">${icons.empty}<h2>暂无匹配股票</h2><p>换个关键词试试看</p></div>`;
    return rows.map((item) => `<button class="stock-row" data-stock="${item.symbol}">
      <div><strong>${item.name}</strong><small>${item.symbol}</small></div>
      <span>${item.price.toFixed(2)}</span><span class="pct-pill ${item.pct < 0 ? "fall-bg" : ""}">${fmtPct(item.pct)}</span>
    </button>`).join("");
  }

  function renderHome(data) {
    return `<div class="view">
      <header class="market-header"><h1>投资机会</h1><p>9月5日 星期六 · 沪深市场已收盘</p></header>
      ${renderIndices(data.indices)}
      <div class="quick-tools">
        <button class="tool-button" data-action="show-toast" data-message="财经日历已更新"><span class="tool-icon">${icons.calendar}</span>财经日历</button>
        <button class="tool-button" data-action="show-toast" data-message="龙虎榜数据已更新"><span class="tool-icon">${icons.bolt}</span>龙虎榜</button>
        <button class="tool-button" data-nav-jump="market"><span class="tool-icon">${icons.chart}</span>市场全景</button>
        <button class="tool-button" data-action="show-toast" data-message="预警条件编辑功能演示"><span class="tool-icon">${icons.alert}</span>智能预警</button>
      </div>
      <div class="page-pad">
        <section class="card-list"><div class="list-title"><h2>我的自选</h2><button class="more-button" data-nav-jump="watch">全部 6 只</button></div>${renderStocks(data.watchlist.slice(0,4))}</section>
        <section class="card-list"><div class="list-title"><h2>今日机会</h2><span class="badge">热点</span></div>${renderSectors(data.sectors)}</section>
      </div>
    </div>`;
  }

  function renderSectors(rows) {
    return rows.map((item) => `<div class="sector-row"><div><strong>${item.name}</strong></div><span class="${priceClass(item.pct)}">${fmtPct(item.pct)}</span><small>${item.leader}</small></div>`).join("");
  }

  function renderWatch(rows) {
    const query = AppState.searchQuery.trim().toLowerCase();
    const filtered = rows.filter((item) => `${item.name}${item.symbol}`.toLowerCase().includes(query));
    return `<div class="view">
      <header class="topbar"><h1>自选股</h1><small>${rows.length} 只</small></header>
      <div class="search-box">${icons.search}<label class="sr-only" for="watch-search">搜索股票</label><input id="watch-search" value="${AppState.searchQuery}" placeholder="搜索名称 / 代码" autocomplete="off"></div>
      <div class="sorts">${[["default","默认"],["rise","涨幅"],["fall","跌幅"]].map(([key,label]) => `<button class="${AppState.watchSort === key ? "active" : ""}" data-sort="${key}">${label}</button>`).join("")}</div>
      <div class="card-list" style="margin:8px 12px 18px">${renderStocks(filtered)}</div>
    </div>`;
  }

  function renderMarket(data) {
    return `<div class="view">
      <header class="topbar"><h1>行情中心</h1><small>15:00 已收盘</small></header>
      ${renderIndices(data.indices)}
      <div class="page-pad">
        <section class="card-list"><div class="list-title"><h2>热门板块</h2><span class="badge">实时</span></div>${renderSectors(data.sectors)}</section>
        <section class="card-list"><div class="list-title"><h2>涨幅榜</h2><button class="more-button" data-action="show-toast" data-message="榜单已刷新">刷新</button></div>${renderStocks([...data.rankings].sort((a,b) => b.pct - a.pct))}</section>
      </div>
    </div>`;
  }

  function renderNews(rows) {
    return `<div class="view">
      <header class="topbar"><h1>财经资讯</h1><button class="icon-button" data-action="show-toast" data-message="资讯搜索功能演示" aria-label="搜索资讯">${icons.search}</button></header>
      <div class="tabs" role="tablist">${["要闻","快讯","研报","公告"].map((tab) => `<button role="tab" aria-selected="${AppState.newsTab === tab}" class="${AppState.newsTab === tab ? "active" : ""}" data-news-tab="${tab}">${tab}</button>`).join("")}</div>
      <div class="card-list" style="margin:8px 12px 18px">${rows.map((item) => `<button class="news-row" data-action="news-detail" data-news-id="${item.id}">
        <h3>${item.title}</h3><div class="news-meta"><span class="news-tag">${item.tag}</span><span>${item.source}</span><time>${item.time}</time></div>
      </button>`).join("")}</div>
    </div>`;
  }

  function renderTrade(data) {
    return `<div class="view">
      <header class="topbar"><h1>模拟交易</h1><button class="more-button" data-action="login">切换账号</button></header>
      <section class="trade-card"><span class="asset-label">总资产（元）</span><div class="asset-value">${data.totalAsset}</div>
        <div class="asset-grid"><div><span>今日收益</span><strong class="rise">${data.dailyProfit}</strong></div><div><span>可用资金</span><strong>${data.available}</strong></div></div>
      </section>
      <div class="page-pad">
        <section class="card-list"><div class="list-title"><h2>持仓</h2><small class="asset-label">2只</small></div>
          ${data.positions.map((item) => `<button class="position-row" data-stock="${item.name === "贵州茅台" ? "600519" : "300750"}">
            <div><strong>${item.name}</strong><small>${item.shares}股</small></div><div><span>${item.price.toFixed(2)}</span><small>现价</small></div><div><span class="rise">+${item.profit.toFixed(2)}</span><small>浮动盈亏</small></div>
          </button>`).join("")}
        </section>
        <div class="action-bar" style="padding-inline:0"><button class="action-button" data-action="show-toast" data-message="委托记录为空">委托</button><button class="action-button" data-action="show-toast" data-message="成交记录已同步">成交</button><button class="action-button sell" data-action="show-toast" data-message="请选择卖出证券">卖出</button><button class="action-button primary" data-action="show-toast" data-message="请选择买入证券">买入</button></div>
      </div>
    </div>`;
  }

  function render() {
    updateNav();
    if (AppState.loading) {
      app.innerHTML = loadingView();
      return;
    }
    if (AppState.error) {
      app.innerHTML = errorView(AppState.error);
      return;
    }
    const views = {
      quote: () => renderQuote(AppState.data),
      home: () => renderHome(AppState.data),
      watch: () => renderWatch(AppState.data),
      market: () => renderMarket(AppState.data),
      news: () => renderNews(AppState.data),
      trade: () => renderTrade(AppState.data)
    };
    app.innerHTML = views[AppState.view]();
  }

  async function loadView(view, activeNav) {
    AppState.set({ view, activeNav, loading: true, error: "", data: null });
    try {
      let response;
      if (view === "quote") response = await StockAPI.fetchQuoteDetail("600519");
      if (view === "home") response = await StockAPI.fetchMarketHome();
      if (view === "watch") response = await StockAPI.fetchWatchlist({ sort: AppState.watchSort });
      if (view === "market") response = await StockAPI.fetchMarketOverview();
      if (view === "news") response = await StockAPI.fetchNews({ tab: AppState.newsTab });
      if (view === "trade") response = await StockAPI.fetchPortfolio();
      if (!response || response.code !== 0) throw new Error(response?.message || "数据返回异常");
      AppState.set({ loading: false, data: response.data });
      document.querySelector(".app-viewport").scrollTop = 0;
    } catch (error) {
      AppState.set({ loading: false, error: error.message });
    }
  }

  function showToast(message) {
    toastRoot.innerHTML = `<div class="toast">${message}</div>`;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => { toastRoot.innerHTML = ""; }, 1800);
  }

  function openLogin() {
    modalRoot.innerHTML = `<div class="modal-backdrop" data-action="close-modal">
      <form class="modal" id="login-form">
        <h2>登录交易账户</h2><p>模拟账号 18888888888，密码 123456</p>
        <div class="field"><label for="account">资金账号</label><input id="account" name="account" inputmode="numeric" autocomplete="username" placeholder="请输入手机号或资金账号"></div>
        <div class="field"><label for="password">交易密码</label><input id="password" name="password" type="password" autocomplete="current-password" placeholder="请输入6位密码"></div>
        <div class="form-error" id="login-error" aria-live="polite"></div>
        <div class="modal-actions"><button type="button" class="action-button" data-action="close-modal">取消</button><button type="submit" class="action-button primary">安全登录</button></div>
      </form>
    </div>`;
  }

  app.addEventListener("click", async (event) => {
    const navJump = event.target.closest("[data-nav-jump]");
    if (navJump) return loadView(navJump.dataset.navJump, navJump.dataset.navJump);
    const stock = event.target.closest("[data-stock]");
    if (stock) {
      if (stock.dataset.stock === "600519") return loadView("quote", "market");
      return showToast("该证券详情仅作列表展示");
    }
    const chartTab = event.target.closest("[data-chart-tab]");
    if (chartTab) {
      const tab = chartTab.dataset.chartTab;
      if (["分时","日K","周K","月K"].includes(tab)) AppState.set({ chartTab: tab });
      else if (tab === "资讯") loadView("news", "news");
      else showToast("主力净流入 1.82亿元");
      return;
    }
    const bookTab = event.target.closest("[data-book-tab]");
    if (bookTab) return AppState.set({ bookTab: bookTab.dataset.bookTab });
    const sort = event.target.closest("[data-sort]");
    if (sort) {
      AppState.watchSort = sort.dataset.sort;
      return loadView("watch", "watch");
    }
    const newsTab = event.target.closest("[data-news-tab]");
    if (newsTab) {
      AppState.newsTab = newsTab.dataset.newsTab;
      return loadView("news", "news");
    }
    const action = event.target.closest("[data-action]");
    if (!action) return;
    if (action.dataset.action === "market-overview") loadView("market", "market");
    if (action.dataset.action === "toggle-watch") {
      AppState.set({ watchlisted: !AppState.watchlisted });
      showToast(AppState.watchlisted ? "已加入自选" : "已从自选移除");
    }
    if (action.dataset.action === "open-news") loadView("news", "news");
    if (action.dataset.action === "open-trade" || action.dataset.action === "login") openLogin();
    if (action.dataset.action === "show-toast") showToast(action.dataset.message);
    if (action.dataset.action === "news-detail") showToast("新闻详情将在正式版展开");
    if (action.dataset.action === "retry") loadView(AppState.view, AppState.activeNav);
  });

  app.addEventListener("input", (event) => {
    if (event.target.id !== "watch-search") return;
    AppState.searchQuery = event.target.value;
    const rows = AppState.data || [];
    const query = AppState.searchQuery.trim().toLowerCase();
    const filtered = rows.filter((item) => `${item.name}${item.symbol}`.toLowerCase().includes(query));
    const list = app.querySelector(".card-list");
    if (list) list.innerHTML = renderStocks(filtered);
  });

  document.querySelector(".bottom-nav").addEventListener("click", (event) => {
    const button = event.target.closest("[data-nav]");
    if (button) loadView(button.dataset.nav, button.dataset.nav);
  });

  modalRoot.addEventListener("click", (event) => {
    const close = event.target.closest('[data-action="close-modal"]');
    if (close && (close === event.target || close.tagName === "BUTTON")) modalRoot.innerHTML = "";
  });

  modalRoot.addEventListener("submit", async (event) => {
    if (event.target.id !== "login-form") return;
    event.preventDefault();
    const form = event.target;
    const account = form.account.value.trim();
    const password = form.password.value.trim();
    const error = form.querySelector("#login-error");
    const submit = form.querySelector('[type="submit"]');
    if (!account || !password) {
      error.textContent = "请完整填写账号和密码";
      return;
    }
    submit.disabled = true;
    submit.textContent = "登录中…";
    const response = await StockAPI.login({ account, password });
    submit.disabled = false;
    submit.textContent = "安全登录";
    if (response.code !== 0) {
      error.textContent = response.message;
      return;
    }
    modalRoot.innerHTML = "";
    showToast(`欢迎，${response.data.displayName}`);
  });

  AppState.subscribe(render);
  setClock();
  window.setInterval(setClock, 30000);
  loadView("quote", "market");
})();
