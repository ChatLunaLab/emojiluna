<template>
    <el-dialog
        v-model="visible"
        :title="t('emojiluna.editEmoji')"
        width="700px"
        @close="handleClose"
        class="edit-emoji-dialog"
        destroy-on-close
    >
        <div class="dialog-content">
            <div class="dialog-layout">
                <!-- Left: Preview -->
                <div class="preview-side">
                    <div class="preview-card">
                        <img :src="emojiUrl" :alt="emoji?.name" @error="handleImageError" />
                    </div>
                    <div class="emoji-meta">
                        <span class="meta-label">ID: {{ emoji?.id.slice(0, 8) }}...</span>
                        <span class="meta-size" v-if="emoji?.size">{{ formatSize(emoji.size) }}</span>
                    </div>
                </div>

                <!-- Right: Form -->
                <div class="form-side">
                    <div class="form-group">
                        <label class="form-label">{{ t('emojiluna.emojiName') }}</label>
                        <el-input v-model="form.name" disabled :placeholder="t('emojiluna.emojiName')">
                            <template #prefix>
                                <el-icon><Picture /></el-icon>
                            </template>
                        </el-input>
                    </div>

                    <div class="form-group">
                        <label class="form-label">{{ t('emojiluna.category') }}</label>
                        <el-select
                            v-model="form.category"
                            :placeholder="t('emojiluna.category')"
                            style="width: 100%"
                            filterable
                            allow-create
                            default-first-option
                        >
                            <el-option
                                v-for="category in categories"
                                :key="category.name"
                                :label="category.name"
                                :value="category.name"
                            />
                        </el-select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">{{ t('emojiluna.tags.default') }}</label>
                        <el-select
                            v-model="form.tags"
                            :placeholder="t('emojiluna.tags.default')"
                            style="width: 100%"
                            multiple
                            filterable
                            allow-create
                            default-first-option
                            collapse-tags
                            collapse-tags-tooltip
                        >
                            <el-option
                                v-for="tag in allTags"
                                :key="tag"
                                :label="tag"
                                :value="tag"
                            />
                        </el-select>
                    </div>
                </div>
            </div>
        </div>

        <template #footer>
            <div class="dialog-footer">
                <el-button type="danger" text bg @click="handleDelete" class="delete-btn">
                    <el-icon><Delete /></el-icon> {{ t('common.delete') }}
                </el-button>
                <div class="footer-actions">
                    <el-button @click="handleClose">{{ t('common.cancel') }}</el-button>
                    <el-button type="primary" @click="handleSave" :loading="loading">
                        {{ t('common.save') }}
                    </el-button>
                </div>
            </div>
        </template>
    </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { send } from '@koishijs/client'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Picture, Delete } from '@element-plus/icons-vue'
import type { EmojiItem, Category } from 'koishi-plugin-emojiluna'

interface Props {
    modelValue: boolean
    emoji?: EmojiItem
    baseUrl?: string
}

interface Emits {
    (e: 'update:modelValue', value: boolean): void
    (e: 'success'): void
}

const props = withDefaults(defineProps<Props>(), {
    baseUrl: '/emojiluna'
})

const emit = defineEmits<Emits>()

const { t } = useI18n()

const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

const loading = ref(false)
const categories = ref<Category[]>([])
const allTags = ref<string[]>([])

const form = reactive({
    name: '',
    category: '',
    tags: [] as string[]
})

const emojiUrl = computed(() => {
    if (!props.emoji) return ''
    return `${props.baseUrl}/get/${props.emoji.name}`
})

const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const loadData = async () => {
    try {
        const [categoriesData, tagsData] = await Promise.all([
            send('emojiluna/getCategories'),
            send('emojiluna/getAllTags')
        ])

        categories.value = categoriesData || []
        allTags.value = tagsData || []
    } catch (error) {
        console.error('Failed to load data:', error)
    }
}

const handleImageError = (event: Event) => {
    const img = event.target as HTMLImageElement
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0zMiAyMEM0Mi40IDIwIDQ0IDMwIDQ0IDMwQzQ0IDMwIDQyLjQgNDAgMzIgNDBDMjEuNiA0MCAyMCAzMCAyMCAzMEMyMCAzMCAyMS42IDIwIDMyIDIwWiIgZmlsbD0iI0NDQ0NDQyIvPgo8L3N2Zz4K'
}

const handleClose = () => {
    visible.value = false
}

const handleSave = async () => {
    if (!props.emoji) return

    loading.value = true
    try {
        const promises = []

        // 更新分类
        if (form.category !== props.emoji.category) {
            promises.push(send('emojiluna/updateEmojiCategory', props.emoji.id, form.category))
        }

        // 更新标签
        if (JSON.stringify(form.tags.sort()) !== JSON.stringify([...props.emoji.tags].sort())) {
            promises.push(send('emojiluna/updateEmojiTags', props.emoji.id, form.tags))
        }

        if (promises.length > 0) {
            await Promise.all(promises)
            ElMessage.success(t('emojiluna.updateSuccess'))
            emit('success')
            handleClose()
        } else {
            handleClose()
        }
    } catch (error) {
        console.error('Failed to update emoji:', error)
        ElMessage.error(t('emojiluna.updateFailed'))
    } finally {
        loading.value = false
    }
}

const handleDelete = async () => {
    if (!props.emoji) return
    try {
        await ElMessageBox.confirm(
            t('emojiluna.deleteConfirm'),
            t('common.warning'),
            {
                confirmButtonText: t('common.delete'),
                cancelButtonText: t('common.cancel'),
                type: 'warning',
            }
        )

        await send('emojiluna/deleteEmoji', props.emoji.id)
        ElMessage.success('删除成功')
        emit('success')
        handleClose()
    } catch (error) {
        if (error !== 'cancel') {
             ElMessage.error('删除失败')
        }
    }
}

watch(
    () => props.emoji,
    (newEmoji) => {
        if (newEmoji) {
            form.name = newEmoji.name
            form.category = newEmoji.category
            form.tags = [...newEmoji.tags]
        }
    },
    { immediate: true }
)

watch(
    () => props.modelValue,
    (newValue) => {
        if (newValue) {
            loadData()
        }
    }
)

onMounted(() => {
    loadData()
})
</script>

<style scoped>
.dialog-content {
    padding: 0 4px;
}

.dialog-layout {
    display: flex;
    gap: 24px;
}

.preview-side {
    width: 220px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.preview-card {
    width: 100%;
    box-sizing: border-box;
    aspect-ratio: 1;
    background: var(--k-color-surface-1); /* Koishi theme */
    border: 1px solid var(--k-color-divider);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    overflow: hidden;
}

.preview-card img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    transition: transform 0.3s ease;
}

.preview-card:hover img {
    transform: scale(1.05);
}

.emoji-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 0 4px;
}

.meta-label {
    font-size: 12px;
    color: var(--k-text-light);
    font-family: monospace;
}

.meta-size {
    font-size: 12px;
    color: var(--k-text-light);
    background: var(--k-color-surface-2);
    padding: 2px 6px;
    border-radius: 4px;
    align-self: flex-start;
}

.form-side {
    flex: 1;
    min-width: 0;
    padding-top: 4px;
}

.form-group {
    margin-bottom: 20px;
}

.form-label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    color: var(--k-text-light);
    line-height: 1.4;
}

.dialog-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 10px;
}

.footer-actions {
    display: flex;
    gap: 12px;
}
</style>
