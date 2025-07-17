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
    newCategories?: string[]
}

export interface AIAnalyzeResult {
    name: string
    category: string
    tags: string[]
    description: string
    newCategories?: string[]
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
    }
}
