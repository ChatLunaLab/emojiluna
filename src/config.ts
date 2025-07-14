import { Schema } from 'koishi'

export const Config = Schema.intersect([
    Schema.object({
        maxEmojiCount: Schema.number()
            .description('最大表情包数量')
            .min(10)
            .max(1000)
            .default(100),
        storagePath: Schema.path({
            filters: ['directory']
        })
            .description('表情包存储路径')
            .default('./data/emojiluna'),
        categories: Schema.array(Schema.string())
            .description('预定义分类')
            .role('table')
            .default(['可爱', '搞笑', '生气', '惊讶', '悲伤', '其他']),
        autoCategorize: Schema.boolean()
            .default(true)
            .description('是否启用AI自动分类'),
        autoAnalyze: Schema.boolean()
            .default(true)
            .description('是否启用AI信息解析'),
        autoCollect: Schema.boolean()
            .default(false)
            .description('是否启用自动获取表情包')
    }).description('基础配置'),

    Schema.object({
        model: Schema.dynamic('model').description('使用的AI模型'),
        categorizePrompt: Schema.string()
            .role('textarea')
            .default(
                `你是一个资深的表情包分类专家，具有丰富的网络文化和表情包使用经验。请根据表情包的视觉特征、情感表达、使用场景等维度进行精准分类。

现有分类体系：{categories}

分析要点：
1. 主要情感：开心、悲伤、愤怒、惊讶、恐惧、厌恶等基础情感
2. 风格特征：卡通、真人、动物、文字、GIF动图等
3. 使用场景：日常聊天、表达态度、回应他人、营造氛围等
4. 文化内涵：网络梗、流行文化、经典形象等

分类标准：
- 优先选择最能体现表情包核心情感的分类
- 考虑用户最可能的使用场景和搜索习惯
- 如果现有分类都不够准确，可建议1-2个新分类

请返回JSON格式：
{
  "category": "最合适的分类名称",
  "confidence": 0.85,
  "reason": "选择此分类的具体理由，包括视觉特征和情感分析",
  "newCategories": ["建议的新分类1", "建议的新分类2"]
}

注意：newCategories字段仅在现有分类不够准确时提供，且应该是简洁、通用的分类名称。`
            )
            .description('表情包分类提示词'),
        analyzePrompt: Schema.string()
            .role('textarea')
            .default(
                `你是一个专业的表情包内容分析师，需要全面分析表情包的各个维度，为用户提供详细、准确、实用的信息。

分析维度：
1. 视觉元素：角色、动作、表情、颜色、构图等
2. 情感层次：表面情感、深层含义、情感强度
3. 文化背景：来源、梗的背景、流行程度
4. 使用价值：适用场景、表达效果、传播潜力

命名原则：
- 简洁明了，3-8个字符
- 体现核心特征或情感
- 便于记忆和搜索
- 避免过于复杂或生僻的词汇

标签策略（重点优化）：
- 标签数量：4-6个精选标签，避免冗余
- 标签层次：
  * 核心情感标签（必需）：如"开心"、"生气"、"无奈"、"兴奋"
  * 视觉特征标签（推荐）：如"卡通"、"真人"、"动物"、"文字"
  * 使用场景标签（推荐）：如"聊天"、"回复"、"表态"、"调侃"
  * 文化元素标签（可选）：如"网络梗"、"经典"、"流行"、"二次元"
- 标签质量：
  * 使用通俗易懂的词汇
  * 考虑用户搜索习惯和词汇偏好
  * 平衡具体性和通用性
  * 避免过于专业或生僻的术语

请返回JSON格式：
{
  "name": "简洁准确的表情包名称",
  "category": "最适合的分类（从现有分类中选择或建议新分类）",
  "tags": ["核心情感", "视觉特征", "使用场景", "文化元素"],
  "description": "50-100字的详细描述，包含视觉特征和情感内容",
  "newCategories": ["建议的新分类（仅在需要时提供）"]
}

要求：
- 分析要客观准确，避免主观臆测
- 标签要实用，便于后续搜索和分类
- 描述要生动具体，帮助用户理解表情包内涵
- 名称要简洁易记，体现表情包特点`
            )
            .description('表情包信息解析提示词'),
        maxNewCategories: Schema.number()
            .min(1)
            .max(3)
            .default(2)
            .description('最多建议新分类数量')
    }).description('AI功能配置'),

    Schema.object({
        minEmojiSize: Schema.number()
            .description('单个表情包最小大小(KB)')
            .min(1)
            .max(1000)
            .default(10),
        maxEmojiSize: Schema.number()
            .description('单个表情包最大大小(MB)')
            .min(1)
            .max(2)
            .default(2),
        similarityThreshold: Schema.number()
            .description('表情包相似度阈值(0-1)')
            .min(0)
            .max(1)
            .role('slider')
            .default(0.8),
        whitelistGroups: Schema.array(Schema.string())
            .description('表情包获取群白名单')
            .role('table')
            .default([])
    }).description('自动获取配置')
])

export interface Config {
    maxEmojiCount: number
    storagePath: string
    categories: string[]
    autoCategorize: boolean
    autoAnalyze: boolean
    autoCollect: boolean
    model: string
    categorizePrompt: string
    analyzePrompt: string
    maxNewCategories: number
    minEmojiSize: number
    maxEmojiSize: number
    similarityThreshold: number
    whitelistGroups: string[]
}

export const name = 'emojiluna'
