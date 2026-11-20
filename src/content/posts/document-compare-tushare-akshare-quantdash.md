---
title: 取同一段日线：Tushare、AKShare 和 QuantDash 怎么接到项目里
description: 围绕个人量化里最常见的日线任务，说明三家在代码格式、复权、调用方式和后续维护上的差别，以及什么时候直接用我们的 K 线接口。
date: 2026-11-16
category: 常见问题
tags: [选型, Tushare, AKShare, 行情数据]
---
研究代码里最先需要的，通常是一段口径明确的日线：哪只标的、哪段日期、前复权还是不复权。Tushare、AKShare 和我们都能接到这个任务上，但代码写法、复权参数和维护方式不一样。这篇只谈日线怎么取、怎么放进自己的函数。更一般的选型问题见 [行情数据 API 怎么选](/posts/choose-market-data-api/)，免费来源的类型见 [免费 / 低成本股票数据接口常见问题](/posts/free-low-cost-stock-data-api-faq/)。

## 先把任务写成三件事

1. 标的用什么代码，换市场时要不要换接口。
2. 价格是不复权、前复权还是后复权。
3. 调用发生在你自己的进程里，还是请求一个带密钥的接口。

三件事对齐之后，策略层只保留一个 `get_daily`。下面按这个顺序看。

## 代码和能覆盖的市场

我们的日线用同一个 `klines.get`。代码带交易所后缀：`600519.SH`、`000001.SZ`、`00700.HK`、`AAPL.US`。日线类周期 `1d`、`1w`、`1M`、`1Q`、`1Y` 覆盖 A 股、美股、港股。换市场时改代码，不改函数。完整例子在 [一套代码取四个市场的 K 线](/posts/multi-market-klines/)。

