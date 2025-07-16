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

在 Koishi 插件市场搜索 `emojiluna`，安装后启用即可。

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
| `-l <数量>` | 限制显示数量 | `-l 10` |


## 感谢

感谢 [Koishi](https://koishi.chat) 提供强大的机器人框架。
感谢所有为开源社区做出贡献的开发者们。

# EmojiLuna 表情包管理插件

一个功能强大的 Koishi 表情包管理插件，支持表情包的存储、分类、标签管理以及AI分析功能。

## 功能特性

### 🎨 表情包管理
- **多种添加方式**：支持拖拽上传、文件选择、URL导入
- **智能分类**：支持自定义分类和AI自动分类
- **标签系统**：灵活的标签管理，支持多标签搜索
- **搜索功能**：支持按名称、标签、分类搜索表情包

### 🤖 AI 功能
- **自动分析**：AI自动生成表情包名称、描述和标签
- **智能分类**：AI自动推荐合适的分类
- **批量处理**：支持批量重新分类现有表情包

### 🌐 前端界面
- **响应式设计**：支持桌面端和移动端访问
- **现代化UI**：基于 Element Plus 的美观界面
- **实时搜索**：输入即搜索，快速定位表情包
- **卡片展示**：直观的网格布局展示表情包

### 🔗 集成功能
- **Chatluna 集成**：可将表情包作为变量注入到对话中
- **HTTP API**：提供完整的REST API接口
- **随机表情**：支持随机获取表情包

## 配置说明

```yaml
plugins:
  emojiluna:
    # 存储路径配置
    storagePath: data/emojiluna  # 表情包存储目录

    # AI 功能配置
    model: openai/gpt-4-vision-preview  # AI模型选择
    autoAnalyze: true          # 启用AI自动分析
    autoCategorize: true       # 启用AI自动分类
    maxNewCategories: 3        # AI建议新分类的最大数量

    # 分类配置
    categories:               # 预设分类列表
      - 表情
      - 动物
      - 食物
      - 其他

    # Chatluna 集成
    injectVariables: true     # 是否注入表情包变量

    # HTTP 服务配置
    backendServer: true       # 启用HTTP后端服务
    backendPath: /emojiluna   # API路径前缀

    # AI 提示词配置
    analyzePrompt: |          # AI分析提示词
      请分析这个表情包图片，返回JSON格式...

    categorizePrompt: |       # AI分类提示词
      请为这个表情包选择合适的分类...
```

## 页面功能

### 📊 首页统计
- 表情包总数统计
- 分类数量统计
- 标签使用统计

### 🖼️ 表情包管理
- **网格视图**：卡片形式展示所有表情包
- **搜索过滤**：支持关键词搜索和筛选
- **批量操作**：选择多个表情包进行批量操作
- **详细编辑**：点击表情包可编辑名称、分类、标签

### 🏷️ 标签管理
- **标签统计**：显示每个标签的使用次数
- **批量编辑**：批量修改或删除标签
- **关联查看**：查看使用某标签的所有表情包

### 📁 分类管理
- **分类统计**：显示每个分类的表情包数量
- **预览功能**：预览分类下的表情包
- **层级管理**：支持分类的增删改操作

## HTTP API

### 表情包相关
- `GET /emojiluna/list` - 获取表情包列表
- `GET /emojiluna/search?keyword=关键词` - 搜索表情包
- `GET /emojiluna/get/:name` - 获取指定表情包
- `GET /emojiluna/random` - 获取随机表情包

### 分类相关
- `GET /emojiluna/categories` - 获取分类列表
- `GET /emojiluna/categories/:category` - 获取分类下的随机表情包

### 标签相关
- `GET /emojiluna/tags` - 获取所有标签
- `GET /emojiluna/tags/:tag` - 获取标签下的随机表情包

## 使用场景

1. **个人表情包收藏**：管理个人收集的表情包
2. **群组表情库**：为群组或社区提供共享表情包
3. **内容创作**：为内容创作提供素材库
4. **AI辅助整理**：利用AI功能自动整理大量表情包

## 技术栈

- **后端**：Koishi 插件框架
- **前端**：Vue 3 + Element Plus + TypeScript
- **AI集成**：Chatluna 平台
- **存储**：本地文件系统 + 数据库

## 许可证

MIT License
