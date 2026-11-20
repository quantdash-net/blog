---
title: K 线的复权参数和毫秒时间戳：默认前复权、市场时区与区间端点
description: 说明我们的 K 线 adjust 有哪些取值、为什么默认是前复权，以及 start_time、end_time 为什么要用带时区的毫秒时间戳。
date: 2026-11-16
category: 常见问题
tags: [复权, 时间戳, K线, Python SDK]
---
K 线调用里有两处最容易在换机器之后才暴露：没写 `adjust` 时我们返回哪一种复权，以及一个“2026-05-01”到底是哪个时区的零点。规则写在 [Python SDK 快速开始](https://docs.quantdash.net/zh-Hans/sdk/python-quickstart.md) 和 [K 线接口](https://docs.quantdash.net/zh-hans/api-reference/k线数据/获取k线数据.md) 里，下面按写代码的顺序说明。

从安装到批量取数的流程见 [SDK 教程](/posts/python-sdk-klines-quotes-tutorial/)。复权序列放进回测之后会碰到的问题，见 [回测取数误区](/posts/backtest-market-data-pitfalls/)。

## 五个取值，省略时默认前复权

K 线查询参数 `adjust` 的类型在 OpenAPI 里默认是 `forward`。取值是：

| 值 | 文档中的说明 |
| --- | --- |
| `forward` | 前复权，比例复权，默认 |
| `backward` | 后复权，比例复权 |
| `forward_additive` | 前复权，差值复权 |
| `backward_additive` | 后复权，差值复权 |
| `none` | 不复权 |

[快速开始](https://docs.quantdash.net/zh-Hans/sdk/python-quickstart.md) 写明：比例复权用乘法因子还原价格，适合计算收益率；差值复权用加减法还原价格，适合观察绝对价差。

Python SDK 0.1.0 的 `klines.get` 只有在你传入 `adjust` 时才会把这个参数放进请求。不传时，服务端按默认值 `forward` 返回前复权。要未复权，写 `adjust="none"`。加法复权同样显式传入 `forward_additive` 或 `backward_additive`。

除权因子接口是 `qd.klines.ex_factors(["600519.SH"])`，REST 路径为 `/v1/klines/ex-factors`。返回条目里有 `timestamp`（毫秒）和 `ex_factor`。文档说因子可用于计算复权价格，没有给出因子与 OHLC 的算式。需要自己复权时，先用同一标的、同一区间对比 `adjust="none"` 和 `adjust="forward"` 的结果，再决定能不能用因子复现。

## 一个假设序列，用来区分乘法和减法

下面的价格是为了把两种算法分开而设的，不是某只股票的行情，也不是文档里的 `ex_factor` 公式。假设除权前两天的价格是 20 和 22，除权日价格是 11，按 2 合 1 把除权前的价格分别乘 0.5、减 11：

```python
def simple_returns(prices: list[float]) -> list[float | None]:
    out: list[float | None] = [None]
    for prev, cur in zip(prices, prices[1:]):
        out.append(cur / prev - 1)
    return out


def scale_before(prices: list[float], ratio: float, event_at: int) -> list[float]:
    return [p * ratio if i < event_at else p for i, p in enumerate(prices)]


def shift_before(prices: list[float], delta: float, event_at: int) -> list[float]:
    return [p + delta if i < event_at else p for i, p in enumerate(prices)]
```

除权发生在下标 2。比例法得到 `[10, 11, 11]`，除权前一天的收益率仍是 `11/10 - 1`，即 10%。差值法得到 `[9, 11, 11]`，同一段收益率变成 `11/9 - 1`。不复权序列 `[20, 22, 11]` 的最后一段则会把拆分造成的价格跳变算进收益率。这和“比例适合收益率、差值适合绝对价差”的分工一致。0.5 和 11 只是这组假设价格里的数，不是接口里的除权因子。

## 时间参数是毫秒，两端都包含

OpenAPI 对 `start_time` 和 `end_time` 的说明是起始、结束时间戳（毫秒，含）。`count` 默认 100，最大 10000。快速开始里的示例使用 `datetime.datetime(2026, 5, 1).timestamp() * 1000`。`datetime` 不带时区时，`timestamp()` 按运行这台机器的本地时区解释。

SDK 0.1.0 生成 `trade_date` 和 `trade_time` 时，按代码后缀选择时区：`.SH`、`.SZ`、`.BJ` 用 `Asia/Shanghai`，`.HK` 用 `Asia/Hong_Kong`，`.US` 用 `America/New_York`。认不出的后缀这两列为空，`timestamp` 仍是毫秒整数。

同一个毫秒，用不同后缀显示，日历日期可能不同。下面按 UTC 机器上的标准库换算给出数字，说明的是时区差，不是某次接口返回。

```python
from datetime import datetime
from zoneinfo import ZoneInfo

MARKET_TZ = {
    "SH": "Asia/Shanghai",
    "SZ": "Asia/Shanghai",
    "BJ": "Asia/Shanghai",
    "HK": "Asia/Hong_Kong",
    "US": "America/New_York",
}


def market_tz(symbol: str) -> ZoneInfo:
    suffix = symbol.rsplit(".", 1)[-1]
    name = MARKET_TZ.get(suffix)
    if name is None:
        raise ValueError(f"无法从代码后缀判断时区: {symbol}")
    return ZoneInfo(name)


def to_ms(symbol: str, year: int, month: int, day: int, hour: int = 0, minute: int = 0) -> int:
    dt = datetime(year, month, day, hour, minute, tzinfo=market_tz(symbol))
    return int(dt.timestamp() * 1000)


def format_bar_time(symbol: str, timestamp_ms: int) -> tuple[str, str]:
    dt = datetime.fromtimestamp(timestamp_ms / 1000, market_tz(symbol))
    return dt.strftime("%Y-%m-%d"), dt.strftime("%Y-%m-%d %H:%M:%S")
```

在 UTC 机器上，`datetime(2026, 5, 1).timestamp()` 对应的毫秒是 `1777593600000`。`to_ms("600519.SH", 2026, 5, 1)` 是上海零点，毫秒为 `1777564800000`，两者相差 8 小时，也就是 28800000 毫秒。把上海零点这个毫秒交给 `format_bar_time("600519.SH", ...)` 得到 `2026-05-01 00:00:00`；同一毫秒交给 `format_bar_time("AAPL.US", ...)` 得到 `2026-04-30 12:00:00`。港股与 A 股在这个日期的零点毫秒相同，因为两地当时的偏移都是 UTC+8。

美东时区要处理夏令时。`America/New_York` 在 2026-01-01 的偏移是 UTC-5，在 2026-07-01 是 UTC-4。用固定的“减 5 小时”去格式化美股时间，夏令时期间会差 1 小时。

因此区间端点应使用带时区的时间。A 股日线若按上海日历日对齐，起点和终点都用 `Asia/Shanghai`：

```python
start = to_ms("600519.SH", 2026, 5, 1)
end = to_ms("600519.SH", 2026, 5, 31, 23, 59)
```

文档没有写日 K 的 `timestamp` 落在开盘、收盘还是交易日零点。接到数据后，先把 `timestamp` 和 `trade_date` 打印出来，再固定切分方式。不要用 15:00 去猜。

`1M` 是月线，`1m` 是 1 分钟线。分钟线在 [简介](https://docs.quantdash.net/zh-Hans/index.md) 里标注为 A 股。历史 K 线的周期没有 `10m`；日内分时的参数枚举里有。两边按各自文档里的周期传，不要混用 `10m`。

## 调用时把两个参数都写上

调用写成这样：

```python
import os
from quantdash import QuantDash

qd = QuantDash(api_key=os.environ["QUANTDASH_API_KEY"])
df = qd.klines.get(
    "600519.SH",
    period="1d",
    start_time=to_ms("600519.SH", 2026, 5, 1),
    end_time=to_ms("600519.SH", 2026, 5, 31, 23, 59),
    adjust="none",
    to_dataframe=True,
)
```

0.1.0 在 `to_dataframe=True` 时生成的列包括 `symbol`、`name`、`timestamp`、`trade_date`、`trade_time`、`open`、`high`、`low`、`close`、`volume`、`amount`。日线和分钟线都会带上 `trade_date` 与 `trade_time`。原始响应里的可选字段 `prev_close` 不会进入这个 DataFrame。

## 问答

**问：不写 adjust 会得到不复权数据吗？**
答：不会。OpenAPI 把 `adjust` 的默认值写成 `forward`。不复权要显式传 `adjust="none"`。

**问：为什么同一段日期在另一台机器上多出或少掉一天？**
答：不带时区的 `datetime.timestamp()` 使用机器本地时区。UTC 机器上的 2026-05-01 零点比上海零点晚 8 小时。区间又是闭区间，端点差这 8 小时就可能多含或少含一根 K 线。

**问：除权因子能不能直接乘到收盘价上？**
答：文档没有公布这个算式。因子接口只说明返回 `timestamp` 和 `ex_factor`，并写明可用于计算复权价格。

> 参数说明见 [K 线文档](https://docs.quantdash.net/zh-hans/api-reference/k线数据/获取k线数据.md) 和 [SDK 快速开始](https://docs.quantdash.net/zh-Hans/sdk/python-quickstart.md)。文中的价格序列只用来区分乘法和减法，不是行情，也不是投资建议。
