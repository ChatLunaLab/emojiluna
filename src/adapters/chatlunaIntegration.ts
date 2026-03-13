import { Context } from 'koishi'
import { Config } from '../config'

export function applyChatlunaIntegration(ctx: Context, config: Config) {
    if (!config.injectVariables) return

    ctx.inject(['server', 'chatluna', 'emojiluna'], async (ctx) => {
        const selfUrl = config.selfUrl || ctx.server.selfUrl || ''
        const baseUrl = selfUrl + config.backendPath

        await ctx.emojiluna.ready

        const escapeMarkdown = (text: string) =>
            text.replace(/([\[\]\(\)])/g, '\\$1')

        const refreshPromptVariable = async () => {
            try {
                const emojis = await ctx.emojiluna.getEmojiList({
                    limit: config.injectVariablesLimit
                })

                const emojiList = emojis
                    .map((emoji) => {
                        const emojiUrl = `${baseUrl}/get/${encodeURIComponent(emoji.id)}`
                        const tags = emoji.tags.join(', ')
                        return `- [${escapeMarkdown(emoji.name)}](${emojiUrl}) - 分类: ${emoji.category}, 标签: ${tags}`
                    })
                    .join('\n')

                const promptContent = config.injectVariablesPrompt.replace(
                    '{emojis}',
                    emojiList
                )

                ctx.chatluna.promptRenderer.setVariable('emojis', promptContent)
            } catch (error) {
                ctx.logger.warn(`刷新 emojiluna 变量失败: ${error.message}`)
            }
        }

        await refreshPromptVariable()

        ctx.setInterval(() => refreshPromptVariable(), 1000 * 60 * 5)

        ctx.on('emojiluna/emoji-added', () => refreshPromptVariable())
        ctx.on('emojiluna/emoji-updated', () => refreshPromptVariable())
        ctx.on('emojiluna/emoji-deleted', () => refreshPromptVariable())

        ctx.effect(
            () => () => ctx.chatluna.promptRenderer.removeVariable('emojis')
        )
    })
}
