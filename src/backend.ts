import { Context } from 'koishi'
import { Config } from '.'
import type {} from '@koishijs/plugin-server'
import fs from 'fs/promises'

export async function applyBackend(ctx: Context, config: Config) {
    if (config.injectVariables) {
        const emojis = await ctx.emojiluna
            .getEmojiList()
            .then((res) => res.map((emoji) => `[${emoji.name}](${emoji.path})`))
        ctx.effect(() => {
            const dispose = ctx.chatluna.variable.setVariable(
                'emojis',
                emojis.join(',')
            )
            return () => dispose
        })
    }

    if (!config.backendServer) {
        return
    }

    ctx.inject(['server'], (ctx) => {
        ctx.server.get(`${config.backendPath}/list`, async (koa) => {
            const emojis = await ctx.emojiluna.getEmojiList()

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
            const categories = await ctx.emojiluna.getCategories()

            koa.set('Content-Type', 'application/json')
            koa.body = JSON.stringify(categories)
        })

        ctx.server.get(
            `${config.backendPath}/categories/:category`,
            async (koa) => {
                const { category } = koa.params
                const emojis = await ctx.emojiluna.getEmojiList({ category })
                // random emoji
                const randomEmoji =
                    emojis[Math.floor(Math.random() * emojis.length)]
                const emojiBuffer = await fs.readFile(randomEmoji.path)
                koa.set('Content-Type', 'image/png')
                koa.set('Content-Length', emojiBuffer.length.toString())
                koa.body = emojiBuffer
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

            // random emoji
            const randomEmoji =
                emojis[Math.floor(Math.random() * emojis.length)]
            const emojiBuffer = await fs.readFile(randomEmoji.path)
            koa.set('Content-Type', 'image/png')
            koa.set('Content-Length', emojiBuffer.length.toString())
            koa.body = emojiBuffer
        })

        ctx.server.get(`${config.backendPath}/random`, async (koa) => {
            const emojis = await ctx.emojiluna.getEmojiList()
            const randomEmoji =
                emojis[Math.floor(Math.random() * emojis.length)]
            const emojiBuffer = await fs.readFile(randomEmoji.path)
            koa.set('Content-Type', 'image/png')
            koa.set('Content-Length', emojiBuffer.length.toString())
            koa.body = emojiBuffer
        })

        ctx.server.get(`${config.backendPath}/get/:id`, async (koa) => {
            const { id } = koa.params
            const emoji = await ctx.emojiluna.getEmojiByName(id)
            if (!emoji) {
                koa.status = 404
                return (koa.body = 'Emoji not found')
            }

            const emojiBuffer = await fs.readFile(emoji.path)
            koa.set('Content-Type', 'image/png')
            koa.set('Content-Length', emojiBuffer.length.toString())
            koa.body = emojiBuffer
        })
    })
}
