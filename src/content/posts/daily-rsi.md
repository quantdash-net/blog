---
title: 用日线收盘价算 14 日简单平均 RSI
description: 用最近 14 根涨跌的简单平均计算 RSI，也就是 Cutler 算法。说明它和 Wilder 平滑不是同一个数，并写明除零时怎么处理。
date: 2026-11-22
category: 量化实战
tags: [RSI, K线, pandas]
---
RSI 用同一列收盘价的涨跌来算，接口本身没有这个字段。日线用 `klines.get(..., period="1d", adjust="forward")`。先固定复权，再算。前复权适合看收益率方向的连续价格。

## 这是简单平均，不是 Wilder 平滑

[示例代码](https://docs.quantdash.net/zh-Hans/sdk/python-examples.md) 把 14 根涨幅和 14 根跌幅各自做滚动平均，再计算 `100 - 100 / (1 + 平均涨幅 / 平均跌幅)`。滚动平均是这 14 根的简单算术平均。这种算法通常叫 Cutler RSI。

Wilder RSI 不用这 14 根的简单平均，而是把更早的平均值平滑进当前一根。两套数不同。本文用简单平均。

本文的边界是：

- 涨跌差分还不满 14 根：留空。
- 这 14 根里既没有上涨也没有下跌：留空，避免 0 除 0。
- 这 14 根只有上涨、平均跌幅为 0：记为 100。
- 其余情况按上面的公式，保留两位小数。

下面的收盘价是构造的示例，不是某次 `klines.get` 的返回。

```python
def rsi_14(closes: list[float]) -> list[float | None]:
    """14 根涨跌的简单平均 RSI。不足、全平留空；只有上涨记 100。"""
    out: list[float | None] = [None]
    gains: list[float] = []
    losses: list[float] = []
    for prev, cur in zip(closes, closes[1:]):
        delta = cur - prev
        gains.append(max(delta, 0.0))
        losses.append(max(-delta, 0.0))
        if len(gains) < 14:
            out.append(None)
            continue
        avg_gain = sum(gains[-14:]) / 14
        avg_loss = sum(losses[-14:]) / 14
        if avg_loss == 0:
            out.append(None if avg_gain == 0 else 100.0)
            continue
        rs = avg_gain / avg_loss
        out.append(round(100 - 100 / (1 + rs), 2))
    return out
```

```python
import os
from quantdash import QuantDash

qd = QuantDash(api_key=os.environ["QUANTDASH_API_KEY"])
frame = qd.klines.get(
    "600519.SH",
    period="1d",
    count=60,
    adjust="forward",
    to_dataframe=True,
)
frame["rsi14"] = rsi_14(frame["close"].tolist())
```

`count=60` 让末尾有一段已经满 14 根差分的结果。换 `adjust` 会改收盘价，RSI 也会变。文件名里写上 `forward`。

## 问答

**问：这个 RSI 是接口返回的字段吗？**

答：不是。接口给 OHLCV。这里用收盘价在本地计算。

**问：为什么有的窗口是 100，有的是空？**

答：不满 14 根差分，或者 14 根里完全没有涨跌，留空。14 根里只有上涨、没有下跌，记 100。这是为了不除以 0，不是 Wilder 公式的规定。

> 日线参数见 [获取 K 线](https://docs.quantdash.net/zh-hans/api-reference/k线数据/获取k线数据.md)。示例收盘价不是行情，结果也不构成投资建议。
