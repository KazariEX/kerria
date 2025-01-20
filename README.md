# Kerria

[![version](https://img.shields.io/npm/v/kerria?color=FFEF78&labelColor=E48748&label=npm)](https://www.npmjs.com/package/kerria)
[![downloads](https://img.shields.io/npm/dm/kerria?color=FFEF78&labelColor=E48748&label=downloads)](https://www.npmjs.com/package/kerria)
[![license](https://img.shields.io/npm/l/kerria?color=FFEF78&labelColor=E48748&label=license)](/LICENSE)

这是一个渲染无关的文件处理管线。核心思路是将数据分为源数据（Source）与负载数据（Load）两类，源拥有以文件为单位的构建与监听生命周期，负载从源中派生，并在每一次源（或本身所依赖的初始状态）文件发生变化时输出。

## 安装

```shell
pnpm i kerria
```

## 使用方式

请参考[示例文件](playground/kerria.config.ts)。