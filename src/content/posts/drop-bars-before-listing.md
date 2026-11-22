---
title: 用上市日丢掉更早的日线
description: 标的元数据如果带了上市日期，就把 trade_date 早于这一天的日线从样本里拿掉。
date: 2026-11-22
category: 量化实战
tags: [元数据, K线, 上市日期]
---
拉一段很长的日线时，开头可能早于这只标的的上市日。元数据的 `ext.listing_date` 是 `YYYY-MM-DD`。有这个字段时，可以用它滤掉更早的行。没有这个字段时，不要把缺字段当成“没有上市”。

K 线数组本身合不合规，见 [入库前的质量检查](/posts/kline-quality-checks/)。这篇只做上市日这一刀。

## 字段在哪里

`qd.instruments.get(["600519.SH", "000001.SZ"])` 可以一次传多只。每条记录有 `symbol`、`name`、`exchange`、`region`、`type`。`ext.listing_date` 是可选的。退市日不在这组字段里，滤掉上市前的行，并不等于样本里包含了后来退市的股票。

日线用 `qd.klines.get(symbol, period="1d", adjust="none", to_dataframe=True)`。比较时用返回的 `trade_date`，它是 `YYYY-MM-DD`，和上市日是同一种写法。

## 示例日期怎么滤

下面的日期是构造的，不是接口返回。

```python
def drop_before_listing(rows: list[dict], listing_date: str | None) -> list[dict]:
    if not listing_date:
        return list(rows)
    return [row for row in rows if row["trade_date"] >= listing_date]
```

上市日是 `2020-01-02` 时，`2019-12-31` 会被丢掉，`2020-01-02` 会留下。`listing_date` 为空时，函数原样返回，避免把整段历史清空。

```python
import os
from quantdash import QuantDash

qd = QuantDash(api_key=os.environ["QUANTDASH_API_KEY"])
symbol = "600519.SH"
inst = qd.instruments.get(symbol)
listing = inst.get("ext", {}).get("listing_date")
bars = qd.klines.get(symbol, period="1d", count=250, adjust="none", to_dataframe=True)
kept = drop_before_listing(bars.to_dict("records"), listing)
```

复权口径仍然要显式写。这里用 `adjust="none"`，是因为上市日过滤看的是交易日，不依赖前复权价格。

## 问答

**问：没有 listing_date 怎么办？**

答：保留原样本，并在你自己的记录里记下“这只没有上市日”。不要把它解释成尚未上市。

**问：滤完就能当成历史成分股吗？**

答：不能。上市日只回答“这一天是否早于上市”。`CN_Stock` 是当前标的池，不是历史成分。

> 字段见 [标的元数据](https://docs.quantdash.net/zh-hans/api-reference/基础信息/获取标的元数据.md)。示例日期不是行情。
