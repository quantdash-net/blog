---
title: 用五档盘口看买一和卖一
description: 从一只标的的五档买卖价里取出买一、卖一和价差，并检查档位是否按文档的顺序排列。
date: 2026-11-22
category: 接口教程
tags: [五档盘口, 盘口, Python SDK]
---
盘中要看的往往不是再拉一根日 K，而是当前买一和卖一相差多少。我们的盘口接口返回买卖各五档价格和数量。下面用这个结果做一件事：取出买一、卖一，并确认档位顺序没有反。

## 接口返回什么

`qd.depth.get("600519.SH")` 返回一个字典。必填字段是 `symbol`、`region`、`timestamp`、`bid_prices`、`bid_volumes`、`ask_prices`、`ask_volumes`。`timestamp` 是毫秒。文档写明买入价是买 1 到买 5、降序，卖出价是卖 1 到卖 5、升序。自选里的多只标的用 `qd.depth.batch(["600519.SH", "000001.SZ"])`，返回以代码为键的字典。

这是五档，不是更多档。快照大约每 3 秒刷新一次，那是行情快照的更新间隔。盘口这次请求自己要多久，是另一件事。

## 从五档里取价差

下面的价格是构造的示例，用来说明买一、卖一和档位顺序，不是某次接口返回。

```python
def book_view(book: dict) -> dict:
    """取出买一、卖一，并列出档位顺序问题。"""
    issues = []
    for name in ("bid_prices", "bid_volumes", "ask_prices", "ask_volumes"):
        if len(book[name]) != 5:
            issues.append(f"{name} 不是 5 档")
    bids, asks = book["bid_prices"], book["ask_prices"]
    if not bids or not asks:
        issues.append("买价或卖价为空")
        return {"bid1": None, "ask1": None, "spread": None, "issues": issues}
    if any(bids[i] < bids[i + 1] for i in range(len(bids) - 1)):
        issues.append("买价不是从买1到买5降序")
    if any(asks[i] > asks[i + 1] for i in range(len(asks) - 1)):
        issues.append("卖价不是从卖1到卖5升序")
    return {
        "bid1": bids[0],
        "ask1": asks[0],
        "spread": asks[0] - bids[0],
        "issues": issues,
    }
```

价差用卖一减买一。买价或卖价是空数组时，先记下问题并返回，不读取第一档。档位价格可以相等，所以这里只把买价变高、卖价变低当成顺序问题。数量为 0 时仍保留这一档，不要把空档删掉再比较。

调用写成：

```python
import os
from quantdash import QuantDash

qd = QuantDash(api_key=os.environ["QUANTDASH_API_KEY"])
book = qd.depth.get("600519.SH")
print(book_view(book))
```

多只标的先 `depth.batch`，再对每个字典调用 `book_view`。缺了哪只代码，用请求列表减返回的键。

## 问答

**问：买一一定是数组的第一档吗？**

答：按文档，`bid_prices[0]` 是买 1，`ask_prices[0]` 是卖 1。先用上面的顺序检查，再拿这两个数做价差。

**问：五档和快照的最新价是同一个接口吗？**

答：不是。最新价在 `quotes.get`。五档在 `depth.get` 或 `depth.batch`。轮询间隔可以参考快照大约每 3 秒刷新一次，但那不是盘口请求的耗时。

> 字段说明见 [五档盘口](https://docs.quantdash.net/zh-hans/api-reference/实时行情/获取市场深度（五档行情）.md)。示例价格不是行情，也不构成投资建议。
