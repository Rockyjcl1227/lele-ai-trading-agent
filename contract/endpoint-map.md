# 页面与接口映射

| 页面/动作 | 前端函数 | 接口 |
|---|---|---|
| 个股详情 | `fetchQuoteDetail(symbol)` | `GET /api/v1/market/stock/:symbol/overview` |
| 首页行情 | `fetchMarketHome()` | `GET /api/v1/market/home` |
| 自选列表 | `fetchWatchlist()` | `GET /api/v1/watchlist` |
| 行情总览 | `fetchMarketOverview()` | `GET /api/v1/market/overview` |
| 资讯列表 | `fetchNews()` | `GET /api/v1/news` |
| 问财对话 | `askWencai(payload)` | `POST /api/v1/wencai/chat` |
| 账户持仓 | `fetchPortfolio()` | `GET /api/v1/account/portfolio` |
| 模拟登录 | `login(payload)` | `POST /api/v1/account/login` |

## 外部模型接入

浏览器只调用业务服务 `/api/v1/wencai/chat`。业务服务负责：

1. 验证用户和会话。
2. 获取可信的实时行情、指标和持仓数据。
3. 根据意图决定是否调用行情工具。
4. 调用 DeepSeek。
5. 校验输出并返回统一响应。

`DEEPSEEK_API_KEY` 只能存放在服务端环境变量中，禁止下发到浏览器。
