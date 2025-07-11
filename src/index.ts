import { Context, Schema } from 'koishi'
import { Config } from './config'
import { EmojiLunaService } from './service'
import { applyCommands } from './commands'
import { AutoCollector } from './autoCollector'
import { PlatformService } from 'koishi-plugin-chatluna/llm-core/platform/service'
import { ModelType } from 'koishi-plugin-chatluna/llm-core/platform/types'

export function apply(ctx: Context, config: Config) {
    ctx.plugin(EmojiLunaService, config)

    ctx.on('ready', () => {
        applyCommands(ctx, config)

        ctx.inject(['emojiluna'], (ctx) => {
            const autoCollector = new AutoCollector(ctx, config)

            autoCollector.start()
        })

        const getModelNames = (service: PlatformService) =>
            service.getAllModels(ModelType.llm).map((m) => Schema.const(m))

        const updateSchema = (service: PlatformService) => {
            ctx.schema.set('model', Schema.union(getModelNames(service)))
        }

        ctx.on('chatluna/model-added', updateSchema)
        ctx.on('chatluna/model-removed', updateSchema)
        ctx.on('ready', () => updateSchema(ctx.chatluna.platform))
    })
}

export * from './config'
export * from './types'

export const inject = ['chatluna']
