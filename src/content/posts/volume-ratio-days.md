---
title: 用成交量相对此前 20 日均量找偏高的交易日
description: 当日成交量除以它前面 20 根日线的平均成交量。分母不含当天，也不要把这个数叫成量比。
date: 2026-11-22
category: 量化实战
tags: [成交量, K线, pandas]
---
这里要找的是：这一根日线的 `volume`，相对它前面 20 根的平均，高了多少。名字用“相对此前 20 日均量”。不要把它叫成量比。行情软件里的量比通常还会按已经开市的时间折算，那套算法本文不写。

分子和分母都用同一次 `klines.get` 返回的 `volume`。不必先把它换成手或股。不要和另一家接口的成交量放进同一个分母。

## 分母是此前 20 根

分母用这一根之前的 20 根 `volume`，不含当天。当天的放量不会先进入平均。把当天也放进这 20 根，分母会变，比值也不同。

```python
def relative_to_prior_20(volumes: list[float]) -> list[float | None]:
    """当日成交量 / 此前 20 根的均量。窗口不含当天。"""
    out: list[float | None] = []
    for i, volume in enumerate(volumes):
        if i < 20:
            out.append(None)
            continue
        window = volumes[i - 20 : i]
        avg = sum(window) / 20
        out.append(None if avg == 0 else round(volume / avg, 2))
    return out


def highest_days(rows: list[dict], n: int = 3) -> list[dict]:
    scored = [row for row in rows if row["rel20"] is not None]
    return sorted(scored, key=lambda row: row["rel20"], reverse=True)[:n]
```

下面的成交量是示例：前 20 根是 100，下一根是 300。那一根相对此前 20 根均量是 3。

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
frame["rel20"] = relative_to_prior_20(frame["volume"].tolist())
```

`adjust="none"` 只固定价格口径。成交量仍用返回的 `volume`，不要因为换了复权就去改数量。

## 问答

**问：这个数大于 1 表示什么？**

答：只表示这一根的成交量高于它前面 20 根的平均。它不是按开市时间折算的量比，也不是资金流向或策略收益。

**问：为什么分母不含当天？**

答：分母表示这一根之前的成交量水平。把当天放进去，当天的放量会先抬高平均。

> 日线来自 [获取 K 线](https://docs.quantdash.net/zh-hans/api-reference/k线数据/获取k线数据.md)。示例数量不是行情。
