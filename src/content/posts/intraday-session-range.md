---
title: 把当日分时收成开、高、低、最后一根收盘
description: 用当日分时的第一根开盘、最高、最低和最后一根收盘，收成一个当日区间。示例分时单独标出。
date: 2026-11-22
category: 接口教程
tags: [日内分时, K线, Python SDK]
---
盘中已经有分时之后，有时只要当日走到哪里，而不是再存全部分钟。`klines.intraday` 返回的是当日分钟线，字段和 K 线一样有 `open`、`high`、`low`、`close`。把它们收成四个数即可。

历史分钟线和当日分时不是同一个接口。要按日期回溯，用 `klines.get(period="1m")`。这里只处理当日。

## 四个数从哪来

按时间顺序：开盘取第一根的 `open`，最高取全部 `high` 的最大，最低取全部 `low` 的最小，收盘取最后一根的 `close`。分钟线在简介里标注为 A 股。分时周期用 `1m`、`5m`、`15m`、`30m`、`60m`。

下面四根是构造的示例。

```python
def session_range(rows: list[dict]) -> dict | None:
    if not rows:
        return None
    ordered = sorted(rows, key=lambda row: row["timestamp"])
    return {
        "open": ordered[0]["open"],
        "high": max(row["high"] for row in ordered),
        "low": min(row["low"] for row in ordered),
        "close": ordered[-1]["close"],
        "bars": len(ordered),
    }
```

示例里开 10、高到 12、低到 9、最后一根收 11，区间就是这四个数。空列表返回空，不要把 0 当成价格。

```python
import os
from quantdash import QuantDash

qd = QuantDash(api_key=os.environ["QUANTDASH_API_KEY"])
frame = qd.klines.intraday("600519.SH", period="1m", to_dataframe=True)
print(session_range(frame.to_dict("records")))
```

分时在盘中会变，最后一根收盘也会变。这是当日分钟线还在更新，不是快照大约每 3 秒刷新那件事。快照刷新间隔只描述 `quotes` 的快照。

## 问答

**问：这样收出来的四个数就是日 K 吗？**

答：不是。日 K 用 `klines.get(period="1d")`。这里只是把已经拿到的当日分时收成一个区间。

**问：港股代码能传给 intraday 吗？**

答：分钟线在简介里标的是 A 股。这篇的例子用 `600519.SH`。

> 分时参数见 [获取日内分时数据](https://docs.quantdash.net/zh-hans/api-reference/日内分时/获取日内分时数据.md)。示例分时不是行情。
