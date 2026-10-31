---
title: 欢迎来到 QuantDash 博客
description: QuantDash 是什么、能提供哪些数据，以及从哪里开始。
date: 2026-10-31
tags: [公告, 入门]
---
QuantDash 是专业金融数据平台，为量化研究者和开发者提供金融市场数据 API，覆盖 **A 股（沪深京）、ETF、美股、港股**，通过 RESTful API 与 Python SDK 提供服务。

## 核心功能

- **K 线数据**：历史 OHLCV。日线类周期 `1d`、`1w`、`1M`、`1Q`、`1Y` 覆盖 A 股、美股、港股；分钟线 `1m`、`5m`、`15m`、`30m`、`60m` 适用于 A 股。支持前复权、后复权，支持批量获取。
- **实时行情**：最新价、涨跌幅、成交量等快照，支持按标的池批量查询。
- **五档盘口**：买卖五档深度数据，支持批量。
- **日内分时**：当日分钟级走势，支持批量。
- **标的信息**：名称、类型、上市状态等元数据，支持批量。

## 从哪里开始

- 官网：<https://quantdash.net/>
- 中文文档：<https://docs.quantdash.net/zh-Hans>
- Python SDK：<https://github.com/quantdash-net/QuantDash>

后续文章会围绕取数、复权、批量查询等主题展开，敬请关注。
