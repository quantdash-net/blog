---
title: 用日线收盘价算 14 日 RSI
description: 按示例里的算法，用收盘价的涨跌计算 14 日 RSI。示例序列单独标出，不把它当成接口结果。
date: 2026-11-22
category: 量化实战
tags: [RSI, K线, pandas]
---
RSI 用的是同一列收盘价的涨跌，不需要另一路行情。示例代码用 14 日平均涨幅和平均跌幅来算。日线从 `klines.get(..., period="1d")` 来，复权要先定下来。这篇用 `adjust="forward"`，因为要比的是收益率方向的连续价格。

## 算法

对收盘价做差分。涨的部分留下，跌的部分取绝对值。两边都做 14 日简单滚动平均，再算 `100 - 100 / (1 + 平均涨幅 / 平均跌幅)`。平均跌幅为 0 时，这一行不要硬除。

下面的收盘价是构造的示例，不是某次 `klines.get` 的返回。

```python
def rsi_14(closes: list[float]) -> list[float | None]:
    out: list[float | None] = [None]
    gains: list[float] = []
    losses: list[float] = []
    for prev, cur in zip(closes, closes[1:]):
        delta = cur - prev
        gains.append(delta if delta > 0 else 0.0)
        losses.append(-delta if delta < 0 else 0.0)
        if len(gains) < 14:
            out.append(None)
            continue
        window_g = gains[-14:]
        window_l = losses[-14:]
        avg_gain = sum(window_g) / 14
        avg_loss = sum(window_l) / 14
        if avg_loss == 0:
            out.append(None)
        else:
            rs = avg_gain / avg_loss
            out.append(round(100 - 100 / (1 + rs), 2))
    return out
```

前 14 根差分凑不满窗口时，结果是空。这和滚动平均要满 14 个数是一回事。

接到日线之后：

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
frame["rsi"] = rsi_14(frame["close"].tolist())
```

`count=60` 够算出末尾一段 14 日 RSI。换复权口径会改收盘价，RSI 也会变，所以列名或文件名里写上 `forward`。

## 问答

**问：这个 RSI 是接口字段吗？**

答：不是。接口给的是 OHLCV。RSI 在本地用收盘价算。

**问：不复权收盘价能直接套进同一个函数吗？**

答：能，但那是另一种口径。除权日的价格跳变会进差分。要看收益率方向，用 `adjust="forward"`。

> 算法与 [示例代码](https://docs.quantdash.net/zh-Hans/sdk/python-examples.md) 中的 14 日 RSI 相同。示例收盘价不是行情，结果也不构成投资建议。
