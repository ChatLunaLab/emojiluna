import { Context } from 'koishi'
import { Config } from './config'
import { EmojiLunaService } from './service'
import { applyCommands } from './commands'

export function apply(ctx: Context, config: Config) {
    ctx.plugin(EmojiLunaService, config)
    applyCommands(ctx, config)
}

export * from './config'
export * from './types'

export const inject = ['chatluna']
