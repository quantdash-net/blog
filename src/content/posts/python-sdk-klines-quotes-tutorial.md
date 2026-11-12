---
title: 用 QuantDash Python SDK 从零拉取 K 线和实时快照：完整流程教程
description: 从安装、鉴权到 K 线、时间区间、批量、日内分时、实时快照和 pandas 处理，一步步搭建可复用的多市场取数脚本，并整理常见错误的排查方法。
date: 2026-11-12
category: 接口教程
tags: [Python SDK, K线, 实时行情, pandas, 入门]
---
上一篇 [klines.get 入门](/posts/multi-market-klines/) 讲了"一个调用取四个市场的日 K"。这篇往前后各延伸一步：前面补上环境搭建和鉴权的规范做法，后面补上时间区间、批量、日内分时、实时快照和 pandas 处理，最后把它们组织成一个**可以直接放进项目里的取数模块**。

本文所有接口名、参数和取值都来自 [QuantDash 中文文档](https://docs.quantdash.net/zh-Hans) 的 Python SDK 快速开始页和 API 参考。代码示例中的 API Key 一律从环境变量读取，请不要把真实 Key 写进代码或提交到 Git。

## 第一步：准备 Python 环境

文档说明 SDK 支持 Python 3.9+，推荐 3.10 或更高版本，并内置 pandas 和 tqdm 支持。建议为项目单独建一个虚拟环境：

```bash
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install quantdash pandas
```

安装完成后可以确认一下版本：

```bash
python -c "import quantdash; print(quantdash.__version__)"
```

## 第二步：配置 API Key

在 [QuantDash 官网](https://quantdash.net/) 注册后，在控制台创建 API Key。SDK 支持两种传 Key 的方式：构造时传入 `api_key`，或者设置环境变量 `QUANTDASH_API_KEY` 后直接 `QuantDash()`。推荐用环境变量：

```bash
# macOS / Linux
export QUANTDASH_API_KEY="your-api-key"

# Windows PowerShell
$env:QUANTDASH_API_KEY = "your-api-key"
```

如果项目里用 `.env` 文件管理配置，记得把 `.env` 加进 `.gitignore`。在代码里初始化客户端：

```python
from quantdash import QuantDash

qd = QuantDash()  # 自动读取环境变量 QUANTDASH_API_KEY
```

没有设置环境变量时，SDK 会在初始化阶段直接报错，提示需要传入 `api_key` 或设置环境变量，这一步出错不会发出任何网络请求。

## 第三步：理解标的代码

所有接口统一使用 `{代码}.{交易所后缀}` 格式，这是后面所有请求的基础：

| 后缀 | 交易所 / 市场 | 示例 |
| --- | --- | --- |
| `.SH` | 上海证券交易所 | `600519.SH` |
| `.SZ` | 深圳证券交易所 | `000001.SZ` |
| `.BJ` | 北京证券交易所 | `920047.BJ` |
| `.US` | 美股 | `AAPL.US` |
| `.HK` | 港股 | `00700.HK` |

港股代码是 5 位数字，例如腾讯是 `00700.HK`，少写前导 0 是常见错误。

## 第四步：拉取 K 线

### 最近 N 根日 K

```python
df = qd.klines.get("600519.SH", period="1d", count=5, adjust="forward", to_dataframe=True)
print(df[["symbol", "name", "trade_date", "open", "high", "low", "close", "volume"]])
```

`period` 的取值分两组。日线类：`1d`（日）、`1w`（周）、`1M`（月）、`1Q`（季）、`1Y`（年），文档标注覆盖 A 股、美股、港股；分钟线：`1m`、`5m`、`15m`、`30m`、`60m`，文档标注适用于 A 股。注意 `1M` 是月线、`1m` 是 1 分钟线，大小写不能写错。

分钟 K 线返回的时间列是 `trade_time`，日线类返回的是 `trade_date`：

```python
df_5m = qd.klines.get("600519.SH", period="5m", count=48, to_dataframe=True)
print(df_5m[["trade_time", "open", "close", "volume"]].tail())
```

### 复权参数

`adjust` 有 5 个取值：`forward`（前复权-比例，默认）、`backward`（后复权-比例）、`forward_additive`（前复权-差值）、`backward_additive`（后复权-差值）、`none`（不复权）。比例复权适合算收益率，差值复权适合看绝对价差。建议始终显式传入 `adjust`，避免以后看代码时不确定用的是哪种口径。

### 按时间区间取数

`start_time` 和 `end_time` 是**毫秒时间戳**（REST 文档注明两端都包含），可以和 `count` 组合使用：

```python
import datetime as dt

def to_ms(d: dt.datetime) -> int:
    return int(d.timestamp() * 1000)

start = to_ms(dt.datetime(2026, 5, 1))
end = to_ms(dt.datetime(2026, 5, 31))
df_may = qd.klines.get("600519.SH", period="1d", start_time=start, end_time=end,
                       adjust="forward", to_dataframe=True)
print(f"区间内共 {len(df_may)} 根 K 线")
```

只传 `end_time` 加 `count`，就是"截止到某个时间点的最近 N 根"，适合在回测里模拟"当时能看到的数据"：

```python
end = to_ms(dt.datetime(2026, 6, 1))
df_before = qd.klines.get("600519.SH", period="1d", count=20, end_time=end, to_dataframe=True)
```

REST 文档中单次请求的 `count` 默认 100、最大 10000。需要更长的历史时，可以按时间区间分段请求再拼接。

## 第五步：批量拉取多只标的

多只标的不要写循环逐个请求，用 `klines.batch`，返回一个以标的代码为 key 的字典：

```python
symbols = ["600519.SH", "000001.SZ", "510300.SH"]
dfs = qd.klines.batch(symbols, period="1d", count=60, adjust="forward",
                      to_dataframe=True, show_progress=True)

for sym, df in dfs.items():
    print(sym, len(df), df["close"].iloc[-1])
```

`klines.batch` 同样支持 `start_time`、`end_time`。`show_progress=True` 会显示进度条。

多市场混合时，日线可以放在一起取，分钟线只放 A 股代码。

## 第六步：日内分时

日内分时接口返回**当日**的分钟级数据，默认周期 `1m`，SDK 文档列出的可选周期是 `1m`、`5m`、`15m`、`30m`、`60m`：

```python
df_today = qd.klines.intraday("600519.SH", count=5, to_dataframe=True)
print(df_today[["trade_time", "close", "volume"]])

dfs_today = qd.klines.intraday_batch(["600519.SH", "000001.SZ"], to_dataframe=True)
for sym, df in dfs_today.items():
    print(f"{sym}: {len(df)} 条分钟线")
```

`klines.get(period="5m")` 和 `klines.intraday(...)` 的区别：前者是历史分钟 K 线，可以按时间区间回溯；后者只关注当日走势，适合盘中看图或计算日内指标。

## 第七步：实时快照

实时行情接口支持两种查询方式，二选一：

**按代码查询**，适合关注列表：

```python
quotes = qd.quotes.get(symbols=["600519.SH", "00700.HK", "AAPL.US"], to_dataframe=True)
print(quotes[["symbol", "last_price", "prev_close", "volume", "ext.name", "ext.change_pct"]])
```

**按标的池查询**，一次拉取整个市场：

```python
all_a = qd.quotes.get(universes=["CN_Stock"], to_dataframe=True)
print(f"共 {len(all_a)} 只标的")
```

标的池 ID 有四个：`CN_Stock`（A 股，沪深京）、`CN_ETF`（ETF）、`US_Stock`（美股）、`HK_Stock`（港股）。

关于时效，有两点要分开理解：

- 文档 FAQ 写明**实时行情快照约 3 秒刷新一次**。这是服务端快照的更新频率，所以每秒轮询多次并不会拿到更多的新数据。
- 一次请求本身的响应时间是另一回事，和快照刷新频率无关。写轮询逻辑时，按快照刷新频率设计间隔，同时遵守自己方案的调用频率限制。

另外，接口定义中 `ext.change_pct` 是**小数**（0.01 表示 1%），换手率、振幅也是小数，展示前记得乘以 100。

## 第八步：用 pandas 整理数据

### 把多只标的拼成一张长表

```python
import pandas as pd

frames = []
for sym, df in dfs.items():
    frames.append(df.assign(symbol=sym))
panel = pd.concat(frames, ignore_index=True)
panel["trade_date"] = pd.to_datetime(panel["trade_date"])
panel = panel.sort_values(["symbol", "trade_date"])
```

### 计算收益率和均线

```python
panel["ret"] = panel.groupby("symbol")["close"].pct_change()
panel["ma20"] = panel.groupby("symbol")["close"].transform(lambda s: s.rolling(20).mean())
```

### 转成宽表做横向比较

```python
close_wide = panel.pivot(index="trade_date", columns="symbol", values="close")
print(close_wide.tail())
```

### 快照数据加工

```python
quotes["change_pct_display"] = (quotes["ext.change_pct"] * 100).round(2)
top = quotes.sort_values("ext.change_pct", ascending=False).head(10)
```

### 保存到本地

历史日 K 一般不会变化（复权口径除外），可以落盘缓存，减少重复请求：

```python
panel.to_csv("daily_klines.csv", index=False)
# 或者安装 pyarrow 后：panel.to_parquet("daily_klines.parquet")
```

如果缓存的是复权价格，要在文件名或字段里记下复权方式，因为新的除权发生后，前复权价格会整体变化。

## 第九步：不用 SDK，直接调 REST

其他语言或不方便装 SDK 的环境，可以直接调用 REST。Key 放在请求头 `X-API-Key` 中：

```bash
curl -G https://api.quantdash.net/v1/klines \
  -H "X-API-Key: $QUANTDASH_API_KEY" \
  -d symbol=600519.SH -d period=1d -d count=5
```

K 线接口返回的是列式数据：`data` 下每个字段是一个数组，相同下标对应同一根 K 线，`timestamp` 是毫秒时间戳。在 Python 里可以直接转成 DataFrame：

```python
import os
import requests
import pandas as pd

resp = requests.get(
    "https://api.quantdash.net/v1/klines",
    headers={"X-API-Key": os.environ["QUANTDASH_API_KEY"]},
    params={"symbol": "600519.SH", "period": "1d", "count": 5, "adjust": "forward"},
    timeout=30,
)
resp.raise_for_status()
df = pd.DataFrame(resp.json()["data"])
df["dt"] = pd.to_datetime(df["timestamp"], unit="ms", utc=True).dt.tz_convert("Asia/Shanghai")
print(df[["dt", "open", "high", "low", "close", "volume"]])
```

文档也支持在 URL 参数里用 `api_key` 传 Key，但这种方式只适合浏览器里临时调试，Key 容易留在日志和浏览器历史里，脚本中不建议使用。

## 第十步：封装成一个取数模块

把前面的步骤整理成一个小模块，策略代码只调用这几个函数：

```python
# data_source.py
import time
from quantdash import QuantDash, AuthenticationError, PermissionError, RateLimitError

_qd = QuantDash()  # 读取 QUANTDASH_API_KEY


def daily_bars(symbols, count=250, adjust="forward"):
    """多只标的的日 K，返回 {symbol: DataFrame}。"""
    return _qd.klines.batch(symbols, period="1d", count=count,
                            adjust=adjust, to_dataframe=True)


def snapshot(symbols=None, universe=None):
    """实时快照：传 symbols 或 universe 二选一。"""
    if universe:
        return _qd.quotes.get(universes=[universe], to_dataframe=True)
    return _qd.quotes.get(symbols=list(symbols), to_dataframe=True)


def safe_call(fn, *args, retries=3, wait=2.0, **kwargs):
    """统一处理鉴权、权限和限流错误。"""
    for attempt in range(retries):
        try:
            return fn(*args, **kwargs)
        except AuthenticationError:
            raise SystemExit("API Key 无效或缺失，请检查 QUANTDASH_API_KEY")
        except PermissionError as exc:
            raise SystemExit(f"当前方案没有该功能或市场的权限：{exc}")
        except RateLimitError:
            time.sleep(wait * (attempt + 1))
    raise RuntimeError("多次触发限流，请降低请求频率")
```

使用时：

```python
from data_source import daily_bars, snapshot, safe_call

bars = safe_call(daily_bars, ["600519.SH", "00700.HK", "AAPL.US"], count=120)
quotes = safe_call(snapshot, universe="HK_Stock")
```

这里的异常类（`AuthenticationError`、`PermissionError`、`RateLimitError`）都由 SDK 包直接导出。以后要换数据源或加缓存，只需要改 `data_source.py`。

## 放进项目前的检查清单

脚本在自己电脑上跑通，不代表放进定时任务或服务器后也能稳定运行。上线前建议逐条确认：

1. **Key 的来源**：服务器上的环境变量是否已配置，定时任务（如 cron）是否能读到同一个环境变量。很多"本地正常、定时任务报 Key 缺失"的问题都出在这里。
2. **复权口径**：所有取 K 线的地方是否都显式写了 `adjust`，缓存文件是否记录了复权方式。
3. **市场与权限**：用到的每个市场、每种周期是否都在当前方案内。可以在启动时对每个市场各请求一条数据，提前暴露 403。
4. **请求方式**：多只标的是否已经改用 `klines.batch`、`intraday_batch` 或按标的池查询快照，而不是逐只循环请求。
5. **轮询间隔**：快照轮询的间隔是否参考了"约 3 秒刷新一次"的文档口径，并且在方案的调用频率限制之内。
6. **时间处理**：区间参数是否统一用毫秒时间戳，REST 返回的 `timestamp` 是否按需要转换成本地时间再展示。
7. **失败兜底**：单只标的失败时是否会中断整个任务，失败列表有没有记录下来方便补取。

这几条都检查过，取数模块基本就可以交给策略和看板长期使用了。

## 常见错误排查

| 现象 | 可能原因 | 处理方法 |
| --- | --- | --- |
| 初始化时报需要 API Key | 环境变量没有在当前终端或进程中生效 | 在同一个终端里 `echo $QUANTDASH_API_KEY` 确认；IDE 里运行要单独配置环境变量 |
| 401 | API Key 无效或缺失 | 检查 Key 是否复制完整、是否已在控制台删除 |
| 403 | 当前方案不包含该功能或市场 | 确认订阅了对应市场；分钟 K 线和日 K 线是不同权限 |
| 429 | 请求频率超限 | 降低频率，多只标的改用批量接口；REST 返回中的 `retry_after_ms` 是建议等待时间 |
| 返回空数据 | 代码后缀写错、港股少前导 0、区间内无交易日 | 先用文档里的示例代码（如 `600519.SH`）验证 |
| 月线变成分钟线 | `1M` 和 `1m` 写混 | 月线是大写 `M` |
| 涨跌幅数值很小 | `change_pct` 是小数 | 展示前乘以 100 |

## 问答小结

**问：QuantDash Python SDK 怎么安装和鉴权？**
答：`pip install quantdash`（Python 3.9+），设置环境变量 `QUANTDASH_API_KEY` 后用 `QuantDash()` 初始化即可，不需要在代码里写 Key。

**问：一次请求能取多少根 K 线，更长的历史怎么取？**
答：REST 文档中 `count` 默认 100、最大 10000。更长的历史可以用毫秒时间戳 `start_time`、`end_time` 分段请求再拼接。

**问：`klines.get` 的分钟线和 `klines.intraday` 有什么区别？**
答：`klines.get(period="5m")` 是可按时间区间回溯的历史分钟 K 线；`klines.intraday` 返回当日分钟级走势，适合盘中使用。文档标注分钟 K 线适用于 A 股。

**问：怎样一次拿到整个市场的实时行情？**
答：用 `qd.quotes.get(universes=["CN_Stock"])`，标的池还有 `CN_ETF`、`US_Stock`、`HK_Stock`。文档写明快照约 3 秒刷新一次，这是刷新频率，不是接口响应时间。

**问：遇到 403 和 429 分别怎么处理？**
答：403 表示当前方案不包含该功能或市场，需要检查订阅；429 表示请求频率超限，应降低频率、改用批量接口，并参考返回中的 `retry_after_ms` 等待后重试。

> 行情数据和示例代码仅用于开发、研究与接口演示，不构成投资建议。完整参数说明见 [QuantDash 中文文档](https://docs.quantdash.net/zh-Hans)。
