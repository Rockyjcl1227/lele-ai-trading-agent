# DeepSeek 接入方案

## 连接方式

前端已经统一调用：

`POST /api/v1/wencai/chat`

服务端再调用：

`POST https://api.deepseek.com/chat/completions`

官方接口支持多轮 `messages`、JSON Output、流式 SSE 和 Function Calling：

- https://api-docs.deepseek.com/api/create-chat-completion

## 安全要求

- `DEEPSEEK_API_KEY` 只保存在服务端环境变量。
- 浏览器不得直接访问 DeepSeek，也不得接收 API Key。
- 服务端必须校验用户、Prompt 长度、工具参数和模型 JSON 输出。
- 股票价格、技术指标和持仓数据必须来自受控数据服务，不能让模型自行生成。

## 服务端处理顺序

1. 接收 `conversationId、symbol、prompt、history、context、intent`。
2. 服务端再次判断意图：
   - `greeting/help/general`：不调用行情工具。
   - `analysis/signal`：读取实时行情、指标、板块和持仓。
3. 使用 Function Calling 让模型选择工具，由业务服务实际执行工具并回传结果；模型本身不直接访问行情。
4. 调用 DeepSeek；普通问答可关闭 Thinking，复杂研判开启 Thinking。
5. 金融报告要求 JSON Output，服务端校验后再返回前端；若返回空内容或 JSON 校验失败，执行一次受控重试并降级为纯文本解释。
6. 长回答使用 SSE 流式返回；前端逐步展示文本，结构化报告在完成后渲染。
7. 将稳定的系统提示词、Skill 描述和工具 Schema 放在消息前缀，利用上下文缓存减少重复输入成本。

## 推荐工具

- `get_quote_snapshot(symbol, asOf)`
- `get_intraday_series(symbol, asOf)`
- `get_technical_indicators(symbol, period)`
- `get_sector_context(symbol)`
- `get_position(symbol, userId)`
- `create_price_alert(symbol, condition)`

## 推荐模型返回

```json
{
  "intent": "analysis",
  "text": "当前上午盘面震荡偏多，但短线指标偏热。",
  "report": {
    "bullish": 72,
    "bearish": 28,
    "direction": "震荡偏多",
    "support": 1318.0,
    "pressure": 1338.8,
    "action": "等待回踩确认"
  }
}
```

数字字段应由服务端行情与指标模块填充或校验；模型主要负责解释、归纳和对话。
