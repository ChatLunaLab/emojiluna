<template>
    <el-dialog v-model="visible" :title="t('emojiluna.editEmoji')" width="600px" @close="handleClose">
        <el-form :model="form" label-width="100px" v-loading="loading">
            <el-form-item :label="t('emojiluna.emojiName')">
                <el-input v-model="form.name" :placeholder="t('emojiluna.emojiName')" />
            </el-form-item>

            <el-form-item :label="t('emojiluna.category')">
                <el-select v-model="form.category" :placeholder="t('emojiluna.category')" style="width: 100%" filterable
                    allow-create default-first-option>
                    <el-option v-for="category in categories" :key="category.name" :label="category.name"
                        :value="category.name" />
                </el-select>
            </el-form-item>

            <el-form-item :label="t('emojiluna.tags.default')">
                <el-select v-model="form.tags" :placeholder="t('emojiluna.tags.default')" style="width: 100%" multiple
                    filterable allow-create default-first-option>
                    <el-option v-for="tag in allTags" :key="tag" :label="tag" :value="tag" />
                </el-select>
            </el-form-item>

            <el-form-item label="预览">
                <div class="emoji-preview">
                    <img :src="emojiUrl" :alt="emoji?.name" @error="handleImageError" />
                </div>
            </el-form-item>
        </el-form>

        <template #footer>
            <span class="dialog-footer">
                <el-button type="primary" @click="handleSave" :loading="loading">
                    {{ t('common.save') }}
                </el-button>
                <el-button @click="handleClose">{{ t('common.cancel') }}</el-button>
            </span>
        </template>
    </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { send } from '@koishijs/client'
import { ElMessage } from 'element-plus'
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
        // 更新分类
        if (form.category !== props.emoji.category) {
            await send('emojiluna/updateEmojiCategory', props.emoji.id, form.category)
        }

        // 更新标签
        if (JSON.stringify(form.tags.sort()) !== JSON.stringify([...props.emoji.tags].sort())) {
            await send('emojiluna/updateEmojiTags', props.emoji.id, form.tags)
        }

        ElMessage.success(t('emojiluna.updateSuccess'))
        emit('success')
        handleClose()
    } catch (error) {
        console.error('Failed to update emoji:', error)
        ElMessage.error(t('emojiluna.updateFailed'))
    } finally {
        loading.value = false
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
.emoji-preview {
    width: 100px;
    height: 100px;
    border: 1px solid var(--k-border-color);
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--k-color-surface-1);
}

.emoji-preview img {
    max-width: 100%;
    max-height: 100%;
    object-fit: cover;
}

.dialog-footer {
    display: flex;
    gap: 10px;
}
</style>
