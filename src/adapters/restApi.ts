import { Context } from 'koishi'
import { Config } from '../config'
import { EmojiItem } from '../types'
import type {} from '@koishijs/plugin-server'
import type * as koaTypes from 'koa'
import fs from 'fs/promises'
import { getImageType } from '../utils'
import formidable from 'formidable'
import type { Fields, Files, File as FormidableFile } from 'formidable'
import { resolve } from 'path'

function getSingleQuery(value: unknown): string | undefined {
    if (Array.isArray(value)) return value[0]
    if (typeof value === 'string') return value
    return undefined
}

function getPaginationParams(query: Record<string, unknown>) {
    const limitText = getSingleQuery(query.limit)
    const offsetText = getSingleQuery(query.offset)
    const limit = limitText ? Number(limitText) : undefined
    const offset = offsetText ? Number(offsetText) : undefined
    return {
        limit:
            typeof limit === 'number' && Number.isFinite(limit)
                ? limit
                : undefined,
        offset:
            typeof offset === 'number' && Number.isFinite(offset)
                ? offset
                : undefined
    }
}

async function serveRandomEmoji(
    koa: Parameters<Parameters<Context['server']['get']>[2]>[0],
    emojis: EmojiItem[]
): Promise<void> {
    if (emojis.length === 0) {
        koa.status = 404
        koa.body = 'No emojis available'
        return
    }
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)]
    const emojiBuffer = await fs.readFile(randomEmoji.path)
    const mimeType = randomEmoji.mimeType || getImageType(emojiBuffer)
    koa.set('Content-Type', mimeType)
    koa.set('Content-Length', emojiBuffer.length.toString())
    koa.body = emojiBuffer
}

