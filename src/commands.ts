import { Context, h } from 'koishi'
import { Config } from './config'
import { formatFileSize, handleImageUpload } from './utils'
import fs from 'fs/promises'

export function applyCommands(ctx: Context, config: Config) {
    ctx.inject(['emojiluna'], (ctx) => {
        const emojiluna = ctx.emojiluna

        ctx.command('emojiluna', '表情包管理插件')

        ctx.command('emojiluna.add <name:string>', '添加表情包')
            .option('category', '-c <category:string> 指定分类')
            .option('tags', '-t <tags:string> 添加标签，用逗号分隔')
            .option('no-ai', '-n 禁用AI分析')
            .action(async ({ session, options }, name) => {
                if (!name) return '请输入表情包名称'

                return await handleImageUpload(
                    session,
                    '',
                    async (imageData) => {
                        if (imageData.length === 0) {
                            return '请上传图片'
                        }

                        const tags = options.tags
                            ? options.tags.split(',').map((t) => t.trim())
                            : []

                        try {
                            const emoji = await emojiluna.addEmoji(
                                {
                                    name,
                                    category: options.category,
                                    tags
                                },
                                imageData[0]
                            )

                            let result = `表情包 "${name}" 添加成功！ID: ${emoji.id}`

                            if (config.autoAnalyze && !options['no-ai']) {
                                result += '\n\nAI分析结果：'
                                result += `\n分类: ${emoji.category}`
                                result += `\n标签: ${emoji.tags.join(', ')}`
                            }

                            return result
                        } catch (error) {
                            return `添加失败: ${error.message}`
                        }
                    }
                )
            })

        ctx.command('emojiluna.list', '查看表情包列表')
            .option('category', '-c <category:string> 按分类筛选')
            .option('tags', '-t <tags:string> 按标签筛选，用逗号分隔')
            .option('limit', '-l <limit:number> 限制显示数量', { fallback: 10 })
            .option('offset', '-o <offset:number> 偏移量', { fallback: 0 })
            .action(async ({ session, options }) => {
                const tags = options.tags
                    ? options.tags.split(',').map((t) => t.trim())
                    : []

                const emojis = await emojiluna.getEmojiList({
                    category: options.category,
                    tags,
                    limit: options.limit,
                    offset: options.offset
                })

                if (emojis.length === 0) {
                    return '没有找到表情包'
                }

                const total = emojiluna.getEmojiCount()
                const list = emojis
                    .map(
                        (emoji, index) =>
                            `${options.offset + index + 1}. ${emoji.name} (${emoji.id})\n   分类: ${emoji.category}\n   标签: ${
                                emoji.tags.join(', ') || '无'
                            }\n   大小: ${formatFileSize(emoji.size)}`
                    )
                    .join('\n\n')

                return `表情包列表 (${emojis.length}/${total}):\n\n${list}`
            })

        ctx.command('emojiluna.search <keyword:string>', '搜索表情包').action(
            async ({ session }, keyword) => {
                if (!keyword) return '请输入搜索关键词'

                const emojis = await emojiluna.searchEmoji(keyword)

                if (emojis.length === 0) {
                    return `没有找到包含 "${keyword}" 的表情包`
                }

                const list = emojis
                    .map(
                        (emoji, index) =>
                            `${index + 1}. ${emoji.name} (${emoji.id})\n   分类: ${emoji.category}\n   标签: ${
                                emoji.tags.join(', ') || '无'
                            }`
                    )
                    .join('\n\n')

                return `搜索结果 (${emojis.length} 个):\n\n${list}`
            }
        )

        ctx.command('emojiluna.get <id:string>', '获取表情包').action(
            async ({ session }, id) => {
                if (!id) return '请输入表情包ID'

                const emoji = await emojiluna.getEmojiById(id)
                if (!emoji) {
                    return '表情包不存在'
                }

                try {
                    const imageBuffer = await fs.readFile(emoji.path)
                    return h.image(imageBuffer, 'image/png')
                } catch (error) {
                    return '读取表情包文件失败'
                }
            }
        )

        ctx.command('emojiluna.delete <id:string>', '删除表情包').action(
            async ({ session }, id) => {
                if (!id) return '请输入表情包ID'

                const success = await emojiluna.deleteEmoji(id)
                if (success) {
                    return '表情包删除成功'
                } else {
                    return '表情包不存在或删除失败'
                }
            }
        )

        ctx.command('emojiluna.category', '分类管理')

        ctx.command('emojiluna.category.add <name:string>', '添加分类')
            .option('description', '-d <description:string> 分类描述')
            .action(async ({ session, options }, name) => {
                if (!name) return '请输入分类名称'

                try {
                    const category = await emojiluna.addCategory(
                        name,
                        options.description
                    )
                    return `分类 "${name}" 添加成功！ID: ${category.id}`
                } catch (error) {
                    return `添加分类失败: ${error.message}`
                }
            })

        ctx.command('emojiluna.category.list', '查看所有分类').action(
            async ({ session }) => {
                const categories = await emojiluna.getCategories()

                if (categories.length === 0) {
                    return '没有分类'
                }

                const list = categories
                    .map(
                        (cat) =>
                            `${cat.name} (${cat.id})\n   描述: ${
                                cat.description || '无'
                            }\n   表情包数量: ${cat.emojiCount}`
                    )
                    .join('\n\n')

                return `分类列表 (${categories.length} 个):\n\n${list}`
            }
        )

        ctx.command('emojiluna.category.delete <id:string>', '删除分类').action(
            async ({ session }, id) => {
                if (!id) return '请输入分类ID'

                try {
                    const success = await emojiluna.deleteCategory(id)
                    if (success) {
                        return '分类删除成功'
                    } else {
                        return '分类不存在'
                    }
                } catch (error) {
                    return `删除分类失败: ${error.message}`
                }
            }
        )

        ctx.command('emojiluna.tags', '标签管理')

        ctx.command('emojiluna.tags.list', '查看所有标签').action(
            async ({ session }) => {
                const tags = await emojiluna.getAllTags()

                if (tags.length === 0) {
                    return '没有标签'
                }

                return `所有标签 (${tags.length} 个):\n${tags.join(', ')}`
            }
        )

        ctx.command(
            'emojiluna.tags.update <id:string> <tags:string>',
            '更新表情包标签'
        ).action(async ({ session }, id, tags) => {
            if (!id) return '请输入表情包ID'
            if (!tags) return '请输入标签，用逗号分隔'

            const tagList = tags.split(',').map((t) => t.trim())
            const success = await emojiluna.updateEmojiTags(id, tagList)

            if (success) {
                return '标签更新成功'
            } else {
                return '表情包不存在'
            }
        })

        ctx.command(
            'emojiluna.category.update <id:string> <category:string>',
            '更新表情包分类'
        ).action(async ({ session }, id, category) => {
            if (!id) return '请输入表情包ID'
            if (!category) return '请输入分类名称'

            const success = await emojiluna.updateEmojiCategory(id, category)

            if (success) {
                return '分类更新成功'
            } else {
                return '表情包不存在'
            }
        })

        ctx.command('emojiluna.ai', 'AI功能')

        ctx.command('emojiluna.ai.categorize', '批量AI分类现有表情包').action(
            async ({ session }) => {
                if (!config.autoCategorize) {
                    return 'AI分类功能未启用'
                }

                await session.send('开始批量AI分类，请稍候...')
                const result = await emojiluna.categorizeExistingEmojis()

                return `批量分类完成！\n成功: ${result.success} 个\n失败: ${result.failed} 个`
            }
        )

        ctx.command('emojiluna.ai.analyze <id:string>', 'AI分析表情包').action(
            async ({ session }, id) => {
                if (!config.autoAnalyze) {
                    return 'AI分析功能未启用'
                }

                const emoji = await emojiluna.getEmojiById(id)
                if (!emoji) {
                    return '表情包不存在'
                }

                try {
                    const imageBuffer = await fs.readFile(emoji.path)
                    const imageBase64 = imageBuffer.toString('base64')

                    await session.send('正在AI分析，请稍候...')
                    const result = await emojiluna.analyzeEmoji(imageBase64)

                    if (!result) {
                        return 'AI分析失败'
                    }

                    let response = `AI分析结果：\n\n`
                    response += `建议名称: ${result.name}\n`
                    response += `建议分类: ${result.category}\n`
                    response += `建议标签: ${result.tags.join(', ')}\n`
                    response += `描述: ${result.description}`

                    if (
                        result.newCategories &&
                        result.newCategories.length > 0
                    ) {
                        response += `\n\n建议新分类: ${result.newCategories.join(', ')}`
                    }

                    return response
                } catch (error) {
                    return `AI分析失败: ${error.message}`
                }
            }
        )

        ctx.command('emojiluna.info', '查看插件信息').action(
            async ({ session }) => {
                const emojiCount = emojiluna.getEmojiCount()
                const categoryCount = emojiluna.getCategoryCount()
                const tags = await emojiluna.getAllTags()

                let info = `表情包管理插件信息:\n表情包数量: ${emojiCount}\n分类数量: ${categoryCount}\n标签数量: ${
                    tags.length
                }`

                if (config.autoCategorize || config.autoAnalyze) {
                    info += `\n\nAI功能状态:`
                    info += `\n自动分类: ${config.autoCategorize ? '启用' : '禁用'}`
                    info += `\n自动分析: ${config.autoAnalyze ? '启用' : '禁用'}`
                    info += `\n使用模型: ${config.model}`
                }

                return info
            }
        )
    })
}
