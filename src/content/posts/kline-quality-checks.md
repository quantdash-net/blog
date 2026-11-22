---
title: K 线入库前可以本地做的质量检查
description: 入库前检查列式 K 线的字段长度、OHLC 关系、时间顺序和复权标记。规则对应我们的 K 线字段，示例数字用来演示检查函数。
date: 2026-11-16
category: 量化实战
tags: [数据质量, K线, 复权]
---
取到 K 线之后、写进研究库之前，有一批检查不需要再访问服务器：字段是否齐全、同一根 K 线的高低价是否装得下开盘和收盘、时间是否重复或倒序。这些检查发现不了“价格与交易所不一致”，但能在入库前拦住明显坏掉的响应。

复权和时间戳的含义见 [复权参数和时间戳](/posts/kline-adjust-and-timestamps/)。请求本身失败时的分支见 [请求异常处理](/posts/market-data-request-errors/)。

## 文档规定了哪些必填字段

[获取 K 线](https://docs.quantdash.net/zh-hans/api-reference/k线数据/获取k线数据.md) 的响应是列式结构：`data` 下每个字段一个数组，相同下标是同一根 K 线。必填字段是 `timestamp`、`open`、`high`、`low`、`close`、`volume`、`amount`。`prev_close` 标注为部分接口返回。`timestamp` 的单位是毫秒。

字段说明没有写成交量和成交额的单位，也没有写停牌日是缺一行还是保留一行。因此下面的函数只检查结构，不把“中间少了一个自然日”判成错误，也不把成交量换算成手或股。

## 用示例数字检查列式结构

下面的数组是构造出来的示例，用来拦住缺字段、乱序，以及最高价装不下开盘和收盘的情况。它不是某次接口返回。

```python
REQUIRED_KLINE_FIELDS = ("timestamp", "open", "high", "low", "close", "volume", "amount")


def kline_issues(data: dict) -> list[str]:
    """检查一根标的的列式 K 线。返回问题列表，空列表表示这些规则都通过。"""
    missing = [key for key in REQUIRED_KLINE_FIELDS if key not in data]
    if missing:
        return [f"缺少字段: {', '.join(missing)}"]

    lengths = {key: len(data[key]) for key in REQUIRED_KLINE_FIELDS}
    if len(set(lengths.values())) != 1:
        return [f"数组长度不一致: {lengths}"]

    issues: list[str] = []
    seen: set[int] = set()
    previous: int | None = None
    for i, ts in enumerate(data["timestamp"]):
        if ts in seen:
            issues.append(f"第 {i} 根时间戳重复: {ts}")
        seen.add(ts)
        if previous is not None and ts <= previous:
            issues.append(f"第 {i} 根时间戳没有递增: {previous} -> {ts}")
        previous = ts

        open_, high, low, close = (data[key][i] for key in ("open", "high", "low", "close"))
        if high < open_ or high < close or high < low or low > open_ or low > close:
            issues.append(f"第 {i} 根 OHLC 不闭合: o={open_} h={high} l={low} c={close}")
        if data["volume"][i] < 0:
            issues.append(f"第 {i} 根成交量为负: {data['volume'][i]}")
        if data["amount"][i] < 0:
            issues.append(f"第 {i} 根成交额为负: {data['amount'][i]}")
    return issues
```

一组故意写坏的数据会得到这些结果：缺 `amount` 时只报告缺字段；长度不同时停止后续检查；时间戳 `3, 2, 2` 会同时报告倒序和重复；`high` 小于 `close`、成交量为负也会各留下一条。全为 0 的成交量可以通过这些规则，因为 0 并不违反“不能为负”。停牌或无成交是否应该是 0，文档没有写。

批量接口 `/v1/klines/batch` 的 `data` 是“代码到列式 K 线”的字典。对每个值调用一次 `kline_issues` 即可。某个代码缺失时，函数不会出现在字典里，这要和请求列表对一下，见异常处理那一篇。

## 复权标记要和数组一起保存

OpenAPI 的默认复权是 `forward`。同一标的的两次数组，如果一次省略 `adjust`、一次传入 `none`，结构检查都会通过，价格却不是一个口径。入库时把请求里的 `adjust`、`period` 和 `symbol` 写进文件名或相邻的一列。缓存前复权序列时记一下下载日期。新的除权之后，前复权历史价会变，本地文件要重新下载，或对照除权因子里新出现的日期。我们没有给出用 `ex_factor` 还原 OHLC 的公式，对账时直接比较 `adjust="none"` 和 `adjust="forward"` 的价格。

`ex_factors` 的每条记录是毫秒时间戳和 `ex_factor`。新出现的除权日，就是该重新看复权价格的时候。

## SDK DataFrame 会多做三件事

Python SDK 0.1.0 在 `to_dataframe=True` 时还会做这些事：

- `to_dataframe=True` 时，若响应字典里没有 `amount`，这一列会被填成 0。OpenAPI 将 `amount` 列为必填，按规范不应缺失。若真的缺失，DataFrame 里的 0 无法表示“字段不存在”。结构检查应针对 REST 的 `data` 字典，或针对 `to_dataframe=False` 的返回值。
- DataFrame 不包含 `prev_close`。
- 生成 `name` 时可能再请求 `/v1/instruments`，并把名称缓存在本机 `~/.quantdash/cache`，缓存时间约为 24 小时。名称请求失败时，K 线仍会返回，异常只记入 debug 日志。因此 `name` 为空不能说明 K 线请求失败。

`trade_date` 由毫秒时间戳按代码后缀的时区格式化。检查时可以重算一遍，和返回列对比：

```python
def trade_dates_match(symbol: str, timestamps: list[int], trade_dates: list[str]) -> list[str]:
    issues = []
    for i, (ts, label) in enumerate(zip(timestamps, trade_dates)):
        expected, _clock = format_bar_time(symbol, ts)
        if label != expected:
            issues.append(f"第 {i} 根 trade_date={label}，按后缀时区应为 {expected}")
    return issues
```

`format_bar_time` 与后缀时区表在 [复权参数和时间戳](/posts/kline-adjust-and-timestamps/) 中，两篇使用同一实现。用上海零点的毫秒去对 A 股，日期是当天；用同一毫秒去对 `.US`，日期是前一天的中午。这个差异是时区换算，不是两根不同的 K 线。

## 标的元数据只能做有限的辅助

[标的元数据](https://docs.quantdash.net/zh-hans/api-reference/基础信息/获取标的元数据.md) 的 `ext.listing_date` 是可选的上市日期，格式 `YYYY-MM-DD`。返回了这个字段时，早于上市日的 `trade_date` 值得人工看一眼。文档没有把该字段列为必填，也没有说明退市后的代码是否还能查到，所以不能用“元数据里没有这只股票”来证明历史 K 线应该为空。

## 问答

**问：这些检查通过，能不能说明价格是对的？**

答：不能。它们检查的是数组结构、时间顺序和非负约束。和交易所逐笔核对要另备数据。

**问：为什么不把自然日缺口当成错误？**

答：文档没有说明停牌日是否占一行。周末和停牌都会让交易日之间出现自然日间隔。缺口可以记下来，再对照交易所的交易日历。

**问：检查 SDK 的 DataFrame 和检查原始 data 一样吗？**

答：0.1.0 会在缺少 `amount` 时填 0，并且不保留 `prev_close`。字段是否存在，以原始字典为准。

> 字段以 [K 线接口](https://docs.quantdash.net/zh-hans/api-reference/k线数据/获取k线数据.md) 为准。示例数字不是行情。
