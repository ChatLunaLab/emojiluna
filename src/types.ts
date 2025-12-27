export interface EmojiItem {
    id: string
    name: string
    category: string
    path: string
    size: number
    createdAt: Date
    tags: string[]
}

export interface Category {
    id: string
    name: string
    description?: string
    emojiCount: number
    createdAt: Date
}

export interface EmojiSearchOptions {
    keyword?: string
    category?: string
    tags?: string[]
    limit?: number
    offset?: number
}

export interface EmojiAddOptions {
    name: string
    category?: string
    tags?: string[]
    description?: string
    imageData?: string
}

export interface AICategorizeResult {
    category: string
    confidence: number
    reason: string
    newCategory?: string
}

export interface AIAnalyzeResult {
    name: string
    category: string
    tags: string[]
    description: string
    newCategory?: string
}

/**
 * Options for importing emojis from a local folder
 */
export interface FolderImportOptions {
    folderPath: string              // Absolute path to folder
    useSubfoldersAsCategories: boolean  // Use subfolder names as categories
    defaultCategory?: string        // Default category for root-level files
    recursive: boolean              // Scan subfolders recursively
    aiAnalysis: boolean             // Run AI analysis on imported emojis
    skipExisting: boolean           // Skip files that already exist in database
}

/**
 * Result of a folder import operation
 */
export interface FolderImportResult {
    success: boolean
    imported: number
    skipped: number
    failed: number
    errors: string[]
    importedEmojis: EmojiItem[]
}

/**
 * Information about a scanned folder
 */
export interface FolderScanResult {
    folderPath: string
    files: ScannedFile[]
    subfolders: string[]
    totalFiles: number
}

/**
 * Information about a scanned file
 */
export interface ScannedFile {
    path: string
    name: string
    category: string      // Derived from subfolder or default
    size: number
}

/**
 * 图片内容类型（用于过滤无用图片）
 */
export type ImageContentType =
    | 'emoji' // 表情包
    | 'sticker' // 贴纸
    | 'meme' // 梗图
    | 'comic' // 漫画/四格漫画
    | 'anime' // 动漫截图/二次元图片
    | 'pet' // 宠物图片
    | 'food' // 美食图片
    | 'scenery' // 风景图片
    | 'selfie' // 自拍照
    | 'screenshot_system' // 系统截图
    | 'screenshot_game' // 游戏截图
    | 'screenshot_chat' // 聊天截图
    | 'screenshot_video' // 视频截图
    | 'screenshot_web' // 网页截图
    | 'photo_people' // 人物照片
    | 'photo_product' // 商品图片
    | 'artwork' // 艺术作品/插画
    | 'text_only' // 纯文字图片
    | 'qrcode' // 二维码
    | 'advertisement' // 广告图片
    | 'document' // 文档截图
    | 'diagram' // 图表/流程图
    | 'news' // 新闻截图
    | 'logo' // Logo/图标
    | 'nsfw' // 不适宜内容
    | 'low_quality' // 低质量/模糊图片
    | 'other' // 其他

/**
 * 所有可用的图片类型列表
 */
