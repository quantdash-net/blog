---
title: 一套代码取四个市场的 K 线：klines.get 入门
description: 用 QuantDash Python SDK 的 qd.klines.get，只换标的代码就能拿到 A 股、ETF、港股、美股的日 K 数据。
date: 2026-11-01
category: 接口教程
tags: [K线, Python SDK, 多市场, 入门]
---
做多市场研究时，最烦的往往不是策略本身，而是每个市场一套取数方式。QuantDash 的 K 线接口在 A 股、ETF、港股、美股上用的是**同一个调用**，区别只在标的代码。本文用官方示例仓库里的 [`multi_market_klines.py`](https://github.com/quantdash-net/QuantDash/blob/main/multi_market_klines.py) 讲清楚怎么用。

## 准备工作

1. 在 [QuantDash 官网](https://quantdash.net/) 注册，在控制台的 API Management 页面创建 API Key。
2. 安装 SDK（示例仓库当前与公开 SDK `0.1.0` 对齐，需要 Python 3.9 及以上）：

```bash
pip install quantdash==0.1.0 pandas
```

3. 把 API Key 放进环境变量，不要写进代码或提交到 Git：

```bash
export QUANTDASH_API_KEY="your_api_key_here"
```

Windows PowerShell 用 `$env:QUANTDASH_API_KEY = "your_api_key_here"`。

## 代码格式：后缀决定市场

| 市场 | 标的池 | 代码示例 |
| --- | --- | --- |
| A 股 | `CN_Stock` | `600519.SH`、`000001.SZ` |
| ETF | `CN_ETF` | `510300.SH` |
| 港股 | `HK_Stock` | `00700.HK` |
| 美股 | `US_Stock` | `AAPL.US` |

记住一条：**代码必须带市场后缀**。返回空数据时，先检查后缀写没写对。

## 最小调用

```python
from quantdash import QuantDash

qd = QuantDash()  # 自动读取环境变量 QUANTDASH_API_KEY

df = qd.klines.get(
    "600519.SH",
    period="1d",       # 日线
    count=5,           # 最近 5 根
    adjust="forward",  # 前复权
    to_dataframe=True, # 直接返回 pandas DataFrame
)
print(df[["trade_date", "open", "high", "low", "close", "volume"]])
```

几个参数说明：

- `period`：K 线周期。日线类 `1d`、`1w`、`1M`、`1Q`、`1Y` 覆盖 A 股、美股、港股；分钟线 `1m`、`5m`、`15m`、`30m`、`60m` 适用于 A 股。
- `count`：取最近多少根。
- `adjust`：复权方式，`forward` 前复权、`backward` 后复权、`none` 不复权，另有加法复权 `forward_additive` / `backward_additive`。
- `to_dataframe=True`：返回 DataFrame，常用字段有 `trade_date`、`open`、`high`、`low`、`close`、`volume`。

## 四个市场，一个循环

把上面的调用放进循环，只换代码：

```python
import os
from quantdash import QuantDash

SYMBOLS = {
    "A 股": "600519.SH",
    "ETF": "510300.SH",
    "港股": "00700.HK",
    "美股": "AAPL.US",
}

qd = QuantDash(api_key=os.environ["QUANTDASH_API_KEY"])

for market, symbol in SYMBOLS.items():
    try:
        df = qd.klines.get(symbol, period="1d", count=5,
                           adjust="forward", to_dataframe=True)
        if df.empty:
            raise ValueError("接口返回空数据")
        last = df.iloc[-1]
        print(f"{market} {symbol} 最新日期 {last['trade_date']}，收盘 {last['close']}")
    except Exception as exc:
        print(f"{market} {symbol} 请求失败：{exc}")
```

单个市场失败不会中断整个循环，最后可以汇总哪些市场出了问题。官方示例里还加了字段校验，缺字段会直接报出来，完整版本直接运行即可：

```bash
git clone https://github.com/quantdash-net/QuantDash.git
cd QuantDash
pip install -r requirements.txt
python multi_market_klines.py
```

## 常见报错

- **未检测到 API Key**：确认环境变量设置在当前终端会话里。
- **401 / 403**：检查 API Key 是否有效，以及当前套餐是否包含目标接口或市场权限。
- **429**：请求频率超限，降低频率，并按服务端返回的等待时间重试。
- **空 DataFrame**：检查代码后缀、交易时段、市场权限和查询周期。

更多参数与接口见 [QuantDash 中文文档](https://docs.quantdash.net/zh-Hans)。

> 行情数据和示例仅用于开发、研究与接口演示，不构成投资建议。
