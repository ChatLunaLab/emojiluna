import { Context, Service } from 'koishi'
import { Config } from './config'
import {
    AIAnalyzeResult,
    AICategorizeResult,
    Category,
    EmojiAddOptions,
    EmojiItem,
    EmojiSearchOptions
} from './types'
import { chunkArray, generateId } from './utils'
import path from 'path'
import fs from 'fs/promises'
import { randomUUID } from 'crypto'
import { parseRawModelName } from 'koishi-plugin-chatluna/llm-core/utils/count_tokens'
import { ChatLunaChatModel } from 'koishi-plugin-chatluna/llm-core/platform/model'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { getMessageContent } from 'koishi-plugin-chatluna/utils/string'

type ParseResult<T> = T | null

const tryParse = <T>(text: string): ParseResult<T> => {
    try {
        return JSON.parse(text.trim())
    } catch {
        return null
    }
}

const extractors = [
    (text: string) => text.trim(),
    (text: string) =>
        text.replace(/```(?:json|JSON)?\s*/g, '').replace(/```\s*$/g, ''),
    (text: string) => {
        const start = text.indexOf('{'),
            end = text.lastIndexOf('}')
        return start !== -1 && end !== -1 && start < end
            ? text.substring(start, end + 1)
            : text
    },
    (text: string) => {
        const start = text.indexOf('{')
        if (start === -1) return text
        let count = 0,
            end = -1
        for (let i = start; i < text.length; i++) {
            if (text[i] === '{') count++
            else if (text[i] === '}' && --count === 0) {
                end = i
                break
            }
        }
        return end !== -1 ? text.substring(start, end + 1) : text
    }
]

export class EmojiLunaService extends Service {
    private _emojiStorage: Record<string, EmojiItem> = {}
    private _categories: Record<string, Category> = {}
    private _model: ChatLunaChatModel | null = null

    constructor(
        ctx: Context,
        public config: Config
    ) {
        super(ctx, 'emojiluna', true)
        defineDatabase(ctx)
        this.initializeStorage()
        this.initializeAI()
    }

    private async initializeStorage() {
        const storageDir = path.resolve(
            this.ctx.baseDir,
            this.config.storagePath
        )

        try {
            await fs.access(storageDir)
        } catch {
            await fs.mkdir(storageDir, { recursive: true })
        }

        this.ctx.on('ready', async () => {
            await this.loadEmojis()
            await this.loadCategories()
        })

        this.ctx.on('dispose', () => {
            this._emojiStorage = {}
            this._categories = {}
            this._model = null
        })
    }

    public async initializeAI() {
        if (!this.config.autoCategorize && !this.config.autoAnalyze) return

        try {
            const [platform, modelName] = parseRawModelName(this.config.model)
            await this.ctx.chatluna.awaitLoadPlatform(platform)
            this._model = await this.ctx.chatluna.createChatModel(
                platform,
                modelName
            )
            this.ctx.logger.success('AI模型加载成功')
        } catch (error) {
            this.ctx.logger.error('AI模型加载失败:', error)
        }
    }

    private parseAIResult<T>(result: string): ParseResult<T> {
        for (const extractor of extractors) {
            const extracted = extractor(result)
            const parsed = tryParse<T>(extracted)
            if (parsed) return parsed
        }
        this.ctx.logger.error(`AI结果解析失败: ${result}`)
        return null
    }

    async categorizeEmoji(
        imageBase64: string
    ): Promise<AICategorizeResult | null> {
        if (!this._model || !this.config.autoCategorize) return null

        try {
            const prompt = this.config.categorizePrompt.replace(
                '{categories}',
                this.config.categories.join(', ')
            )
            const result = await this._model.invoke([
                new SystemMessage(prompt),
                new HumanMessage({
                    content: '请分析这个表情包',
                    additional_kwargs: { images: [imageBase64] }
                })
            ])

            const parsedResult = this.parseAIResult<AICategorizeResult>(
                getMessageContent(result.content)
            )

            if (parsedResult?.newCategory) {
                const newCategory = parsedResult.newCategory
                const exists = await this.getCategoryByName(newCategory)
                if (!exists) {
                    await this.addCategory(newCategory, `AI建议的新分类`)
                }
                parsedResult.category = newCategory
            }

            return parsedResult
        } catch (error) {
            this.ctx.logger.error('AI分类失败:', error)
            return null
        }
    }

