---
title: 自选列表和全市场标的池，分开取快照
description: 自选用 symbols 拿最新价并整理成百分比，全市场用 universes 再在本地筛选。两种参数不要放进同一次 quotes.get。
date: 2026-11-22
category: 接口教程
tags: [实时行情, 标的池, Python SDK]
---
盘中看价格，通常是两种任务。一种是手里已经有一组代码，要它们的最新价和涨跌幅。另一种是先拿整个标的池，再在本地留下涨幅最高的几只。两次调用分开写。`quotes.get` 要么传 `symbols`，要么传 `universes`，不能两个都传，也不能都不传。

## 自选：按代码取，再整理字段

```python
import os
from quantdash import QuantDash

qd = QuantDash(api_key=os.environ["QUANTDASH_API_KEY"])
watch = ["600519.SH", "000001.SZ", "00700.HK"]
frame = qd.quotes.get(symbols=watch, to_dataframe=True)
```

`to_dataframe=True` 时，`symbol` 是列，不是索引。每行还有 `last_price`、`prev_close`。扩展字段只有在返回里出现时才会变成 `ext.` 开头的列。`ext.change_pct` 是可选的小数，0.01 表示 1%。没有这一列时，用最新价和昨收自己算展示用的百分点。昨收为 0 的行留空，不要除以 0。

```python
def watch_table(frame):
    """整理自选快照。没有行就原样返回，不要按不存在的列取值。"""
    if frame is None or len(frame) == 0:
        return frame
    out = frame.loc[:, ["symbol", "last_price", "prev_close"]].copy()
    if "ext.change_pct" in frame.columns:
        points = frame["ext.change_pct"] * 100
    else:
        prev = frame["prev_close"]
        points = (frame["last_price"] - prev) / prev * 100
        points = points.where(prev != 0)
    out["change_pct_points"] = points.round(2)
    return out.sort_values("change_pct_points", ascending=False)
```

返回 0 行时，先核对代码和后缀。空表不是 0 元的价格。快照大约每 3 秒刷新一次。这是快照更新的间隔，不是这一次请求要多久。间隔设得比 3 秒更密，多半还是同一份快照。

SDK 0.1.0 在 `symbols` 不超过 20 个时用 GET，更长的列表用 POST。`universes` 不超过 5 个用 GET，更多用 POST。两种参数仍然不能出现在同一次调用里。

## 全市场：只传标的池，筛选留在本地

池子 ID 是 `CN_Stock`、`CN_ETF`、`US_Stock`、`HK_Stock`。`CN_Stock` 是当前 A 股，行数不固定，也不是历史成分。

```python
def top_changes(frame, n: int = 10):
    table = watch_table(frame)
    if table is None or len(table) == 0:
        return table
    return table.head(n)


pool = qd.quotes.get(universes=["CN_Stock"], to_dataframe=True)
leaders = top_changes(pool, 10)
```

已经拿到全市场之后，要看其中几只，在这张表里筛 `symbol`。不要再把同一批代码和 `universes` 放进下一次 `quotes.get`。

```python
def quote_kwargs(symbols: list[str] | None, universes: list[str] | None) -> dict:
    if (symbols is None) == (universes is None):
        raise ValueError("symbols 和 universes 只能填一个")
    if symbols is not None:
        return {"symbols": symbols}
    return {"universes": universes}
```

自选用 `quote_kwargs(watch, None)`。全市场用 `quote_kwargs(None, ["CN_Stock"])`。

## 问答

**问：自选和全市场能在一次 quotes.get 里一起要吗？**

答：不能。两个参数都传，或都不传，调用会在发出请求前失败。要两种结果，就调用两次，或先取池子再在本地筛选。

**问：涨跌幅为什么要乘 100？**

答：`ext.change_pct` 是小数。0.01 表示 1 个百分点。乘 100 只用于展示。

> 参数见 [获取实时行情](https://docs.quantdash.net/zh-hans/api-reference/实时行情/获取实时行情.md)。快照刷新间隔见 [常见问题](https://docs.quantdash.net/zh-Hans/faq.md)。
