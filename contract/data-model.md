# 问财数据模型

## Conversation

- `id: string`：会话 ID。
- `symbol?: string`：绑定的股票代码；日常对话可以为空。
- `title: string`：会话标题。
- `messages: Message[]`：按时间排序的消息。
- `updatedAt: string`：最后更新时间。

## Message

- `id: string`
- `role: "user" | "assistant"`
- `content: string`
- `intent: string`
- `createdAt: string`

## MarketContext

- `asOf: string`：行情截点，当前产品固定为 `11:30`。
- `stock: StockSnapshot`
- `timeline: TimelinePoint[]`：仅包含 `09:30–11:30`。
- `indicators: IndicatorSnapshot`
- `indices: IndexSnapshot[]`
- `sectors: SectorSnapshot[]`

## IndicatorSnapshot

- `macd: { dif, dea, bar, signal }`
- `kdj: { k, d, j }`
- `rsi: number`
- `volRatio: number`

## AnalysisReport

- `score: number`：多空倾向分，范围 `0–100`。
- `direction: string`
- `factors: Factor[]`
- `levels: { support, pressure, stop, breakout }`
- `action: string`
- `actionLabel: string`
- `scenarios: Scenario[]`

数值型行情结论由行情服务和指标引擎生成；大模型负责意图理解、解释和自然语言组织，不允许自行编造价格。