    async analyzeEmoji(imageBase64: string): Promise<AIAnalyzeResult | null> {
        if (!this._model || !this.config.autoAnalyze) return null

        try {
            const result = await this._model.invoke([
                new SystemMessage(this.config.analyzePrompt),
                new HumanMessage({
                    content: '请分析这个表情包',
                    additional_kwargs: { images: [imageBase64] }
                })
            ])

            const parsedResult = this.parseAIResult<AIAnalyzeResult>(
                getMessageContent(result.content)
            )

            if (parsedResult?.newCategory) {
                const newCategory = parsedResult.newCategory
                const exists = await this.getCategoryByName(newCategory)
                if (!exists) {
                    await this.addCategory(newCategory, `AI建议的新分类`)
                }
                parsedResult.category = newCategory
            }

            return parsedResult
        } catch (error) {
            this.ctx.logger.error('AI分析失败:', error)
            return null
        }
    }

    async addEmoji(
        options: EmojiAddOptions,
        imageData: Buffer
    ): Promise<EmojiItem> {
        const id = randomUUID()
        const fileName = `${id}.png`
        const storageDir = path.resolve(
            this.ctx.baseDir,
            this.config.storagePath
        )
        const filePath = path.join(storageDir, fileName)

        await fs.mkdir(storageDir, { recursive: true })

        await fs.writeFile(filePath, imageData)

        let finalOptions = { ...options }
        const imageBase64 = imageData.toString('base64')

        if (this.config.autoAnalyze) {
            const aiResult = await this.analyzeEmoji(imageBase64)
            if (aiResult) {
                finalOptions = {
                    name: aiResult.name || options.name,
                    category: aiResult.category || options.category || '其他',
                    tags: [...(options.tags || []), ...aiResult.tags],
                    description: aiResult.description
                }
            }
        } else if (this.config.autoCategorize && !options.category) {
            const categorizeResult = await this.categorizeEmoji(imageBase64)
            if (categorizeResult) {
                finalOptions.category = categorizeResult.category
            }
        }

        const emoji: EmojiItem = {
            id,
            name: finalOptions.name,
            category: finalOptions.category || '其他',
            path: filePath,
            size: imageData.length,
            createdAt: new Date(),
            tags: finalOptions.tags || []
        }

        this._emojiStorage[id] = emoji

        await this.ctx.database.upsert('emojiluna_emojis', [
            {
                id: emoji.id,
                name: emoji.name,
                category: emoji.category,
                path: emoji.path,
                size: emoji.size,
                created_at: emoji.createdAt,
                tags: JSON.stringify(emoji.tags)
            }
        ])

        await this.updateCategoryEmojiCount(emoji.category)
        this.ctx.logger.success(`Emoji added: ${emoji.name} (${emoji.id})`)
        this.ctx.emit('emojiluna/emoji-added', emoji)
        return emoji
    }

    async getEmojiByName(name: string): Promise<EmojiItem | null> {
        return (
            Object.values(this._emojiStorage).find(
                (emoji) =>
                    emoji.name === name ||
                    emoji.tags.some((tag) => tag === name) ||
                    emoji.category === name ||
                    emoji.id === name
            ) || null
        )
    }

    async getEmojisByName(name: string): Promise<EmojiItem[]> {
        return Object.values(this._emojiStorage).filter(
            (emoji) =>
                emoji.name === name ||
                emoji.tags.some((tag) => tag === name) ||
                emoji.category === name
        )
    }

