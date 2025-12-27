import { Context, icons } from '@koishijs/client'
import DashboardView from './dashboard.vue'
import { i18n } from './i18n'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import 'virtual:uno.css'
import type {} from 'koishi-plugin-emojiluna'
import Emoji from './icons/emoji.vue'

const viewportMeta = document.createElement('meta')
viewportMeta.name = 'viewport'
viewportMeta.content = 'width=device-width, initial-scale=1'
document.head.appendChild(viewportMeta)

const createIconComponent = (IconComponent: typeof ElementPlusIconsVue.Aim) => {
    return () => IconComponent
}

icons.register('Emoji', Emoji)
icons.register('Picture', createIconComponent(ElementPlusIconsVue.Picture))
icons.register('PriceTag', createIconComponent(ElementPlusIconsVue.PriceTag))
icons.register(
    'FolderOpened',
    createIconComponent(ElementPlusIconsVue.FolderOpened)
)

export default (ctx: Context) => {
    ctx.app.use(i18n)

    for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
        ctx.app.component(key, component)
    }

    ctx.page({
        name: 'EmojiLuna',
        path: '/emojiluna/webui',
        icon: 'Emoji',
        component: DashboardView,
        authority: 0
    })
}
