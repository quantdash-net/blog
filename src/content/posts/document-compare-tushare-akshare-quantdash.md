---
title: 取同一段日线：Tushare、AKShare 和 QuantDash
description: 同一项日线任务下，三家在代码、复权和调用方式上各是什么。后半说明什么时候用我们的 K 线，以及怎样按市场时区取出 A 股、港股、美股日线。
date: 2026-11-16
category: 常见问题
tags: [选型, Tushare, AKShare, 行情数据]
---
很多研究都从同一件事开始：给出一段日期和一组标的，拿到口径清楚的日线。Tushare、AKShare 和我们都能做这件事，但代码、复权和调用位置不一样。下面先按这个共同任务对照，再把跨市场日线在 QuantDash 里的写法展开。选型时还要看的其他问题，见 [选行情 API 先看这 8 件事](/posts/choose-market-data-api/)。

## 对照的是日线任务，不是整家产品

表里每一行都只对“取日线”这一件事。某一行写的是对方的一个接口，不代表那家只有这一个接口。

| 对照点 | Tushare | AKShare | QuantDash |
| --- | --- | --- | --- |
| 这里用来对照的入口 | [`daily`](https://tushare.pro/document/2?doc_id=27)，页面标题是 A 股日线 | [`stock_zh_a_hist_em`](https://akshare.akfamily.xyz/data/stock/stock_quote.html)，说明为沪深京 A 股日频率 | `klines.get`，`period="1d"` |
| 这个入口之外 | 同页写明还可以通过通用行情接口取含前后复权的数据。美股等其他行情不在 `daily` 这一页 | 股票文档里另有港股、美股等页面。换市场时要换对应函数，不是把港股代码塞进这个函数 | 日线类周期 `1d`、`1w`、`1M`、`1Q`、`1Y` 覆盖 A 股、美股、港股。换市场改后缀 |
| 代码示例 | `000001.SZ`，日期 `YYYYMMDD` | `"603777"`，6 位，不带后缀 | `600519.SH`、`00700.HK`、`AAPL.US` |
| 复权 | `daily` 是未复权。停牌期间不提供数据 | 默认不复权；`qfq` 前复权，`hfq` 后复权 | `forward` 前复权为默认，另有 `backward`、`forward_additive`、`backward_additive`、`none` |
| 这一路数据怎么拿到 | 带 token 的接口。`daily` 最低 120 积分可以试用 | 在本机从公开网页采集。[项目说明](https://akshare.akfamily.xyz/introduction.html) 写明用于学术研究，商业使用需注意风险，网页改版后要更新库 | REST 或 Python SDK。Key 放在环境变量 `QUANTDASH_API_KEY` |
| 当天的日线何时可取 | 交易日 15 点到 16 点入库 | 当日收盘价在收盘后获取 | K 线盘中会更新。这是 K 线的更新方式，不是单次请求要多久 |
| 成交量和成交额 | 手，千元 | 手，元 | 字段是 `volume`、`amount` |

三家都能提供日线。差别在于你这次要的是不是“同一个调用、显式复权、标的可以跨市场”。只做 A 股未复权日线时，`daily` 就是按这个口径设计的。本地研究和学术脚本里，`stock_zh_a_hist_em` 也能直接给出沪深京日线。跨市场、并且希望复权写在参数里时，下面的写法是我们这边的用法。

成交量单位不要混用。Tushare 和 AKShare 在各自页面上写了手和金额单位。我们的字段名是成交量和成交额，比较金额时先和你的研究单位对齐，再相加。

## 什么时候用我们的日线

适合这几件事同时成立的时候：

- 标的里既有 A 股，也有港股或美股，你希望调用形式不变，只改代码后缀。
- 复权要在请求里写明。不传 `adjust` 时，我们返回前复权比例。
- 你希望用 SDK 直接得到 DataFrame，或用 REST 在别的语言里取同一份列式数据。

不适合当成默认替换的时候也很明确。你的研究已经固定在 Tushare `daily` 的未复权 A 股上，就继续用那个接口，不要把我们的默认前复权当成同一列价格。你的脚本依赖 AKShare 某一页上的中文列名和网页数据，也按那一页的函数来，而不是改成我们的字段名就算迁移完成。这篇不讲怎么把现有工程迁过来。

不同市场需要分别订阅。分钟线 `1m` 到 `60m` 标注的是 A 股，和日线的覆盖范围不是同一句话。

## 按每个市场自己的时区取一段日线

`start_time` 和 `end_time` 是毫秒时间戳，两端都包含。同一组 `YYYYMMDD`，A 股和北交所用上海时区，港股用香港时区，美股用美东时区。SDK 显示 `trade_date` 时也是这套后缀时区。美东有夏令时，用 `America/New_York`，不要写死减 5 小时。

跨市场时不要先合成一个毫秒再交给所有标的。`klines.batch` 的起止时间是同一对毫秒，适合同一市场的一批代码。下面按标的各自换算，再调用 `klines.get`。

```python
import os
from datetime import datetime
from zoneinfo import ZoneInfo

from quantdash import QuantDash

MARKET_TZ = {
    "SH": "Asia/Shanghai",
    "SZ": "Asia/Shanghai",
    "BJ": "Asia/Shanghai",
    "HK": "Asia/Hong_Kong",
    "US": "America/New_York",
}


def day_bounds_ms(symbol: str, ymd: str) -> tuple[int, int]:
    """把 YYYYMMDD 收成该标的市场时区的 00:00:00 和 23:59:59，单位毫秒。"""
    suffix = symbol.rsplit(".", 1)[-1]
    tz = ZoneInfo(MARKET_TZ[suffix])
    year, month, day = int(ymd[0:4]), int(ymd[4:6]), int(ymd[6:8])
    start = datetime(year, month, day, tzinfo=tz)
    end = datetime(year, month, day, 23, 59, 59, tzinfo=tz)
    return int(start.timestamp() * 1000), int(end.timestamp() * 1000)


def daily_bars(symbols: list[str], start: str, end: str, adjust: str = "forward"):
    """取多只标的的日线。adjust 请显式传入。"""
    qd = QuantDash(api_key=os.environ["QUANTDASH_API_KEY"])
    frames = {}
    for symbol in symbols:
        start_ms, _ = day_bounds_ms(symbol, start)
        _, end_ms = day_bounds_ms(symbol, end)
        frames[symbol] = qd.klines.get(
            symbol,
            period="1d",
            start_time=start_ms,
            end_time=end_ms,
            adjust=adjust,
            to_dataframe=True,
        )
    return frames


watchlist = ["600519.SH", "00700.HK", "AAPL.US"]
bars = daily_bars(watchlist, "20260501", "20260529", adjust="forward")
for symbol, df in bars.items():
    print(symbol, len(df), df["trade_date"].iloc[0], df["trade_date"].iloc[-1])
```

`20260501` 到 `20260529` 是日历日示例，不是一份已核对过的交易日清单。返回的 `trade_date` 才是这只标的的交易日。接到数据后看首尾日期是否落在你要的区间里；日 K 的时间戳落在当天哪一分钟，以返回的 `timestamp` 为准。

保存时把 `adjust` 写进文件名。前复权序列会在新的除权之后变化，下载日期也一起记下。复权取值和时区的进一步说明在 [复权参数和时间戳](/posts/kline-adjust-and-timestamps/)。四个市场的最小循环在 [一套代码取四个市场的 K 线](/posts/multi-market-klines/)。

## 问答

**问：三家日线的收盘价能放进同一列吗？**

答：先把复权说成同一种。`daily` 和 `stock_zh_a_hist_em` 的默认结果是不复权。我们不传 `adjust` 时是前复权。要和未复权价比较，请求里写 `adjust="none"`。

**问：AKShare 是不是不能取港股？**

答：不能这样说。`stock_zh_a_hist_em` 这一条是沪深京日线。港股、美股在 AKShare 的其他页面。我们这边港股日线用 `00700.HK` 这种后缀，走同一个 `klines.get`。

**问：快照约 3 秒刷新，是不是这次日线请求只要 3 秒？**

答：不是。约 3 秒是实时快照的刷新间隔。日线请求自己的耗时是另一件事。K 线盘中会更新，指的是盘中的 K 线还在变化。

> 参数以 [中文文档](https://docs.quantdash.net/zh-Hans) 为准。Tushare、AKShare 的行为以文中链接的页面为准。本文不构成投资建议。