    async categorizeExistingEmojis(): Promise<{
        success: number
        failed: number
    }> {
        if (!this._model || !this.config.autoCategorize) {
            return { success: 0, failed: 0 }
        }

        let success = 0,
            failed = 0

        for (const emoji of Object.values(this._emojiStorage)) {
            try {
                const imageBuffer = await fs.readFile(emoji.path)
                const imageBase64 = imageBuffer.toString('base64')
                const result = await this.categorizeEmoji(imageBase64)

                if (result && result.category !== emoji.category) {
                    await this.updateEmojiCategory(emoji.id, result.category)
                    success++
                }
            } catch (error) {
                this.ctx.logger.error(`分类表情包 ${emoji.id} 失败:`, error)
                failed++
            }
        }

        return { success, failed }
    }

    async getEmojiList(options: EmojiSearchOptions = {}): Promise<EmojiItem[]> {
        const { category, tags, limit = undefined, offset = 0 } = options
        let emojis = Object.values(this._emojiStorage)

        if (category) {
            emojis = emojis.filter((emoji) => emoji.category === category)
        }

        if (tags?.length) {
            emojis = emojis.filter((emoji) =>
                tags.some((tag) => emoji.tags.includes(tag))
            )
        }

        if (!limit) {
            return emojis
        }

        return emojis.slice(offset, offset + limit)
    }

    async searchEmoji(keyword: string): Promise<EmojiItem[]> {
        const emojis = Object.values(this._emojiStorage)
        return emojis.filter(
            (emoji) =>
                emoji.name.includes(keyword) ||
                emoji.tags.some((tag) => tag.includes(keyword))
        )
    }

    async getEmojiById(id: string): Promise<EmojiItem | null> {
        return this._emojiStorage[id] || null
    }

    async deleteEmoji(id: string): Promise<boolean> {
        const emoji = this._emojiStorage[id]
        if (!emoji) return false

        try {
            await fs.unlink(emoji.path)
            delete this._emojiStorage[id]
            await this.ctx.database.remove('emojiluna_emojis', { id })
            await this.updateCategoryEmojiCount(emoji.category)
            this.ctx.emit('emojiluna/emoji-deleted', id)
            return true
        } catch (error) {
            this.ctx.logger.error(`Failed to delete emoji ${id}:`, error)
            return false
        }
    }

    async deleteAllEmojis(): Promise<boolean> {
        try {
            const promises = Object.values(this._emojiStorage).map((emoji) =>
                this.deleteEmoji(emoji.id)
            )
            const chunkedPromises = chunkArray(promises, 4)
            for (const chunk of chunkedPromises) {
                await Promise.all(chunk)
            }
        } catch (error) {
            this.ctx.logger.error('Failed to delete all emojis:', error)
            return false
        }
        return true
    }

    async addCategory(name: string, description?: string): Promise<Category> {
        const id = generateId()
        const category: Category = {
            id,
            name,
            description,
            emojiCount: 0,
            createdAt: new Date()
        }

        this._categories[id] = category

        await this.ctx.database.upsert('emojiluna_categories', [
            {
                id: category.id,
                name: category.name,
                description: category.description,
                emoji_count: category.emojiCount,
                created_at: category.createdAt
            }
        ])

        this.ctx.emit('emojiluna/category-added', category)
        return category
    }

    async getCategories(): Promise<Category[]> {
        return Object.values(this._categories)
    }

    async getCategoryByName(name: string): Promise<Category | null> {
        return (
            Object.values(this._categories).find((cat) => cat.name === name) ||
            null
        )
    }

    async deleteCategory(id: string): Promise<boolean> {
        const category = this._categories[id]
        if (!category) return false

        const emojisInCategory = Object.values(this._emojiStorage).filter(
            (emoji) => emoji.category === category.name
        )

        if (emojisInCategory.length > 0) {
            throw new Error(`分类 ${category.name} 中还有表情包，无法删除`)
        }

        delete this._categories[id]
        await this.ctx.database.remove('emojiluna_categories', { id })
        this.ctx.emit('emojiluna/category-deleted', id)
        return true
    }

    async getAllTags(): Promise<string[]> {
        const tags = new Set<string>()
        Object.values(this._emojiStorage).forEach((emoji) => {
            emoji.tags.forEach((tag) => tags.add(tag))
        })
        return Array.from(tags)
    }

