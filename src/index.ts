import { Context } from 'koishi'
import { Config } from './config'
import { EmojiLunaService } from './service'
import { applyCommands } from './commands'
import { AutoCollector } from './autoCollector'
import { applyBackend } from './backend'
import { modelSchema } from 'koishi-plugin-chatluna/utils/schema'

export function apply(ctx: Context, config: Config) {
    ctx.plugin(EmojiLunaService, config)

    ctx.on('ready', () => {
        ctx.inject(['emojiluna'], (ctx) => {
            applyCommands(ctx, config)
            applyBackend(ctx, config)

            const autoCollector = new AutoCollector(ctx, config)

            autoCollector.start()
        })

        modelSchema(ctx)
    })
}

export * from './config'
export * from './types'

export const inject = ['chatluna']
