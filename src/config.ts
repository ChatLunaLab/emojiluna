import { Schema } from 'koishi'
import {
    DEFAULT_ACCEPTED_IMAGE_TYPES,
    IMAGE_CONTENT_TYPES,
    ImageContentType
} from './types'

export const Config = Schema.intersect([
    Schema.object({
        maxEmojiCount: Schema.number()
            .description('最大表情包数量')
            .min(10)
            .max(1000)
            .default(100),
        selfUrl: Schema.string().description('服务器地址').default(''),
        storagePath: Schema.path({
            filters: ['directory']
        })
            .description('表情包存储路径')
            .default('./data/emojiluna'),
        categories: Schema.array(Schema.string())
            .description('预定义分类')
            .role('table')
            .default([
                '动漫角色',
                '游戏角色',
                '影视角色',
                '原创角色',
                '动物萌宠',
                '食物饮品',
                '日常物品',
                '文字表情',
                '真人表情',
                '其他'
            ]),
        autoCategorize: Schema.boolean()
            .default(true)
            .description('是否启用AI自动分类'),
        autoAnalyze: Schema.boolean()
            .default(true)
            .description('是否启用AI信息解析'),
        autoCollect: Schema.boolean()
            .default(false)
            .description('是否启用自动获取表情包'),
        triggerWithName: Schema.boolean()
            .default(false)
            .description(
                '是否启用触发词匹配，当已有表情包名称与消息匹配时，自动发送表情包'
            )
    }).description('基础配置'),

    Schema.object({
        model: Schema.dynamic('model').description('使用的AI模型')
    }).description('AI功能配置'),

    Schema.object({
        categorizePrompt: Schema.string()
            .role('textarea')
            .default(
                `你是一个资深的表情包分类专家，具有丰富的ACG文化、网络文化和表情包使用经验。请根据表情包的角色来源、作品归属、物品特征等维度进行精准分类。

现有分类列表：{categories}

分类优先级（从高到低）：
1. 作品来源：如果能识别出表情包来自某个动漫、游戏、影视作品，优先按作品名称分类（如"原神"、"蜡笔小新"、"海绵宝宝"等）
2. 角色归属：如果能识别出具体角色但无法确定作品，按角色类型分类（如"动漫角色"、"游戏角色"、"影视角色"、"原创角色"等）
3. 主体内容：如果不涉及特定角色，按表情包的主体内容分类（如"动物萌宠"、"食物饮品"、"日常物品"等）
4. 表现形式：以上都不适用时，按表现形式分类（如"文字表情"、"真人表情"等）

分析要点：
1. 角色识别：观察画风、角色特征、服装、标志性元素，判断是否来自已知作品
2. 画风判断：日系动漫、欧美卡通、国产动画、像素风、写实风等
3. 物品识别：如果主体是物品（猫猫狗狗、食物、日用品等），归入对应物品分类
4. 避免用情绪分类：不要用"开心"、"悲伤"、"生气"等情绪作为分类名，情绪应体现在标签中

分类标准：
- 优先选择最能体现表情包来源或主体特征的分类
- 如果识别出具体作品，建议以作品名作为新分类
- 如果现有分类都不够准确，可建议1-2个新分类（优先以作品名或角色系列命名）

请返回JSON格式：
{
  "category": "基于现有分类决定的分类名称",
  "confidence": 0.85,
  "reason": "选择此分类的具体理由，说明识别到的角色/作品/物品特征",
  "newCategory": "建议的新分类（如识别到具体作品名则填写作品名）",
}

注意：newCategory字段仅在现有分类不够准确时提供，优先使用具体的作品名或角色系列名作为新分类名称。`
            )
            .description('表情包分类提示词'),
        analyzePrompt: Schema.string()
            .role('textarea')
            .default(
                `你是一个专业的表情包内容分析师，需要全面分析表情包的各个维度，重点识别角色来源、作品归属和物品特征，为用户提供详细、准确、实用的信息。

现有分类列表：{categories}

分析维度：
1. 角色与作品识别：识别表情包中的角色、判断来自哪个动漫/游戏/影视作品
2. 物品与主体识别：如果主体是动物、食物、物品等，明确识别具体种类
3. 视觉元素：画风、动作、表情、颜色、构图等
4. 情感表达：表情包传达的情感和使用场景

命名原则：
- 简洁明了，3-8个字符
- 如果能识别角色，以"角色名+动作/表情"命名（如"小新摆烂"、"派蒙吃惊"）
- 如果是物品/动物，以"主体+状态"命名（如"猫猫瘫倒"、"柴犬微笑"）
- 如果无法识别角色，以"表情描述"命名（如"无语望天"、"疯狂点头"）
- 便于记忆和搜索

分类原则（与分类prompt一致）：
- 优先按作品名分类（如识别出来自"原神"就分到"原神"类）
- 其次按角色类型分类（如"动漫角色"、"游戏角色"）
- 再次按主体内容分类（如"动物萌宠"、"食物饮品"）
- 最后按表现形式分类（如"文字表情"、"真人表情"）
- 不要用情绪（如"开心"、"悲伤"）作为分类

标签策略（重点优化）：
- 标签数量：4-6个精选标签，避免冗余
- 标签优先级（从高到低）：
  * 角色/作品标签（最高优先级）：如果能识别角色或作品，必须包含。如"派蒙"、"原神"、"海绵宝宝"、"柴犬"
  * 物品/主体标签（高优先级）：描述表情包的主体是什么。如"猫"、"狗"、"食物"、"机器人"
  * 情感/表情标签（中优先级）：描述表情包表达的情感。如"开心"、"无语"、"生气"、"摆烂"、"震惊"
  * 动作/状态标签（中优先级）：描述角色或物品的动作。如"奔跑"、"吃东西"、"睡觉"、"跳舞"
  * 风格/形式标签（低优先级）：如"二次元"、"像素风"、"真人"、"手绘"
- 标签质量：
  * 使用通俗易懂的词汇
  * 考虑用户搜索习惯和词汇偏好
  * 平衡具体性和通用性
  * 避免过于专业或生僻的术语

请返回JSON格式：
{
  "name": "简洁准确的表情包名称",
  "category": "最适合的分类（从现有分类中选择或建议新分类）",
  "tags": ["角色/作品", "物品/主体", "情感表情", "动作状态", "风格形式"],
  "description": "50-100字的详细描述，重点描述角色来源、物品特征和情感表达",
  "newCategory": "建议的新分类（仅在需要时提供，优先用作品名）"
}

要求：
- 分析要客观准确，重点识别角色和作品来源
- 标签要实用，角色和作品标签最重要，便于后续搜索和分类
- 描述要生动具体，优先说明角色/物品是什么，再描述情感和动作
- 名称要简洁易记，如果有角色就包含角色名`
            )
            .description('表情包信息解析提示词'),
        imageFilterPrompt: Schema.string()
            .role('textarea')
            .default(
                `你是一个图片内容分析专家，需要判断图片的类型并决定是否适合作为表情包收集。

请分析这张图片属于以下哪种类型：
${IMAGE_CONTENT_TYPES.map((item) => `- ${item.type}: ${item.label} - ${item.description}`).join('\n')}

分析要点：
1. 观察图片的主要内容和特征
2. 判断图片的来源（截图、照片、设计图等）
3. 评估图片是否具有表情包价值（情感表达、趣味性、传播性）
4. 识别低质量或无用的图片（模糊、广告、二维码等）

请返回JSON格式：
{
  "imageType": "类型代码（从上述列表中选择）",
  "confidence": 0.85,
  "reason": "判断理由",
  "isUseful": true
}

注意：
- imageType 必须是上述类型代码之一
- confidence 表示判断置信度（0-1）
- isUseful 表示这张图片是否有收藏价值（低质量、广告、二维码等应该为 false）`
            )
            .description('图片类型过滤提示词'),
        injectVariablesPrompt: Schema.string()
            .role('textarea')
            .default(
                `你可以使用以下表情包来丰富你的回复。当你想要表达某种情感或反应时，可以使用这些表情包。

可用表情包列表：
{emojis}

使用方式：在回复中使用 [表情包名称](URL) 的格式来插入表情包。`
            )
            .description('变量注入提示词（用于 ChatLuna 集成）')
    }).description('提示词配置'),

    Schema.object({
        injectVariables: Schema.boolean()
            .default(true)
            .description(
                '是否启用变量注入到 ChatLuna。开启后可以使用 {emojis} 变量注入表情包信息'
            ),
        injectVariablesLimit: Schema.number()
            .default(50)
            .min(10)
            .max(500)
            .description('注入表情包数量限制'),
        backendServer: Schema.boolean()
            .description('是否启用后端服务器')
            .default(false),
        backendPath: Schema.string()
            .description('后端服务器路径')
            .default('/emojiluna')
    }).description('API 配置'),

    Schema.object({
        minEmojiSize: Schema.number()
            .description('单个表情包最小大小(KB)')
            .min(1)
            .max(1000)
            .default(10),
        maxEmojiSize: Schema.number()
            .description('单个表情包最大大小(MB)')
            .min(1)
            .max(8)
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
            .default([]),
        emojiFrequencyThreshold: Schema.number()
            .description(
                '表情包在10分钟内发送次数阈值（达到此次数才视为有效表情包）'
            )
            .min(1)
            .max(20)
            .default(3),
        groupAutoCollectLimit: Schema.dict(
            Schema.object({
                hourLimit: Schema.number()
                    .default(20)
                    .description('每小时自动获取表情包数量限制'),
                dayLimit: Schema.number()
                    .default(100)
                    .description('每天自动获取表情包数量限制')
            })
        )
            .role('table')
            .description('群组自动获取表情包限制'),
        enableImageTypeFilter: Schema.boolean()
            .default(true)
            .description('是否启用 AI 图片类型过滤（过滤无用图片）'),
        acceptedImageTypes: Schema.array(
            Schema.union(
                IMAGE_CONTENT_TYPES.map((item) =>
                    Schema.const(item.type).description(item.label)
                )
            )
        )
            .description('接受的图片类型（只有这些类型的图片会被收集）')
            .default(DEFAULT_ACCEPTED_IMAGE_TYPES as ImageContentType[])
    }).description('自动获取配置')
])

export interface Config {
    maxEmojiCount: number
    storagePath: string
    categories: string[]
    autoCategorize: boolean
    triggerWithName: boolean
    autoAnalyze: boolean
    autoCollect: boolean
    model: string
    selfUrl: string
    categorizePrompt: string
    analyzePrompt: string
    imageFilterPrompt: string
    injectVariablesPrompt: string
    minEmojiSize: number
    maxEmojiSize: number
    similarityThreshold: number
    whitelistGroups: string[]
    emojiFrequencyThreshold: number
    injectVariables: boolean
    injectVariablesLimit: number
    backendServer: boolean
    backendPath: string
    groupAutoCollectLimit: Record<
        string,
        { hourLimit: number; dayLimit: number }
    >
    enableImageTypeFilter: boolean
    acceptedImageTypes: ImageContentType[]
}

export const name = 'emojiluna'
