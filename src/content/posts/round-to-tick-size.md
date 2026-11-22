---
title: 按最小变动价位整理一个报价
description: 元数据里如果有 tick_size，就把价格收成这个步长的整数倍。没有该字段时不要自定步长。
date: 2026-11-22
category: 常见问题
tags: [元数据, 报价, tick]
---
报价有时会比交易所的最小变动价位多出几位小数。`ext.tick_size` 是最小变动价位，在标的元数据里，而且是可选字段。有它的时候，可以用它把一个价格收到最近的步长上。没有它的时候，保留原价格。

## 步长从哪里来

`qd.instruments.get("600519.SH")` 返回的 `ext` 里看 `tick_size`。它不是 K 线字段，也不是快照字段。不同标的可以不同，所以不要写死 0.01。

```python
def round_to_tick(price: float, tick: float | None) -> float:
    if tick is None or tick <= 0:
        return price
    steps = round(price / tick)
    return round(steps * tick, 10)
```

`round(..., 10)` 只是去掉二进制小数的尾巴。步长 0.01 时，示例价格 10.126 收到 10.13，10.124 收到 10.12。这两个价格是构造的，不是接口返回。

```python
import os
from quantdash import QuantDash

qd = QuantDash(api_key=os.environ["QUANTDASH_API_KEY"])
inst = qd.instruments.get("600519.SH")
tick = inst.get("ext", {}).get("tick_size")
quote = qd.quotes.get(symbols=["600519.SH"])[0]
shown = round_to_tick(quote["last_price"], tick)
```

整理后的价格用于展示或和涨跌停价比较。不要把它写回当成新的行情字段。

## 问答

**问：所有市场的 tick_size 都是 0.01 吗？**

答：不要这样假设。用这只标的返回的 `tick_size`。字段缺失就不要收价。

**问：收价之后还要再乘 100 显示涨跌幅吗？**

答：涨跌幅是另一列。`ext.change_pct` 已经是小数，0.01 表示 1%，展示时乘 100。那一步和最小变动价位无关。

> 字段见 [标的元数据](https://docs.quantdash.net/zh-hans/api-reference/基础信息/获取标的元数据.md)。示例价格不是行情。