    async updateEmojiTags(id: string, tags: string[]): Promise<boolean> {
        const emoji = this._emojiStorage[id]
        if (!emoji) return false

        emoji.tags = tags
        await this.ctx.database.upsert('emojiluna_emojis', [
            {
                id: emoji.id,
                tags: JSON.stringify(emoji.tags)
            }
        ])

        this.ctx.emit('emojiluna/emoji-updated', emoji)
        return true
    }

    async updateEmojiCategory(id: string, category: string): Promise<boolean> {
        const emoji = this._emojiStorage[id]
        if (!emoji) return false

        emoji.category = category
        await this.ctx.database.upsert('emojiluna_emojis', [
            {
                id: emoji.id,
                category: emoji.category
            }
        ])

        this.ctx.emit('emojiluna/emoji-updated', emoji)
        return true
    }

    private async loadEmojis() {
        const emojis = await this.ctx.database
            .select('emojiluna_emojis')
            .execute()

        for (const emojiData of emojis) {
            this._emojiStorage[emojiData.id] = {
                id: emojiData.id,
                name: emojiData.name,
                category: emojiData.category,
                path: emojiData.path,
                size: emojiData.size,
                createdAt: new Date(emojiData.created_at),
                tags: JSON.parse(emojiData.tags || '[]')
            }
        }
    }

    private async loadCategories() {
        const categories = await this.ctx.database
            .select('emojiluna_categories')
            .execute()

        for (const categoryData of categories) {
            this._categories[categoryData.id] = {
                id: categoryData.id,
                name: categoryData.name,
                description: categoryData.description,
                emojiCount: categoryData.emoji_count,
                createdAt: new Date(categoryData.created_at)
            }
        }

        for (const category of this.config.categories) {
            const exists = Object.values(this._categories).find(
                (cat) => cat.name === category
            )
            if (!exists) {
                await this.addCategory(category)
            }
        }
    }

    getEmojiCount(): number {
        return Object.keys(this._emojiStorage).length
    }

    getCategoryCount(): number {
        return Object.keys(this._categories).length
    }

    private async updateCategoryEmojiCount(categoryName: string) {
        const count = Object.values(this._emojiStorage).filter(
            (emoji) => emoji.category === categoryName
        ).length

        const category = Object.values(this._categories).find(
            (cat) => cat.name === categoryName
        )
        if (category) {
            category.emojiCount = count
            await this.ctx.database.upsert('emojiluna_categories', [
                {
                    id: category.id,
                    emoji_count: count
                }
            ])
        }
    }

    static inject = ['database', 'chatluna']
}

function defineDatabase(ctx: Context) {
    ctx.database.extend(
        'emojiluna_emojis',
        {
            id: { type: 'string', length: 254 },
            name: { type: 'string', length: 254 },
            category: { type: 'string', length: 254 },
            path: { type: 'string', length: 500 },
            size: { type: 'integer' },
            created_at: { type: 'timestamp' },
            tags: { type: 'string' }
        },
        {
            autoInc: false,
            primary: 'id'
        }
    )

    ctx.database.extend(
        'emojiluna_categories',
        {
            id: { type: 'string', length: 254 },
            name: { type: 'string', length: 254 },
            description: { type: 'string', length: 500 },
            emoji_count: { type: 'integer' },
            created_at: { type: 'timestamp' }
        },
        {
            autoInc: false,
            primary: 'id'
        }
    )
}

declare module 'koishi' {
    interface Context {
        emojiluna: EmojiLunaService
    }

    interface Tables {
        emojiluna_emojis: {
            id: string
            name: string
            category: string
            path: string
            size: number
            created_at: Date
            tags: string
        }
        emojiluna_categories: {
            id: string
            name: string
            description: string
            emoji_count: number
            created_at: Date
        }
    }

    interface Events {
        'emojiluna/emoji-added': (emoji: EmojiItem) => void
        'emojiluna/emoji-deleted': (id: string) => void
        'emojiluna/emoji-updated': (emoji: EmojiItem) => void
        'emojiluna/category-added': (category: Category) => void
        'emojiluna/category-deleted': (id: string) => void
    }
}
