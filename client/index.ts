/* eslint-disable @typescript-eslint/naming-convention */
import { Context, icons } from '@koishijs/client'
import HomeView from './home.vue'
import TagsView from './tags.vue'
import CategoriesView from './categories.vue'
import { i18n } from './i18n'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { h } from 'vue'
import 'virtual:uno.css'
import type {} from 'koishi-plugin-emojiluna'

const viewportMeta = document.createElement('meta')
viewportMeta.name = 'viewport'
viewportMeta.content = 'width=device-width, initial-scale=1'
document.head.appendChild(viewportMeta)

const createIconComponent = (IconComponent: typeof ElementPlusIconsVue.Aim) => {
    return () => h(IconComponent)
}

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
        name: '表情包管理',
        path: '/emojiluna/webui',
        icon: 'Picture',
        component: HomeView,
        authority: 0
    })

    ctx.page({
        name: '标签管理',
        path: '/emojiluna/webui-tags',
        icon: 'PriceTag',
        component: TagsView,
        authority: 0
    })

    ctx.page({
        name: '分类管理',
        path: '/emojiluna/webui-categories',
        icon: 'FolderOpened',
        component: CategoriesView,
        authority: 0
    })
}
