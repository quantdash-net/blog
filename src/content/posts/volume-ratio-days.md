---
title: 在同一列成交量里找量比偏高的交易日
description: 用当日成交量除以它自己的 20 日均量，找出这组日线里量比最高的日子。不换算单位。
date: 2026-11-22
category: 量化实战
tags: [成交量, K线, pandas]
---
量比在这里只比较同一列 `volume`。当日成交量除以过去 20 根的均量，单位前后相同，所以不必先知道它是手还是股。这组数来自一次 `klines.get`，不要和另一家接口的成交量混在一个分母里。

## 怎么算

```python
def volume_ratio(volumes: list[float]) -> list[float | None]:
    out: list[float | None] = []
    for i, volume in enumerate(volumes):
        if i < 20:
            out.append(None)
            continue
        window = volumes[i - 20 : i]
        avg = sum(window) / 20
        out.append(None if avg == 0 else round(volume / avg, 2))
    return out


def top_ratio_days(rows: list[dict], n: int = 3) -> list[dict]:
    scored = [row for row in rows if row["vol_ratio"] is not None]
    return sorted(scored, key=lambda row: row["vol_ratio"], reverse=True)[:n]
```

均量用的是当日之前的 20 根，不含当天。这样当天放量不会先把自己算进分母。下面的成交量是示例：前 20 根是 100，接着一根是 300。那一根的量比是 3。

接到日线：

```python
import os
from quantdash import QuantDash

qd = QuantDash(api_key=os.environ["QUANTDASH_API_KEY"])
frame = qd.klines.get(
    "000001.SZ",
    period="1d",
    count=30,
    adjust="none",
    to_dataframe=True,
)
frame["vol_ratio"] = volume_ratio(frame["volume"].tolist())
```

这里用 `adjust="none"`。复权会改价格，成交量列仍以接口返回的 `volume` 为准，不要因为换了 `adjust` 就去改数量。

## 问答

**问：量比大于 1 表示什么？**

答：只表示这一根的成交量高于它前面 20 根的平均。它不是资金流向，也不是策略收益。

**问：能和 Tushare 的“手”一起做分母吗？**

答：不要。分母和分子都用这一次返回的 `volume`。

> 思路与 [示例代码](https://docs.quantdash.net/zh-Hans/sdk/python-examples.md) 里的成交量比较相同。示例数量不是行情。
