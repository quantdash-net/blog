---
title: 行情请求失败时怎么处理：401、403、429 与 SDK 0.1.0 的重试
description: 按 REST 文档区分密钥、权限和限流，并说明 quantdash 0.1.0 会对哪些异常自动重试。重试条件用安装包在本地断言过，没有向真实接口施压。
date: 2026-11-16
category: 接口教程
tags: [错误处理, REST, Python SDK, 限流]
---
取数脚本里最贵的一种失败，是把“没有权限”当成临时故障反复重试，或者在 SDK 已经重试过限流之后，外面再套一层相同的循环。本文按 [REST 说明](https://docs.quantdash.net/zh-Hans/api-reference/introduction.md) 和已发布的 `quantdash` 0.1.0 源码，把这两类分开。

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

下面的函数只根据状态码和响应体决定下一步。本文用符合上述结构的假 JSON 执行过，没有发送 HTTP 请求。

```python
# local-check
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

429 的正文若缺少 `retry_after_ms`，函数选择停止。OpenAPI 把这个字段列为必填；缺失说明响应和文档不一致，此时用一个自定的秒数去连打，会偏离服务端给出的等待时间。本文没有收到过真实的 429，不知道线上正文是否总是带这个字段。

直接使用 REST 时，可以按这个返回值分支。下面的骨架同样没有执行：

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

`QuantDash(max_retries=3)` 的默认重试次数是 3。源码里的循环是 `range(max_retries + 1)`，所以默认最多发出 4 次请求。阅读 `_should_retry` 可以得到这张表，并在本地用构造的异常对象断言过，没有联网：

| 异常 | 是否自动重试 |
| --- | --- |
| `RateLimitError`（HTTP 429） | 会 |
| `InternalServerError`（HTTP 5xx） | 会 |
| `ConnectionError`、`TimeoutError` | 会 |
| `AuthenticationError`（401）、`PermissionError`（403） | 不会 |
| `BadRequestError`（400）、`NotFoundError`（404） | 不会 |

等待时间由安装包自己计算：基数 1 秒，按尝试次数乘 2，再加上下 25% 以内的随机抖动，上限 30 秒。计算时不读取响应里的 `retry_after_ms`。`RateLimitError` 上也没有这个属性；解析函数只保存 `message`、`code`、`status_code` 和 `details`。因此，捕获 `RateLimitError` 之后无法从异常对象还原服务端建议的等待毫秒。

类文档写的是连接错误、超时和 5xx 会重试。实现里的判断函数还包括 429。以判断函数为准。K 线 OpenAPI 没有列出 400 和 404，SDK 仍准备了这两个异常类。没有真实响应，不能判断错误代码会不会以 400 或 404 返回。

没有 Key 时，`QuantDash()` 在构造阶段抛出 `ValueError`，提示设置 `QUANTDASH_API_KEY` 或传入 `api_key`。这个分支在清空环境变量后本地执行过，进程没有发起连接。传入任意非空字符串可以完成构造，构造本身不校验 Key 是否有效。

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

这段调用没有在本文执行。如果目标是严格遵守 `retry_after_ms`，使用上一节的 REST 分支；继续使用 SDK 时，用 `max_retries` 控制次数，不要在 `except RateLimitError` 里再无上限地重试，否则默认的 4 次会再被乘上一层。

## 成功响应里仍可能缺数据

`klines.get` 在 HTTP 成功时返回 `data`，数组可以为空，源码不会因为空数组抛异常。空结果要靠字段检查发现，不能只靠 `try/except`。

`klines.batch` 在 0.1.0 里按每 100 个代码分块，默认最多 5 个并发。某一块抛错时，错误记在函数内部的列表里，返回值只包含成功的代码，调用方拿不到那个错误列表。使用批量接口后，用请求列表减去返回字典的键：

```python
requested = ["600519.SH", "000001.SZ"]
result = qd.klines.batch(requested, period="1d", count=20, adjust="none", to_dataframe=True)
missing = [symbol for symbol in requested if symbol not in result]
```

`to_dataframe=True` 时，官方示例和 0.1.0 的实现都把返回值当作“代码到 DataFrame”的字典使用。类型标注里有一处把这个返回值写成单个 DataFrame，和实现不一致。另外，转换 DataFrame 可能额外请求一次标的名称；名称失败不影响 K 线字典。批量结果缺代码，可能是该块请求失败，也可能是服务端没有返回这个键。没有真实调用，本文不能区分这两种情况，只能要求调用方记录 `missing`。

## 问答

**问：403 应该换一个 Key 再试吗？**
答：文档把 401 定义为 Key 无效或缺失，把 403 定义为套餐不含该功能或市场。403 应停止并核对订阅，而不是更换 Key 后立即重试。

**问：SDK 会不会按照 retry_after_ms 休眠？**
答：0.1.0 的重试休眠使用指数退避和抖动，不读取 `retry_after_ms`，异常对象也不保存这个字段。要使用文档中的等待时间，需要读取 REST 响应体。

**问：批量接口返回的字典变短，算不算异常？**
答：0.1.0 不会因为部分分块失败而抛出。短字典要和请求列表比较后单独处理。

> 重试规则来自 quantdash 0.1.0 的本地源码断言。状态码说明以 [REST 文档](https://docs.quantdash.net/zh-Hans/api-reference/introduction.md) 为准。本文没有故意触发限流。
