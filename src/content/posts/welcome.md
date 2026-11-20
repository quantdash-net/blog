---
title: 欢迎来到 QuantDash 博客
description: QuantDash 是什么、能提供哪些数据，以及从哪里开始。
date: 2026-10-31
category: 版本更新
tags: [公告, 入门]
---
我们做的是面向量化研究和交易工具的行情 API，覆盖 **A 股（沪深京）、ETF、美股、港股**，用 REST 和 Python SDK 提供。

## 核心功能

- **K 线数据**：历史 OHLCV。日线类周期 `1d`、`1w`、`1M`、`1Q`、`1Y` 覆盖 A 股、美股、港股；分钟线 `1m`、`5m`、`15m`、`30m`、`60m` 适用于 A 股。支持前复权、后复权，支持批量获取。
- **实时行情**：最新价、涨跌幅、成交量等快照，支持按标的池批量查询。快照约 3 秒刷新一次，这是行情更新间隔，不是单次请求的耗时。
- **五档盘口**：买卖五档的价格和数量，支持批量。
- **日内分时**：当日分钟级走势，支持批量。
- **标的信息**：名称、类型、上市日期等元数据，支持批量查询。

## 从哪里开始

先跑通日 K：[一套代码取四个市场的 K 线](/posts/multi-market-klines/)。需要把环境、批量、快照和分时串起来，看 [Python SDK 教程](/posts/python-sdk-klines-quotes-tutorial/)。

- 官网：<https://quantdash.net/>
- 中文文档：<https://docs.quantdash.net/zh-Hans>
- Python SDK：<https://github.com/quantdash-net/QuantDash>
