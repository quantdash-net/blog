---
title: 行情请求失败时怎么处理：401、403、429 与 SDK 0.1.0 的重试
description: 区分密钥无效、没有权限和请求超限，并说明 Python SDK 0.1.0 会自动重试哪些错误、不会重试哪些错误。
date: 2026-11-16
category: 接口教程
tags: [错误处理, REST, Python SDK, 限流]
---
取数脚本里最贵的一种失败，是把“没有权限”当成临时故障反复重试，或者在 SDK 已经重试过限流之后，外面再套一层相同的循环。下面按 [REST 说明](https://docs.quantdash.net/zh-Hans/api-reference/introduction.md) 和 Python SDK 0.1.0 的行为把这两类分开。

安装、鉴权和正常调用见 [SDK 教程](/posts/python-sdk-klines-quotes-tutorial/)。返回成功但数据不完整时的检查见 [K 线质量检查](/posts/kline-quality-checks/)。

## 文档里的三个状态码

REST 说明列出的错误是：

| 状态码 | 文档说明 | 处理 |
| --- | --- | --- |
| 401 | API Key 无效或缺失 | 停止，检查环境变量或控制台里的 Key |
| 403 | 无权限，套餐不包含该功能或市场 | 停止，核对市场和周期是否已订阅 |
| 429 | 请求频率超限 | 读取等待时间后再决定是否重试 |

K 线接口的 OpenAPI 同样只列出这三个错误。[429 的响应体](https://docs.quantdash.net/zh-Hans/api-reference/openapi.json) 必填 `code`、`message`、`retry_after_ms`，最后一项是建议等待的毫秒数。401 和 403 的响应体必填 `code` 和 `message`，没有等待时间。

Key 放在请求头 `X-API-Key`。文档也允许查询参数 `api_key`，那是给浏览器临时调试的。脚本使用请求头，避免 Key 出现在 shell 历史和访问日志的 URL 里。不要把真实 Key 写进代码。

下面的函数只根据状态码和响应体决定下一步。429 的例子按接口规定带上 `retry_after_ms`。

```python
def rest_action(status: int, body: dict) -> str:
    """返回 ok、stop、retry，或 wait:<毫秒>。"""
    if status in (401, 403) or status == 400 or status == 404:
        return "stop"
    if status == 429:
        wait = body.get("retry_after_ms")
        if isinstance(wait, int) and not isinstance(wait, bool) and wait >= 0:
            return f"wait:{wait}"
        return "stop"
    if 500 <= status <= 599:
        return "retry"
    if status >= 400:
        return "stop"
    return "ok"
```

429 的正文按接口说明必须带 `retry_after_ms`。这个字段缺失时，函数选择停止，而不是自己挑一个秒数继续打。

直接调用 REST 时，按这个返回值分支：

```python
import os
import time
import requests

response = requests.get(
    "https://api.quantdash.net/v1/klines",
    headers={"X-API-Key": os.environ["QUANTDASH_API_KEY"]},
    params={"symbol": "600519.SH", "period": "1d", "count": 5, "adjust": "none"},
    timeout=30,
)
action = rest_action(response.status_code, response.json() if response.content else {})
if action.startswith("wait:"):
    time.sleep(int(action.split(":", 1)[1]) / 1000)
```

循环次数要有上限。上面只演示如何读出等待时间。

## SDK 0.1.0 已经会重试一部分错误

`QuantDash(max_retries=3)` 的默认重试次数是 3，也就是最多 4 次请求。SDK 0.1.0 会自动重试的是这些情况：

| 异常 | 是否自动重试 |
| --- | --- |
| `RateLimitError`（HTTP 429） | 会 |
| `InternalServerError`（HTTP 5xx） | 会 |
| `ConnectionError`、`TimeoutError` | 会 |
| `AuthenticationError`（401）、`PermissionError`（403） | 不会 |
| `BadRequestError`（400）、`NotFoundError`（404） | 不会 |

自动重试的等待时间是指数退避：基数 1 秒，按次数乘 2，再加上下 25% 以内的随机抖动，上限 30 秒。它不读取响应里的 `retry_after_ms`，`RateLimitError` 上也没有这个字段。要按服务端给出的毫秒等待，读 REST 响应体。

K 线接口文档列出的是 401、403 和 429。SDK 另外准备了 400 和 404 两类异常；业务代码先按文档里的三个状态码处理。没有 Key 时，`QuantDash()` 在构造阶段抛出 `ValueError`，提示设置 `QUANTDASH_API_KEY` 或传入 `api_key`，这时还不会发请求。传入非空字符串可以完成构造，Key 是否有效要等第一次请求。

业务代码里建议显式捕获 SDK 导出的类，避免和内置的 `PermissionError`、`ConnectionError`、`TimeoutError` 同名：

```python
import os
from quantdash import (
    AuthenticationError,
    PermissionError as QuantDashPermissionError,
    QuantDash,
    RateLimitError,
)

qd = QuantDash(api_key=os.environ["QUANTDASH_API_KEY"], max_retries=3)
try:
    data = qd.klines.get("600519.SH", period="1d", count=5, adjust="none")
except AuthenticationError:
    raise SystemExit("API Key 无效或缺失")
except QuantDashPermissionError:
    raise SystemExit("当前方案不包含该功能或市场")
except RateLimitError as exc:
    # SDK 已按自身退避重试过。异常上没有 retry_after_ms。
    raise SystemExit(f"限流仍然失败: status={exc.status_code}") from exc
```

要严格遵守 `retry_after_ms`，用上一节的 REST 分支。继续用 SDK 时，用 `max_retries` 控制次数，不要在 `except RateLimitError` 里再无上限地重试，否则默认的 4 次还会被再乘一层。

## 成功响应里仍可能缺数据

`klines.get` 在请求成功时返回 `data`，数组可以为空，空数组不会变成异常。空结果要用字段检查发现，不能只靠 `try/except`。

`klines.batch` 在 0.1.0 里按每 100 个代码分块，默认最多 5 个并发。某一块抛错时，错误记在函数内部的列表里，返回值只包含成功的代码，调用方拿不到那个错误列表。使用批量接口后，用请求列表减去返回字典的键：

```python
requested = ["600519.SH", "000001.SZ"]
result = qd.klines.batch(requested, period="1d", count=20, adjust="none", to_dataframe=True)
missing = [symbol for symbol in requested if symbol not in result]
```

`to_dataframe=True` 时，返回值是“代码到 DataFrame”的字典。类型标注里有一处写成了单个 DataFrame，以实际返回的字典为准。转换 DataFrame 时可能再请求一次标的名称；名称失败不影响 K 线。返回里缺了哪只代码，就记进 `missing`，再决定补取还是跳过。

## 问答

**问：403 应该换一个 Key 再试吗？**

答：文档把 401 定义为 Key 无效或缺失，把 403 定义为套餐不含该功能或市场。403 应停止并核对订阅，而不是更换 Key 后立即重试。

**问：SDK 会不会按照 retry_after_ms 休眠？**

答：0.1.0 的重试休眠使用指数退避和抖动，不读取 `retry_after_ms`，异常对象也不保存这个字段。要使用文档中的等待时间，需要读取 REST 响应体。

**问：批量接口返回的字典变短，算不算异常？**

答：0.1.0 不会因为部分分块失败而抛出。短字典要和请求列表比较后单独处理。

> 状态码见 [REST 说明](https://docs.quantdash.net/zh-Hans/api-reference/introduction.md)。重试行为对应 Python SDK 0.1.0。