export function applyRestApi(ctx: Context, config: Config) {
    if (!config.backendServer) return

    ctx.inject(['server', 'emojiluna'], async (ctx) => {
        await ctx.emojiluna.ready

        ctx.server.get(`${config.backendPath}/list`, async (koa) => {
            const keyword = getSingleQuery(koa.request.query.keyword)
            const category = getSingleQuery(koa.request.query.category)
            const tag = getSingleQuery(koa.request.query.tag)
            const { limit, offset } = getPaginationParams(koa.request.query)

            const emojis = await ctx.emojiluna.getEmojiList({
                keyword,
                category,
                tags: tag ? [tag] : undefined,
                limit,
                offset
            })

            koa.set('Content-Type', 'application/json')
            koa.body = JSON.stringify(emojis)
        })

        ctx.server.get(`${config.backendPath}/search`, async (koa) => {
            const { keyword: keywordString } = koa.request.query
            const keyword = Array.isArray(keywordString)
                ? keywordString[0]
                : keywordString
            const emojis = await ctx.emojiluna.searchEmoji(keyword)

            koa.set('Content-Type', 'application/json')
            koa.body = JSON.stringify(emojis)
        })

        ctx.server.get(`${config.backendPath}/categories`, async (koa) => {
            const keyword = getSingleQuery(koa.request.query.keyword)
            const { limit, offset } = getPaginationParams(koa.request.query)

            const categories = await ctx.emojiluna.getCategoriesPage({
                keyword,
                limit,
                offset
            })

            koa.set('Content-Type', 'application/json')
            koa.body = JSON.stringify(categories.items)
        })

        ctx.server.get(
            `${config.backendPath}/categories/:category`,
            async (koa) => {
                const { category } = koa.params
                const emojis = await ctx.emojiluna.getEmojiList({ category })
                await serveRandomEmoji(koa, emojis)
            }
        )

        ctx.server.get(`${config.backendPath}/tags`, async (koa) => {
            const tags = await ctx.emojiluna.getAllTags()

            koa.set('Content-Type', 'application/json')
            koa.body = JSON.stringify(tags)
        })

        ctx.server.get(`${config.backendPath}/tags/:tag`, async (koa) => {
            const { tag } = koa.params
            const emojis = await ctx.emojiluna.getEmojiList({ tags: [tag] })
            await serveRandomEmoji(koa, emojis)
        })

        ctx.server.get(`${config.backendPath}/random`, async (koa) => {
            const emojis = await ctx.emojiluna.getEmojiList()
            await serveRandomEmoji(koa, emojis)
        })

        ctx.server.get(`${config.backendPath}/get/:id`, async (koa) => {
            const { id } = koa.params
            const emoji =
                (await ctx.emojiluna.getEmojiById(id)) ||
                (await ctx.emojiluna.getEmojiByName(id))
            if (!emoji) {
                koa.status = 404
                return (koa.body = 'Emoji not found')
            }

            const emojiBuffer = await fs.readFile(emoji.path)
            const mimeType = emoji.mimeType || getImageType(emojiBuffer)
            koa.set('Content-Type', mimeType)
            koa.set('Content-Length', emojiBuffer.length.toString())
            koa.body = emojiBuffer
        })

        ctx.server.post(`${config.backendPath}/upload`, async (koa) => {
            try {
                const authHeader = (
                    koa.get('x-upload-token') ||
                    koa.get('authorization') ||
                    ''
                ).toString()
                let providedToken = ''
                if (authHeader.startsWith('Bearer ')) {
                    providedToken = authHeader.slice(7)
                } else if (authHeader) {
                    providedToken = authHeader
                }

                if (
                    config.uploadToken &&
                    config.uploadToken.length > 0 &&
                    providedToken !== config.uploadToken
                ) {
                    koa.status = 401
                    koa.body = { success: false, message: 'Unauthorized' }
                    return
                }

                const request = koa.request as unknown as koaTypes.Request & {
                    body?: Fields
                    files?: Files
                }
                let fields: Fields
                let files: Files
                let file: FormidableFile | null

                if (request.files) {
                    fields = request.body || {}
                    files = request.files
                    file = Array.isArray(files.file)
                        ? files.file[0]
                        : files.file
                } else {
                    const storageDir = resolve(
                        ctx.baseDir,
                        config.storagePath,
                        'uploads'
                    )
                    await fs.mkdir(storageDir, { recursive: true })

                    const form = formidable({
                        uploadDir: storageDir,
                        keepExtensions: true,
                        maxFileSize: config.maxEmojiSize * 1024 * 1024,
                        multiples: false
                    })

                    try {
                        const [parsedFields, parsedFiles] = await new Promise<
                            [Fields, Files]
                        >((resolve, reject) => {
                            form.parse(koa.req, (err, fields, files) => {
                                if (err) return reject(err)
                                resolve([fields, files])
                            })
                        })
                        fields = parsedFields
                        files = parsedFiles
                        const fileField = files.file
                        file = Array.isArray(fileField)
                            ? fileField[0]
                            : fileField
                    } catch (err) {
                        ctx.logger.error(
                            `Formidable parse error: ${err?.message || err}`
                        )
                        koa.status = 400
                        koa.body = {
                            success: false,
                            message: `Upload parsing failed: ${err?.message || err}`
                        }
                        return
                    }
                }

                if (!file) {
                    ctx.logger.error('Upload failed: No file found in request')
                    koa.status = 400
                    koa.body = { success: false, message: 'No file uploaded' }
                    return
                }

                const nameField = fields.name
                const categoryField = fields.category
                const tagsField = fields.tags
                const aiAnalysisField = fields.aiAnalysis

                const name = Array.isArray(nameField) ? nameField[0] : nameField
                const category = Array.isArray(categoryField)
                    ? categoryField[0]
                    : categoryField
                const tagsStr = Array.isArray(tagsField)
                    ? tagsField[0]
                    : tagsField
                const aiAnalysisStr = Array.isArray(aiAnalysisField)
                    ? aiAnalysisField[0]
                    : aiAnalysisField

                let tags: string[] = []
                try {
                    if (tagsStr) {
                        const parsed = JSON.parse(tagsStr)
                        if (Array.isArray(parsed)) tags = parsed
                    }
                } catch (e) {
                    ctx.logger.warn(`Failed to parse tags JSON: ${tagsStr}`)
                }
                const aiAnalysis = aiAnalysisStr === 'true'

                const filePath = file.filepath
                if (!filePath) {
                    ctx.logger.error(
                        'Upload failed: File object missing path property',
                        file
                    )
                    koa.status = 500
                    koa.body = {
                        success: false,
                        message: 'Invalid file object received from parser'
                    }
                    return
                }

                const emoji = await ctx.emojiluna.addEmoji(
                    {
                        name:
                            name ||
                            file.originalFilename?.replace(/\.[^/.]+$/, '') ||
                            'uploaded',
                        category: category || '其他',
                        tags
                    },
                    { path: filePath },
                    aiAnalysis
                )

                koa.status = 200
                koa.body = { success: true, emoji }
            } catch (err) {
                ctx.logger.error(
                    `Upload endpoint error: ${err.message}`,
                    err.stack
                )
                if (err instanceof Error) {
                    if (
                        err.message.includes('No file uploaded') ||
                        err.message.includes('parsing failed')
                    ) {
                        koa.status = 400
                    } else if (err.message.includes('表情包已存在')) {
                        koa.status = 409
                    } else {
                        koa.status = 500
                    }
                } else {
                    koa.status = 500
                }
                koa.body = { success: false, message: err.message }
            }
        })
    })
}
