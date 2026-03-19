import { Context } from 'koishi'
import { Config } from '../config'
import { EmojiAddOptions, EmojiSearchOptions } from '../types'
import { resolve } from 'path'
import fs from 'fs/promises'
import type {} from '@koishijs/plugin-console'

export function applyConsoleListeners(ctx: Context, config: Config) {
    if (!config.backendServer) return

    ctx.inject(['console', 'server', 'emojiluna'], async (ctx) => {
        await ctx.emojiluna.ready

        ctx.console.addEntry({
            dev: resolve(__dirname, '../../client/index.ts'),
            prod: resolve(__dirname, '../dist')
        })

        // Batch register simple passthrough listeners
        const directProxies = {
            'emojiluna/getEmojiList': 'getEmojiList',
            'emojiluna/getEmojiPage': 'getEmojiPage',
            'emojiluna/searchEmoji': 'searchEmoji',
            'emojiluna/getCategories': 'getCategories',
            'emojiluna/getCategoriesPage': 'getCategoriesPage',
            'emojiluna/getAllTags': 'getAllTags',
            'emojiluna/getTagsPage': 'getTagsPage',
            'emojiluna/updateEmojiName': 'updateEmojiName',
            'emojiluna/updateEmojiTags': 'updateEmojiTags',
            'emojiluna/updateEmojiCategory': 'updateEmojiCategory',
            'emojiluna/deleteEmoji': 'deleteEmoji',
            'emojiluna/addCategory': 'addCategory',
            'emojiluna/deleteCategory': 'deleteCategory',
            'emojiluna/cleanupEmptyCategories': 'cleanupEmptyCategories',
            'emojiluna/cleanupEmptyTags': 'cleanupEmptyTags',
            'emojiluna/getAiTaskStats': 'getAiTaskStats',
            'emojiluna/getFailedAiEmojiIds': 'getFailedAiEmojiIds',
            'emojiluna/retryFailedTasks': 'retryFailedTasks',
            'emojiluna/getAiTasksAll': 'getAiTasksAll',
            'emojiluna/setAiPaused': 'setAiPaused',
            'emojiluna/reanalyzeBatch': 'reanalyzeBatch',
            'emojiluna/deleteAiTask': 'deleteAiTask',
            'emojiluna/retryAiTask': 'retryAiTask'
        } as const

        for (const [event, method] of Object.entries(directProxies)) {
            ctx.console.addListener(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                event as any,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (async (...args: any[]) => {
                    return await (
                        ctx.emojiluna as unknown as Record<
                            string,
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            (...a: any[]) => any
                        >
                    )[method](...args)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                }) as any
            )
        }

        // Listeners with custom logic

        ctx.console.addListener('emojiluna/addEmoji', async (emojiData) => {
            const { name, category, tags, imageData } = emojiData

            if (!imageData || !name) {
                throw new Error('图片数据和名称为必填项')
            }

            const buffer = Buffer.from(imageData, 'base64')

            const options = {
                name,
                category: category || '其他',
                tags: tags || []
            }

            return await ctx.emojiluna.addEmoji(options, buffer)
        })

        ctx.console.addListener(
            'emojiluna/addEmojis',
            async (emojis: EmojiAddOptions[], aiAnalysis: boolean) => {
                if (!emojis || !Array.isArray(emojis) || emojis.length === 0) {
                    throw new Error('表情包数据数组为必填项')
                }

                const emojisToCreate = emojis.map((emojiData) => {
                    const { name, category, tags, imageData } = emojiData
                    if (!imageData || !name) {
                        throw new Error('每个表情包的图片数据和名称都是必填项')
                    }
                    const buffer = Buffer.from(imageData, 'base64')
                    return {
                        options: {
                            name,
                            category: category || '其他',
                            tags: tags || []
                        },
                        buffer
                    }
                })

                return await ctx.emojiluna.addEmojis(emojisToCreate, aiAnalysis)
            }
        )

        ctx.console.addListener('emojiluna/getBaseUrl', async () => {
            const selfUrl = config.selfUrl || ctx.server.selfUrl
            return selfUrl + config.backendPath
        })

        ctx.console.addListener('emojiluna/getUploadToken', async () => {
            return config.uploadToken || ''
        })

        ctx.console.addListener('emojiluna/analyzeEmoji', async (id) => {
            const emoji = await ctx.emojiluna.getEmojiById(id)
            if (!emoji) {
                throw new Error('表情包不存在')
            }

            try {
                const imageBuffer = await fs.readFile(emoji.path)
                const imageBase64 = imageBuffer.toString('base64')
                const result = await ctx.emojiluna.analyzeEmoji(imageBase64)

                if (result) {
                    const updates = []
                    if (result.category !== emoji.category) {
                        await ctx.emojiluna.updateEmojiCategory(
                            id,
                            result.category
                        )
                        updates.push(
                            `分类: ${emoji.category} → ${result.category}`
                        )
                    }
                    if (
                        JSON.stringify(result.tags.sort()) !==
                        JSON.stringify([...emoji.tags].sort())
                    ) {
                        await ctx.emojiluna.updateEmojiTags(id, result.tags)
                        updates.push(
                            `标签: [${emoji.tags.join(', ')}] → [${result.tags.join(', ')}]`
                        )
                    }

                    return {
                        success: true,
                        updates,
                        result,
                        oldData: {
                            name: emoji.name,
                            category: emoji.category,
                            tags: emoji.tags
                        },
                        newData: {
                            name: result.name,
                            category: result.category,
                            tags: result.tags,
                            description: result.description
                        }
                    }
                }

                return {
                    success: false,
                    message: 'AI分析未返回结果'
                }
            } catch (error) {
                throw new Error(`AI分析失败: ${error.message}`)
            }
        })

        ctx.console.addListener(
            'emojiluna/getEmojiCount',
            async (options: EmojiSearchOptions = {}) => {
                const list = await ctx.emojiluna.getEmojiList(options)
                return list.length
            }
        )

        ctx.console.addListener(
            'emojiluna/scanFolder',
            async (folderPath: string) => {
                if (!folderPath) {
                    throw new Error('文件夹路径不能为空')
                }
                return await ctx.emojiluna.scanFolder(folderPath)
            }
        )

        ctx.console.addListener(
            'emojiluna/importFromFolder',
            async (options) => {
                if (!options?.folderPath) {
                    throw new Error('文件夹路径不能为空')
                }
                return await ctx.emojiluna.importFromFolder(options)
            }
        )
    })
}
