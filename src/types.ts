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
