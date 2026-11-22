---
title: 用涨跌停价和卖一数量看是否封板
description: 用标的元数据里的涨跌停价对照最新价，再用五档卖一或买一的数量看封板。示例数字单独标出。
date: 2026-11-22
category: 量化实战
tags: [涨跌停, 五档盘口, 元数据]
---
A 股里“最新价接近涨跌停价”和“盘口第一档没有对手量”是两件可以分开看的事。元数据里的 `limit_up`、`limit_down` 是涨跌停价。下面把两者合在一起，只作为一个盘口启发式：价格落在涨停价附近且卖一数量为 0，或落在跌停价附近且买一数量为 0。接口没有交易所正式封板字段，这个结果也不是成交已经完成的保证。

## 两个接口各看一件事

`qd.instruments.get("600519.SH")` 的 `ext` 里可以有 `limit_up` 和 `limit_down`。这两个字段不是每只标的都有，没有就不要当成 0。最新价来自 `qd.quotes.get(symbols=["600519.SH"])` 的 `last_price`。价格是否碰到涨跌停，按示例里的做法，允许 `1e-3` 的差。

启发式的第二步看五档第一档。`ask_volumes[0] == 0` 表示卖一没有量，`bid_volumes[0] == 0` 表示买一没有量。这是盘口数组的第一档，不是把五档数量加总，也不是交易所返回的封板标记。

全市场扫描时，先 `quotes.get(universes=["CN_Stock"])`，再用 `instruments.batch` 和 `depth.batch`。标的很多时 SDK 会分批。这一篇只把判断写成函数，不展示一份全市场名单。

## 用示例价格看判断

下面的数字是构造的，用来看阈值和封板条件，不是某次返回。

```python
def at_limit(last_price: float, limit_price: float | None) -> bool:
    if limit_price is None:
        return False
    return abs(last_price - limit_price) < 1e-3


def sealed(at_price: bool, first_level_volume: int) -> bool:
    return at_price and first_level_volume == 0


def side_sealed(at_price: bool, volumes: list[int]) -> bool:
    if not volumes:
        return False
    return sealed(at_price, volumes[0])
```

涨停一侧先看 `ask_volumes` 有没有第一档。没有就不算封板，也不读取 `[0]`。有了再用 `side_sealed(at_limit(last, limit_up), ask_volumes)`。跌停一侧换成 `limit_down` 和 `bid_volumes`。最新价离涨停价还有距离时，卖一数量即使是 0，也不把这只标的算成涨停一侧的启发式命中。

```python
import os
from quantdash import QuantDash

qd = QuantDash(api_key=os.environ["QUANTDASH_API_KEY"])
quote = qd.quotes.get(symbols=["600519.SH"])[0]
inst = qd.instruments.get("600519.SH")
book = qd.depth.get("600519.SH")
limit_up = inst.get("ext", {}).get("limit_up")
hit = at_limit(quote["last_price"], limit_up)
print(hit, side_sealed(hit, book["ask_volumes"]))
```

`quotes.get` 只能在 `symbols` 和 `universes` 里选一个。看自选就传代码，看全 A 股再传 `universes=["CN_Stock"]`。

## 问答

**问：涨跌停价是 K 线字段吗？**

答：不是。它在标的元数据的 `ext.limit_up` 和 `ext.limit_down`，而且可能缺失。

**问：卖一数量为 0 就表示交易所已经确认涨停封板吗？**

答：不表示。这里只是启发式：最新价与 `limit_up` 的差小于 `1e-3`，并且卖一数量为 0。它不是交易所状态字段，也不保证这笔价已经成交。

> 价格差小于 `1e-3`、再看第一档数量，规则与 [示例代码](https://docs.quantdash.net/zh-Hans/sdk/python-examples.md) 相同。示例页印出的名单是那一页的示意。接口没有正式封板字段。文中的价格是示例，不构成投资建议。