export const IMAGE_CONTENT_TYPES: { type: ImageContentType; label: string; description: string }[] = [
    { type: 'emoji', label: '表情包', description: '经典表情包，带有情感表达的图片' },
    { type: 'sticker', label: '贴纸', description: '可爱的贴纸图片，通常有透明背景' },
    { type: 'meme', label: '梗图', description: '网络流行梗图，带有幽默元素' },
    { type: 'comic', label: '漫画', description: '漫画截图或四格漫画' },
    { type: 'anime', label: '动漫图片', description: '动漫截图或二次元风格图片' },
    { type: 'pet', label: '宠物图片', description: '猫狗等宠物的可爱图片' },
    { type: 'food', label: '美食图片', description: '食物或饮品的图片' },
    { type: 'scenery', label: '风景图片', description: '自然风景或城市风景' },
    { type: 'selfie', label: '自拍照', description: '个人自拍照片' },
    { type: 'screenshot_system', label: '系统截图', description: '操作系统或软件界面截图' },
    { type: 'screenshot_game', label: '游戏截图', description: '游戏画面截图' },
    { type: 'screenshot_chat', label: '聊天截图', description: '聊天记录截图' },
    { type: 'screenshot_video', label: '视频截图', description: '视频播放器截图' },
    { type: 'screenshot_web', label: '网页截图', description: '网页内容截图' },
    { type: 'photo_people', label: '人物照片', description: '普通人物照片' },
    { type: 'photo_product', label: '商品图片', description: '商品展示图片' },
    { type: 'artwork', label: '艺术作品', description: '绘画、插画等艺术作品' },
    { type: 'text_only', label: '纯文字图片', description: '只包含文字的图片' },
    { type: 'qrcode', label: '二维码', description: '二维码或条形码图片' },
    { type: 'advertisement', label: '广告图片', description: '广告或营销图片' },
    { type: 'document', label: '文档截图', description: '文档、PDF等截图' },
    { type: 'diagram', label: '图表', description: '图表、流程图、思维导图' },
    { type: 'news', label: '新闻截图', description: '新闻文章截图' },
    { type: 'logo', label: 'Logo图标', description: 'Logo、图标或品牌标识' },
    { type: 'nsfw', label: '不适宜内容', description: '成人或不适宜公开的内容' },
    { type: 'low_quality', label: '低质量图片', description: '模糊、损坏或质量很差的图片' },
    { type: 'other', label: '其他', description: '无法归类的其他图片' }
]

/**
 * 默认接受的图片类型（适合作为表情包的类型）
 */
export const DEFAULT_ACCEPTED_IMAGE_TYPES: ImageContentType[] = [
    'emoji',
    'sticker',
    'meme',
    'comic',
    'anime',
    'pet',
    'artwork'
]

/**
 * AI 图片类型过滤结果
 */
export interface AIImageFilterResult {
    imageType: ImageContentType
    isAcceptable: boolean
    confidence: number
    reason: string
}

declare module '@koishijs/console' {
    interface Events {
        'emojiluna/getEmojiList': (
            options?: EmojiSearchOptions
        ) => Promise<EmojiItem[]>
        'emojiluna/searchEmoji': (keyword: string) => Promise<EmojiItem[]>
        'emojiluna/getCategories': () => Promise<Category[]>
        'emojiluna/getAllTags': () => Promise<string[]>
        'emojiluna/updateEmojiTags': (
            id: string,
            tags: string[]
        ) => Promise<boolean>
        'emojiluna/updateEmojiCategory': (
            id: string,
            category: string
        ) => Promise<boolean>
        'emojiluna/deleteEmoji': (id: string) => Promise<boolean>
        'emojiluna/addCategory': (
            name: string,
            description: string
        ) => Promise<Category>
        'emojiluna/deleteCategory': (id: string) => Promise<boolean>
        'emojiluna/addEmoji': (emojiData: EmojiAddOptions) => Promise<EmojiItem>
        'emojiluna/getBaseUrl': () => Promise<string>
        'emojiluna/analyzeEmoji': (emojiId: string) => Promise<{
            success: boolean
            updates?: string[]
            result?: AIAnalyzeResult
            oldData?: {
                name: string
                category: string
                tags: string[]
            }
            newData?: {
                name: string
                category: string
                tags: string[]
                description: string
            }
            message?: string
        }>
        'emojiluna/addEmojis': (
            emojis: EmojiAddOptions[],
            aiAnalysis: boolean
        ) => Promise<EmojiItem[]>
        'emojiluna/scanFolder': (
            folderPath: string
        ) => Promise<FolderScanResult>
        'emojiluna/importFromFolder': (
            options: FolderImportOptions
        ) => Promise<FolderImportResult>
    }
}
