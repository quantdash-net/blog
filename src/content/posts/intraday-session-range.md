---
title: 把拿到的当日分时收成一段区间
description: 显式传入分时 count，再用返回片段里最早一根的开盘、最高、最低和最晚一根的收盘。不要把片段说成已经走完的全天。
date: 2026-11-22
category: 接口教程
tags: [日内分时, K线, Python SDK]
---
盘中往往只想知道已经返回的分时走到了哪里。`klines.intraday` 给的是当日分钟线，有 `open`、`high`、`low`、`close` 和 `timestamp`。把这一次返回的片段收成四个数即可。历史分钟线用 `klines.get(period="1m")`，可以带时间区间。这里只处理当日分时。

## count 决定最多拿回多少根

[分时接口](https://docs.quantdash.net/zh-hans/api-reference/日内分时/获取日内分时数据.md) 把 `count` 定义成最大返回条数，默认 100，最大 10000。周期可用 `1m`、`5m`、`15m`、`30m`、`60m`。分钟线在简介里标注为 A 股，例子用 `600519.SH`。

调用时显式传入 `count`。本文传入允许的上限 10000，表示这次最多拿回 10000 根：

```python
import os
from quantdash import QuantDash

qd = QuantDash(api_key=os.environ["QUANTDASH_API_KEY"])
frame = qd.klines.intraday(
    "600519.SH",
    period="1m",
    count=10000,
    to_dataframe=True,
)
```

`count=10000` 只表示最多要 10000 根。盘前、盘中或当天分钟数更少时，返回会更短。

## 四个数属于这次返回的片段

按 `timestamp` 排序之后：起点用最早一根的 `open`，最高用全部 `high` 的最大，最低用全部 `low` 的最小，终点用最晚一根的 `close`。最早一根不一定是当天第一分钟，最晚一根在盘中还会变。不要把这两个价格叫做全日开盘价和收盘价。

```python
def returned_range(rows: list[dict]) -> dict | None:
    if not rows:
        return None
    ordered = sorted(rows, key=lambda row: row["timestamp"])
    return {
        "first_open": ordered[0]["open"],
        "high": max(row["high"] for row in ordered),
        "low": min(row["low"] for row in ordered),
        "last_close": ordered[-1]["close"],
        "bars": len(ordered),
    }
```

下面四根是构造的示例，用来看排序，不是接口返回。列表先写了较晚的一根，最早的 `open` 仍是 9，最晚的 `close` 是 12。

```python
sample = [
    {"timestamp": 300, "open": 12, "high": 13, "low": 11, "close": 12.5},
    {"timestamp": 100, "open": 9, "high": 10, "low": 8, "close": 9.5},
    {"timestamp": 200, "open": 9.5, "high": 11, "low": 9, "close": 10.5},
    {"timestamp": 400, "open": 12.5, "high": 12.5, "low": 12, "close": 12},
]
```

空列表得到空结果，不要用 0 填价格。`bars` 小于你传入的 `count`，只说明这次没有拿满上限。

快照大约每 3 秒刷新一次，说的是 `quotes` 的快照。分时片段的最后一根会随当日分钟线更新，那是另一件事。

## 问答

**问：这样收出来的四个数就是日 K 吗？**

答：不是。日 K 用 `klines.get(period="1d")`。这里只概括这一次分时响应里的片段。

**问：传了 count=10000 是否就是完整交易日？**

答：不是。10000 是参数允许的最大条数。返回仍可能更短，最早一根也不保证是开盘第一分钟。盘中的 `last_close` 还会变。

> 参数见 [获取日内分时数据](https://docs.quantdash.net/zh-hans/api-reference/日内分时/获取日内分时数据.md)。示例分时不是行情。
