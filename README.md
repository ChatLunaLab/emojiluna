<div align="center">

# koishi-plugin-emojiluna

_智能表情包管理插件，支持AI自动分类和标签管理_

## [![npm](https://img.shields.io/npm/v/koishi-plugin-emojiluna)](https://www.npmjs.com/package/koishi-plugin-emojiluna) [![npm](https://img.shields.io/npm/dm/koishi-plugin-emojiluna)](https://www.npmjs.com/package/koishi-plugin-emojiluna)

![node version](https://img.shields.io/badge/node-%3E=18-green) ![github top language](https://img.shields.io/github/languages/top/ChatLunaLab/emojiluna?logo=github)

</div>

## 特性

1. 智能表情包管理，支持批量导入
2. AI自动分类和标签识别
3. 快速搜索和筛选功能
4. 分类管理，支持自定义分类
5. 文件大小和格式优化

## 部署

在 Koishi 插件市场搜索 `emojiluna` ，安装后启用即可。

## 使用

### 基础命令

#### 添加表情包

```
emojiluna add <名称>
```

上传图片并添加为表情包，支持自动分类

#### 查看表情包列表

```
emojiluna.list [选项]
```

查看所有表情包，支持按分类筛选

#### 搜索表情包

```
emojiluna.search <关键词>
```

根据关键词搜索表情包

#### 分类管理

```
emojiluna.category add <分类名>
```

添加新的表情包分类

```
emojiluna.category.list
```

查看所有分类

### 命令选项

| 选项 | 说明 | 示例 |
|------|------|------|
| `-c <分类>` | 按分类筛选 | `-c 可爱` |
| `-t <标签>` | 按标签筛选 | `-t 搞笑` |
| `-l <数量>` | 限制显示数量 | `-l 10`

## HTTP API

### 表情包相关

* `GET /emojiluna/list` - 获取表情包列表
* `GET /emojiluna/search?keyword=关键词` - 搜索表情包
* `GET /emojiluna/get/:name` - 获取指定表情包
* `GET /emojiluna/random` - 获取随机表情包

### 分类相关

* `GET /emojiluna/categories` - 获取分类列表
* `GET /emojiluna/categories/:category` - 获取指定分类下的随机表情包

### 标签相关

* `GET /emojiluna/tags` - 获取所有标签
* `GET /emojiluna/tags/:tag` - 获取指定标签下的随机表情包

## 感谢

感谢 [Koishi](https://koishi.chat) 提供强大的机器人框架。
感谢所有为开源社区做出贡献的开发者们。
