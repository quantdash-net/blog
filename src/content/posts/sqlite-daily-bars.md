---
title: 把日线按复权口径写进 SQLite
description: 用标的、毫秒时间戳和 adjust 做主键，把日线收进本地表。示例行不是接口返回。
date: 2026-11-22
category: 量化实战
tags: [SQLite, K线, 复权]
---
研究脚本如果每次都重新拉日线，前复权序列还会在新的除权之后变掉。本地表至少要记住三件事：哪只标的、哪一根的时间戳、当时用的 `adjust`。结构是否合格，先按 [入库前的质量检查](/posts/kline-quality-checks/) 看一遍，再写入。

## 表里放什么

我们的日线 DataFrame 有 `symbol`、`timestamp`、`trade_date`、`open`、`high`、`low`、`close`、`volume`、`amount`。`timestamp` 是毫秒。`adjust` 不会自动出现在列里，要你在写入时加上。不传 `adjust` 时接口返回前复权，所以表里不要留空，写上实际使用的值。

```python
import sqlite3

DDL = """
CREATE TABLE IF NOT EXISTS daily_bars (
    symbol TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    adjust TEXT NOT NULL,
    trade_date TEXT NOT NULL,
    open REAL NOT NULL,
    high REAL NOT NULL,
    low REAL NOT NULL,
    close REAL NOT NULL,
    volume INTEGER NOT NULL,
    amount REAL NOT NULL,
    PRIMARY KEY (symbol, timestamp, adjust)
)
"""


def upsert_daily(conn: sqlite3.Connection, rows: list[dict]) -> None:
    conn.executemany(
        """
        INSERT INTO daily_bars (
            symbol, timestamp, adjust, trade_date,
            open, high, low, close, volume, amount
        ) VALUES (
            :symbol, :timestamp, :adjust, :trade_date,
            :open, :high, :low, :close, :volume, :amount
        )
        ON CONFLICT(symbol, timestamp, adjust) DO UPDATE SET
            trade_date = excluded.trade_date,
            open = excluded.open,
            high = excluded.high,
            low = excluded.low,
            close = excluded.close,
            volume = excluded.volume,
            amount = excluded.amount
        """,
        rows,
    )
    conn.commit()
```

同一根 K 线的前复权和不复权是两行。后一次写入同一主键会覆盖价格，不会再插一行。

## 示例行和取数

下面两行是构造的，用来看主键，不是行情。

```python
sample = [
    {
        "symbol": "600519.SH",
        "timestamp": 1777564800000,
        "adjust": "forward",
        "trade_date": "2026-05-01",
        "open": 10.0,
        "high": 11.0,
        "low": 9.5,
        "close": 10.5,
        "volume": 100,
        "amount": 1050.0,
    }
]
```

从接口接到 DataFrame 之后，补上 `adjust` 再写入：

```python
import os
from quantdash import QuantDash

qd = QuantDash(api_key=os.environ["QUANTDASH_API_KEY"])
adjust = "forward"
frame = qd.klines.get(
    "600519.SH",
    period="1d",
    count=20,
    adjust=adjust,
    to_dataframe=True,
)
rows = frame.to_dict("records")
for row in rows:
    row["adjust"] = adjust
```

`amount` 的单位文档没有写成元或千元。表里照原样保存，不要在入库时乘一个未说明的系数。

## 问答

**问：只按交易日做主键可以吗？**

答：不够。同一天的 `forward` 和 `none` 要能同时留下。主键加上 `adjust`。

**问：前复权行会不会过期？**

答：新的除权之后，以前下载的前复权价格会变。表外再记一列下载日期，或者发现新的除权日之后按同一 `adjust` 重写这些行。

> 字段见 [获取 K 线](https://docs.quantdash.net/zh-hans/api-reference/k线数据/获取k线数据.md)。示例行不是接口结果。
