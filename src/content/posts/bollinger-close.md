---
title: 用日线收盘价算 20 日布林带
description: 用 20 日收盘均线和两倍标准差做出上下轨。示例收盘价单独标出。
date: 2026-11-22
category: 量化实战
tags: [布林带, K线, pandas]
---
布林带看的是收盘价离自己最近一段均值有多远。示例里用 20 日均线，加减两倍 20 日标准差。日线仍然来自 `klines.get`，先定 `adjust`，再算。

## 三列怎么来

`ma20` 是收盘价的 20 日均值。`std20` 是同一窗口的标准差。`upper = ma20 + 2 * std20`，`lower = ma20 - 2 * std20`。不满 20 根的前缀留空。

下面 20 个收盘价是构造的示例：前 19 个是 10，最后一个是 12。

```python
def bollinger_20(closes: list[float]) -> list[dict]:
    rows = []
    for i in range(len(closes)):
        if i < 19:
            rows.append({"ma20": None, "upper": None, "lower": None})
            continue
        window = closes[i - 19 : i + 1]
        ma = sum(window) / 20
        var = sum((x - ma) ** 2 for x in window) / 19
        std = var ** 0.5
        rows.append(
            {
                "ma20": round(ma, 2),
                "upper": round(ma + 2 * std, 2),
                "lower": round(ma - 2 * std, 2),
            }
        )
    return rows
```

这里的标准差用窗口里 19 做分母，和 pandas `Series.std()` 的默认口径一致。示例最后一根的均线会高于 10，上轨在均线之上，下轨在均线之下。

示例页先把标准差四舍五入到两位，再用这个已舍入的值去加减。本文只在均线和上下轨上各舍入一次。同一组收盘价的上下轨因此可能差在小数的最后一位。窗口都是含当天的 20 根，不要把两边打印出来的小数说成逐项相同。

```python
import os
from quantdash import QuantDash

qd = QuantDash(api_key=os.environ["QUANTDASH_API_KEY"])
frame = qd.klines.get(
    "600519.SH",
    period="1d",
    count=40,
    adjust="forward",
    to_dataframe=True,
)
bands = bollinger_20(frame["close"].tolist())
frame["ma20"] = [row["ma20"] for row in bands]
frame["upper"] = [row["upper"] for row in bands]
frame["lower"] = [row["lower"] for row in bands]
```

`count=40` 能留下约 20 根已经算满窗口的带。收盘价是否在上下轨之间，只说明它相对这 20 日的位置，不是买卖信号。

## 问答

**问：布林带用最高价还是收盘价？**

答：示例用收盘价。最高价、最低价不进这三列。

**问：不传 adjust 可以吗？**

答：可以调用，但默认是前复权。要和另一份不复权收盘价比，两边都写上同一个 `adjust`。

> 窗口和两倍标准差见 [示例代码](https://docs.quantdash.net/zh-Hans/sdk/python-examples.md)。示例收盘价不是行情，也不构成投资建议。
