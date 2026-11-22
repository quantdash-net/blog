---
title: 查快照时，代码和标的池只能选一个
description: quotes.get 要么按代码，要么按标的池。两个都传或都不传会在发出请求前失败。
date: 2026-11-22
category: 常见问题
tags: [实时行情, 标的池, Python SDK]
---
自选列表和全市场快照是两种查法。SDK 的 `quotes.get` 要求二选一：传 `symbols`，或传 `universes`。两个都传、或两个都不传，会直接报错，请求还没发出去。

## 两种查法

按代码，适合已经定好的列表：

```python
qd.quotes.get(symbols=["600519.SH", "00700.HK", "AAPL.US"], to_dataframe=True)
```

按标的池，适合整池最新价。池子 ID 是 `CN_Stock`、`CN_ETF`、`US_Stock`、`HK_Stock`。

```python
qd.quotes.get(universes=["CN_Stock"], to_dataframe=True)
```

REST 也是这两种参数二选一：`symbols` 用逗号分隔的代码，`universes` 用池子 ID。快照大约每 3 秒刷新一次。这是服务端快照的更新间隔，不是这一次 HTTP 要多久。

## 调用前先选边

```python
def quote_args(symbols: list[str] | None, universes: list[str] | None) -> dict:
    if (symbols is None) == (universes is None):
        raise ValueError("symbols 和 universes 只能填一个")
    if symbols is not None:
        return {"symbols": symbols}
    return {"universes": universes}
```

自选非空就只传代码。要全市场就只传池子，不要再把池子里的代码列表同时塞进 `symbols`。

```python
import os
from quantdash import QuantDash

qd = QuantDash(api_key=os.environ["QUANTDASH_API_KEY"])
args = quote_args(["600519.SH", "000001.SZ"], None)
frame = qd.quotes.get(**args, to_dataframe=True)
```

`ext.change_pct`、`ext.amplitude`、`ext.turnover_rate` 都是小数，0.01 表示 1%。展示成百分比时再乘 100。

## 问答

**问：先取全市场，再把代码列表传回去，算不算两个参数？**

答：第二次调用如果只为了重复同一批快照，不需要。已经有 DataFrame 就在本地筛。新的一次 `quotes.get` 仍然只能带一种参数。

**问：池子里的数量会不会变？**

答：会。`CN_Stock` 是当前 A 股池。它不是历史成分，也不能当成固定行数。

> 参数见 [获取实时行情](https://docs.quantdash.net/zh-hans/api-reference/实时行情/获取实时行情.md)。快照刷新间隔见 [常见问题](https://docs.quantdash.net/zh-Hans/faq.md)。
