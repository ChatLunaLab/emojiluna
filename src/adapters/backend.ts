import { Context } from 'koishi'
import { Config } from '../config'
import { applyChatlunaIntegration } from './chatlunaIntegration'
import { applyConsoleListeners } from './consoleListeners'
import { applyRestApi } from './restApi'

export async function applyBackend(ctx: Context, config: Config) {
    applyChatlunaIntegration(ctx, config)
    applyConsoleListeners(ctx, config)
    applyRestApi(ctx, config)
}