[Tushare 的 daily](https://tushare.pro/document/2?doc_id=27) 是 A 股日线。示例代码是 `ts_code='000001.SZ'`，日期用 `YYYYMMDD`。页面写明这是未复权行情，停牌期间不提供数据，最低 120 积分可以试用。

[AKShare 的 stock_zh_a_hist_em](https://akshare.akfamily.xyz/data/stock/stock_quote.html) 是东方财富的沪深京 A 股日频率数据。`symbol` 是不带后缀的代码，例如 `"603777"`；`period` 可以是 `daily`、`weekly`、`monthly`。这条接口不要拿去请求港股或美股。

所以，只做沪深京日线时，三家都能接。要在 A 股、港股、美股之间用同一种调用，用我们的 `klines.get`，换后缀即可。

## 复权要写在调用里

我们的 `adjust` 有五个取值：`forward`（前复权，比例，默认）、`backward`、`forward_additive`、`backward_additive`、`none`。不传参数时服务端按 `forward` 返回。接到别的数据源旁边时，请显式写上 `adjust`，避免默认前复权和对方的不复权混在一个文件里。比例复权和时间戳的细节见 [复权参数和时间戳](/posts/kline-adjust-and-timestamps/)。

Tushare 的 `daily` 返回未复权行情。成交量单位是手，成交额单位是千元。同一页提到可以通过通用行情接口取得前后复权数据；真要用复权价，打开那个接口的说明再接，不要把 `daily` 的收盘价当成前复权。

AKShare 这条日线默认不复权。文档示例里 `adjust=""` 是不复权，`qfq` 是前复权，`hfq` 是后复权。成交量单位是手，成交额单位是元。他们的说明还写了：前复权会在每次除权后重算历史价格，不同时间下载的前复权序列可能不同，持续分红时价格还可能为负。保存文件时把复权方式写进文件名。

我们的字段说明写的是“成交量”和“成交额”，没有写成手或元。不要用 Tushare 的“千元”或 AKShare 的“元”去换算这一列。

## 调用发生在哪里

我们提供 REST 和 Python SDK。SDK 用 `pip install quantdash` 安装，`QuantDash()` 读取环境变量 `QUANTDASH_API_KEY`。K 线可以 `to_dataframe=True`，直接拿到 DataFrame。

Tushare 用 `pro.daily(...)`。token 放在环境变量里再传给 `pro_api`，不要写进仓库。

AKShare 在你本机运行，从公开网页采集数据。[项目说明](https://akshare.akfamily.xyz/introduction.html) 写明：接口和数据用于学术研究，商业使用需要自行注意风险；目标网页改版时要更新库。接到长期运行的任务里时，固定版本，升级前先跑自己的取数脚本。

## 收成一个入口

下面两个函数只处理代码和上海时区的日历日窗口。输入是示例，用来对齐日期，不是行情。

```python
from datetime import datetime
from zoneinfo import ZoneInfo


def split_a_share_symbol(symbol: str) -> tuple[str, str]:
    """600519.SH -> ("600519", "SH")。只接受沪深京后缀。"""
    code, _, suffix = symbol.partition(".")
    if suffix not in {"SH", "SZ", "BJ"} or not code:
        raise ValueError(f"不是沪深京代码: {symbol}")
    return code, suffix


def ymd_shanghai_day_bounds(ymd: str) -> tuple[int, int]:
    """YYYYMMDD 收成上海时区当天的 00:00:00 和 23:59:59，单位毫秒。"""
    tz = ZoneInfo("Asia/Shanghai")
    year, month, day = int(ymd[0:4]), int(ymd[4:6]), int(ymd[6:8])
    start = datetime(year, month, day, 0, 0, 0, tzinfo=tz)
    end = datetime(year, month, day, 23, 59, 59, tzinfo=tz)
    return int(start.timestamp() * 1000), int(end.timestamp() * 1000)
```

真正的请求按各家文档拼。Key 放在环境变量里。A 股可以走下面的分支；港股和美股日线走我们的分支，只换 `symbol`。

```python
import os


def get_daily(symbol: str, start: str, end: str, source: str, adjust: str = "none"):
    """start、end 为 YYYYMMDD。symbol 使用 600519.SH 这种写法。"""
    if source == "quantdash":
        from quantdash import QuantDash

        qd = QuantDash(api_key=os.environ["QUANTDASH_API_KEY"])
        start_ms, _ = ymd_shanghai_day_bounds(start)
        _, end_ms = ymd_shanghai_day_bounds(end)
        return qd.klines.get(
            symbol,
            period="1d",
            start_time=start_ms,
            end_time=end_ms,
            adjust=adjust,
            to_dataframe=True,
        )
    code, _suffix = split_a_share_symbol(symbol)
    if source == "tushare":
        import tushare as ts

        pro = ts.pro_api(os.environ["TUSHARE_TOKEN"])
        # daily 是未复权。需要复权时改用 Tushare 文档中的复权接口。
        return pro.daily(ts_code=symbol, start_date=start, end_date=end)
    if source == "akshare":
        import akshare as ak

        ak_adjust = {"": "", "none": "", "forward": "qfq", "backward": "hfq"}[adjust]
        return ak.stock_zh_a_hist_em(
            symbol=code,
            period="daily",
            start_date=start,
            end_date=end,
            adjust=ak_adjust,
        )
    raise ValueError(f"未知数据源: {source}")
```

日 K 的时间戳落在当天哪一分钟，文档没有规定。上面的窗口是上海日历日的闭区间，接到数据后看一眼 `trade_date`，再决定要不要收窄 `end_time`。

## 怎么选

- 沪深京、港股、美股日线要放在同一次调用里：用我们的 `klines.get`，显式传入 `adjust`。
- 已经在用 Tushare 的 A 股未复权日线：继续 `daily`，成交额按千元换算，复权不要假定已经做好。
- 本地脚本、学术研究、并且接受随网页改版升级库：可以用 `stock_zh_a_hist_em`，把复权参数和库版本记在缓存文件旁。

## 问答

**问：三家的日线收盘价能直接比吗？**
答：先看复权。Tushare `daily` 和 AKShare 的默认结果都是不复权。我们不传 `adjust` 时返回前复权。比较前把三边都设成同一种口径。

**问：港股代码能传给 AKShare 的这条日线吗？**
答：不能。`stock_zh_a_hist_em` 的说明是沪深京 A 股。港股、美股日线用我们的后缀代码，例如 `00700.HK`、`AAPL.US`。

**问：成交额为什么对不上？**
答：Tushare `daily` 的成交额是千元，AKShare 这条日线是元。我们的文档没有写单位，不要套用这两边的换算。

> 行情接口的用法以各家文档为准。我们的参数说明见 [中文文档](https://docs.quantdash.net/zh-Hans)。本文不构成投资建议。
