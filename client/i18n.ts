import { createI18n } from 'vue-i18n'

const messages = {
    'zh-CN': {
        emojiluna: {
            title: '表情包管理',
            search: '搜索表情包...',
            searchButton: '搜索',
            addEmoji: '添加表情包',
            emojiName: '表情包名称',
            category: '分类',

            description: '描述',
            upload: '上传',
            fromUrl: '从URL添加',
            dragUpload: '拖拽文件到此处或点击上传',
            urlPlaceholder: '请输入图片URL',
            noEmojis: '暂无表情包',
            editEmoji: '编辑表情包',
            deleteEmoji: '删除表情包',
            confirmDelete: '确定要删除这个表情包吗？',
            addSuccess: '添加成功',
            deleteSuccess: '删除成功',
            updateSuccess: '更新成功',
            addFailed: '添加失败',
            deleteFailed: '删除失败',
            updateFailed: '更新失败',
            categories: {
                title: '分类管理',
                add: '添加分类',
                edit: '编辑分类',
                delete: '删除分类',
                name: '分类名称',
                description: '分类描述',
                emojiCount: '表情包数量',
                confirmDelete:
                    '确定要删除这个分类吗？此操作将会把该分类下的所有表情包移至"其他"分类。'
            },
            tags: {
                title: '标签管理',
                add: '添加标签',
                edit: '编辑标签',
                delete: '删除标签',
                name: '标签名称',
                usage: '使用次数',
                confirmDelete:
                    '确定要删除这个标签吗？此操作将会从所有表情包中移除该标签。'
            },
            filter: {
                all: '全部',
                byCategory: '按分类',
                byTag: '按标签'
            }
        },
        common: {
            confirm: '确定',
            cancel: '取消',
            save: '保存',
            delete: '删除',
            edit: '编辑',
            add: '添加',
            search: '搜索',
            loading: '加载中...',
            success: '成功',
            error: '错误',
            warning: '警告',
            info: '信息'
        }
    }
}

export const i18n = createI18n({
    legacy: false,
    locale: 'zh-CN',
    fallbackLocale: 'zh-CN',
    messages
})
