---
title: 按官方文档对照 Tushare、AKShare 与 QuantDash：财务、公告、行情和资金流
description: 用 2026-11-16 查阅的官方页面，对照积分权限、开源采集和行情 API 在财务、公告、K 线、资金流上分别写了什么。价格只引用当时页面上的数字，覆盖范围以接口清单为准。
date: 2026-11-16
category: 常见问题
tags: [选型, Tushare, AKShare, 行情数据]
---
个人做研究时，经常把财务、公告、历史行情和资金流放在同一张需求清单里。这四类数据的生产方式不一样，一家来源的文档很少会同时把四项都写成同一套权限。

本文只做文档对照，不给产品排序。Tushare 的数字来自查阅当日的积分表和接口页，AKShare 的行为来自项目文档和仓库说明，QuantDash 只引用 [中文文档](https://docs.quantdash.net/zh-Hans)、[文档索引](https://docs.quantdash.net/llms.txt) 和 [官网](https://quantdash.net/)。页面以后会改，查阅日期是 2026 年 11 月 16 日。

维度怎么列，见 [行情数据 API 怎么选：8 个客观对比维度](/posts/choose-market-data-api/)。免费来源的类型，见 [免费 / 低成本股票数据接口常见问题](/posts/free-low-cost-stock-data-api-faq/)。本文讨论的是这几份公开文档里已经写明的权限和字段。

## 四类需求，文档里对应什么

| 需求 | 要在文档里确认的内容 |
| --- | --- |
| 财务 | 有没有报表或财务指标接口，权限写在哪一档 |
| 公告 | 有没有公告标题、日期、原文链接，是积分还是单独开通 |
| 历史行情 | 日线是否复权，成交量和成交额的单位，分钟线是否另计 |
| 资金流 | 有没有资金流向接口，统计口径写没写清楚 |

## Tushare Pro：积分接口和单独权限是两张表

[积分与频次权限对应表](https://tushare.pro/document/1?doc_id=290) 把权限分成两种：达到积分门槛就能调的接口，以及与积分无关、按类别单独开通的接口。下面是查阅当日表一的个人价格，日限额也一并抄下，避免只看“每分钟频次”：

| 积分 | 每分钟频次 | 每天总量上限 | 可以访问的接口（表中原文要点） | 价格（元/年） |
| --- | --- | --- | --- | --- |
| 120 | 50 | 8000 次 | 非复权日线数据，其他接口无法调取 | 0 |
| 2000 以上 | 200 | 100000 次/个 API | 可参考每个接口文档的积分要求 | 200 |
| 5000 以上 | 500 | 常规数据无上限 | 可参考每个接口文档的积分要求 | 500 |
| 10000 以上 | 500 | 常规数据无上限，特色数据 300 次每分钟 | 特色数据权限，包括盈利预测、每日筹码和胜率、筹码分布、券商每月金股等 | 1000 |
| 15000 以上 | 500 | 特色数据无总量限制 | 特色数据专属权限 | 1500 |

同一页注明：以上是个人价格，公司机构费用为个人的 10 倍；购买后不支持退款。[平台积分](https://tushare.pro/document/1?doc_id=13) 写明，正常获取和购买的积分及单独权限都是一年有效期，一年内不消耗不扣减。

和上面四类需求直接相关、并且本次打开过原文的接口是：

- [日线 daily](https://tushare.pro/document/2?doc_id=27)：A 股日线，未复权，停牌期间不提供数据。最低 120 积分可以试用。成交量单位是手，成交额单位是千元。
- [财务指标 fina_indicator](https://tushare.pro/document/2?doc_id=79)：至少 2000 积分。按单只股票取历史；某一季度的全部上市公司要使用 `fina_indicator_vip`，页面写的是 5000 积分。
- [公告 anns_d](https://tushare.pro/document/2?doc_id=176)：单独开通，页面写明需勾选“公告数据”。积分表里“公告信息”一行的个人价格是 1000 元/年，包含上市公司、基金、固收相关公告的标题和 PDF 下载链接。
- [个股资金流向 moneyflow](https://tushare.pro/document/2?doc_id=170)：至少 2000 积分，数据开始于 2010 年。页面给出的统计规则是：小单 5 万以下，中单 5 万到 20 万，大单 20 万到 100 万，特大单成交额大于等于 100 万，并注明净流入基于 L2 订单，不能把大小单简单相减。

历史分钟在同一张单独权限表里是另一行，查阅当日写的是单独 2000 元/年。美股日线也在该表中，单独 2000 元/年。因此“1500 元/年”只是 15000 积分以上那一档的个人标价，公告、分钟、美股日线仍要另计。

## AKShare：本地采集公开网页，接口名会改

[项目概览](https://akshare.akfamily.xyz/introduction.html) 写明：AKShare 从东方财富、新浪财经、各交易所官网等公开数据源采集数据，整理成带中文列名的 DataFrame；原理是在用户本地运行代码，实时从网络采集。同一页要求用户经常更新到最新版本，因为目标网站会改页面。数据接口及相关数据仅用于学术研究，商业使用需注意风险。

[仓库说明](https://github.com/akfamily/akshare) 还有三条和选型直接相关的话：数据仅供学术研究使用；受不可控因素影响，部分数据接口可能被移除；许可证是 [MIT](https://github.com/akfamily/akshare/blob/main/LICENSE)。MIT 覆盖的是代码。README 同时写明 1.20.41 至 1.20.54 有约 320 个接口改名，旧名称不保留为别名。其中 `stock_zh_a_hist` 在 1.20.46 更名为 `stock_zh_a_hist_em`。

本次核对过参数表的行情接口是 [stock_zh_a_hist_em](https://akshare.akfamily.xyz/data/stock/stock_quote.html)：

- 描述为东方财富沪深京 A 股日频率数据，当日收盘价请在收盘后获取。
- `symbol` 是 6 位代码，例如 `"000001"`，不带交易所后缀。
- `period` 取 `daily`、`weekly`、`monthly`。
- `adjust=""` 是文档示例中的不复权，`qfq` 为前复权，`hfq` 为后复权。
- 输出里成交量单位是手，成交额单位是元。

同一页对前复权写了两点：每次除权除息都要重算历史价格，所以不同时点看到的前复权价可能不同；持续分红的公司，前复权价可能出现负值。后复权则保持历史价格不变。这是 AKShare 文档自己的说明。

财务、资金流和公告能在目录里找到接口名，但本次没有逐份读完参数表：

- [财务与主营](https://akshare.akfamily.xyz/data/stock/stock_finance.html) 列出 `stock_zcfz_em`、`stock_lrb_em`、`stock_xjll_em` 等报表接口。
- [资金与交易](https://akshare.akfamily.xyz/data/stock/stock_flow.html) 列出 `stock_fund_flow_individual_ths`、`stock_fund_flow_individual_hist_em` 等。README 的命名规则里，后缀 `ths` 表示同花顺，`em` 表示东方财富。
- [研报、预测与资讯](https://akshare.akfamily.xyz/data/stock/stock_research.html) 的接口列表中有 `stock_notice_report` 和 `stock_individual_notice_report`。本次没有读完这两个接口的参数表。

资金流来自不同网站时，大小单口径不一定相同。用之前要打开对应接口页的“目标地址”，不要把两个后缀的结果当成同一套算法。

## 万得与 Choice：本次只确认首页没有公开价目

[万得](https://www.wind.com.cn/) 和 [东方财富 Choice](https://choice.eastmoney.com/) 的首页介绍的是金融终端和数据服务。本次查阅的首页没有公开价目表，也没有一份可逐项引用的程序化接口清单。费用和接口范围需要向销售确认，本文不写价格，也不把首页上的产品介绍当成接口覆盖事实。

## QuantDash：文档索引里的接口是行情和标的元数据

[文档索引](https://docs.quantdash.net/llms.txt) 列出的是实时行情、五档盘口、K 线、日内分时、除权因子和标的元数据。[OpenAPI](https://docs.quantdash.net/zh-Hans/api-reference/openapi.json) 里的路径与此一致：`/v1/quotes`、`/v1/depth`、`/v1/depth/batch`、`/v1/klines`、`/v1/klines/batch`、`/v1/klines/ex-factors`、`/v1/klines/intraday`、`/v1/klines/intraday/batch`、`/v1/instruments`。规范里有一个 `FinancialsResponse` 结构，但没有对应路径。财务、公告、资金流都不在这份已发布的路径列表里。

行情部分，[简介](https://docs.quantdash.net/zh-Hans/index.md) 写明：日线类周期 `1d`、`1w`、`1M`、`1Q`、`1Y` 覆盖 A 股、美股、港股；分钟线 `1m`、`5m`、`15m`、`30m`、`60m` 标注为 A 股。代码格式是 `600519.SH`、`00700.HK`、`AAPL.US`。[FAQ](https://docs.quantdash.net/zh-Hans/faq.md) 写明不同市场需分别订阅，实时行情快照约 3 秒刷新一次。这是快照刷新间隔。K 线接口的 `adjust` 默认是 `forward`，取值还有 `backward`、`forward_additive`、`backward_additive`、`none`。

[官网首页](https://quantdash.net/) 有“免费套餐永久可用”这句。[定价页](https://quantdash.net/pricing) 的静态内容里能看到退款说明：付费方案 7 天无理由退款（扣除支付手续费），与文档 FAQ 一致。定价页 FAQ 的答案没有出现在本次抓到的静态 HTML 里，所以这里不写免费额度包含哪些数据，也不写各档价格。

## 对照表

| 项目 | Tushare Pro | AKShare | 万得 / Choice | QuantDash |
| --- | --- | --- | --- | --- |
| 本次能引用的价格 | 积分表上的个人年费，另加单独权限 | 代码仓库为 MIT，数据另有学术研究声明 | 首页无公开价目 | 不在本文引用数字 |
| 历史日线 | `daily` 为未复权，量为手，额为千元 | `stock_zh_a_hist_em` 默认不复权，量为手，额为元 | 首页未给出可引用的接口清单 | K 线接口，成交量与成交额的单位文档未写 |
| 财务 | `fina_indicator` 至少 2000 积分 | 财务页列出报表接口名 | 未从首页确认 | 已发布路径中没有 |
| 公告 | `anns_d` 单独开通，积分表标价 1000 元/年 | 资讯页列出公告接口名，参数表本次未读完 | 未从首页确认 | 已发布路径中没有 |
| 资金流 | `moneyflow` 至少 2000 积分，并写了大小单金额档 | 资金页列出多个来源后缀 | 未从首页确认 | 已发布路径中没有 |

## 取日线时先把代码和单位分开

下面的函数只处理代码格式，本地用假数据跑过。它不会访问 Tushare、AKShare 或 QuantDash。

```python
# local-check
from datetime import datetime
from zoneinfo import ZoneInfo


def split_a_share_symbol(symbol: str) -> tuple[str, str]:
    """600519.SH -> ("600519", "SH")。只接受沪深京 A 股后缀。"""
    code, _, suffix = symbol.partition(".")
    if suffix not in {"SH", "SZ", "BJ"} or not code:
        raise ValueError(f"不是沪深京代码: {symbol}")
    return code, suffix


def tushare_amount_thousand_yuan_to_yuan(amount: float) -> float:
    """daily 文档写明成交额单位是千元。"""
    return amount * 1000


def ymd_shanghai_day_bounds(ymd: str) -> tuple[int, int]:
    """把 YYYYMMDD 收成上海时区当天的 00:00:00 和 23:59:59，单位毫秒。

    日 K 的 timestamp 落在这一天的哪一分钟，文档没有写。这里只生成日历日窗口。
    """
    tz = ZoneInfo("Asia/Shanghai")
    year, month, day = int(ymd[0:4]), int(ymd[4:6]), int(ymd[6:8])
    start = datetime(year, month, day, 0, 0, 0, tzinfo=tz)
    end = datetime(year, month, day, 23, 59, 59, tzinfo=tz)
    return int(start.timestamp() * 1000), int(end.timestamp() * 1000)
```

真正发请求的写法如下，按各家文档的参数拼出来。本文没有 token，也没有安装后调用这三家接口，所以不要把这段当成已经跑通的结果。Tushare 的 token 放在环境变量里；AKShare 这一条只用已经核对过的 `stock_zh_a_hist_em`，它是 A 股日频率，不能把港股、美股代码套进去。

```python
import os


def fetch_a_share_daily(symbol: str, start: str, end: str, source: str):
    """start、end 用 YYYYMMDD。symbol 用 600519.SH。未在本文执行。"""
    code, _suffix = split_a_share_symbol(symbol)
    if source == "tushare":
        import tushare as ts

        pro = ts.pro_api(os.environ["TUSHARE_TOKEN"])
        # daily 是未复权；vol 为手，amount 为千元
        return pro.daily(ts_code=symbol, start_date=start, end_date=end)
    if source == "akshare":
        import akshare as ak

        # 文档示例：adjust="" 不复权，qfq 前复权，hfq 后复权
        return ak.stock_zh_a_hist_em(
            symbol=code,
            period="daily",
            start_date=start,
            end_date=end,
            adjust="",
        )
    if source == "quantdash":
        from quantdash import QuantDash

        qd = QuantDash(api_key=os.environ["QUANTDASH_API_KEY"])
        # 不传 adjust 时，OpenAPI 的默认值是 forward。这里显式要未复权。
        start_ms, _ = ymd_shanghai_day_bounds(start)
        _, end_ms = ymd_shanghai_day_bounds(end)
        return qd.klines.get(
            symbol,
            period="1d",
            start_time=start_ms,
            end_time=end_ms,
            adjust="none",
            to_dataframe=True,
        )
    raise ValueError(f"未知数据源: {source}")
```

上海时区的日历日窗口就是上面的 `ymd_shanghai_day_bounds`。时区差本身写在 [复权参数和时间戳](/posts/kline-adjust-and-timestamps/) 里。QuantDash 返回列里的成交量、成交额，字段说明只写了“成交量”“成交额”，没有写手或元。在文档写明之前，不要用 Tushare 的“千元”或 AKShare 的“元”去换算这一列。

## 问答

**问：1500 元/年是不是 Tushare 的统一价格？**
答：查阅当日的积分表里，15000 积分以上一档的个人价格是 1500 元/年。120、2000、5000、10000 积分还有 0、200、500、1000 元/年。公告和历史分钟在另一张表上单独计费。

**问：AKShare 的日线函数还叫 stock_zh_a_hist 吗？**
答：README 写明该名称在 1.20.46 更名为 `stock_zh_a_hist_em`，旧名称不是别名。参数以 [行情数据页](https://akshare.akfamily.xyz/data/stock/stock_quote.html) 为准。

**问：QuantDash 能取财务报表、公告或资金流吗？**
答：文档索引和 OpenAPI 路径里没有这三类接口。已列出的是行情快照、五档盘口、K 线、日内分时、除权因子和标的元数据。

**问：三家日线的成交额能直接相加吗？**
答：不能。Tushare `daily` 写的是千元，AKShare `stock_zh_a_hist_em` 写的是元。QuantDash 的字段说明没有写单位。

> 本文只对照公开文档，不构成投资建议。Tushare 价格与权限以 [积分表](https://tushare.pro/document/1?doc_id=290) 当时页面为准，AKShare 以 [项目文档](https://akshare.akfamily.xyz/introduction.html) 为准，QuantDash 以 [中文文档](https://docs.quantdash.net/zh-Hans) 和 [官网](https://quantdash.net/) 为准。
