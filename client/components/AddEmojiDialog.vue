<template>
    <el-dialog v-model="visible" :title="t('emojiluna.addEmoji')" width="600px" @close="handleClose">
        <el-tabs v-model="activeTab" type="card">
            <!-- 文件上传 -->
            <el-tab-pane label="文件上传" name="upload">
                <el-form :model="form" label-width="80px" v-loading="loading">
                    <el-form-item :label="t('emojiluna.category')">
                        <el-select v-model="form.category" :placeholder="t('emojiluna.category')" style="width: 100%"
                            filterable allow-create default-first-option>
                            <el-option v-for="category in categories" :key="category.name" :label="category.name"
                                :value="category.name" />
                        </el-select>
                    </el-form-item>

                    <el-form-item :label="t('emojiluna.tags.default')">
                        <el-select v-model="form.tags" :placeholder="t('emojiluna.tags.default')" style="width: 100%"
                            multiple filterable allow-create default-first-option>
                            <el-option v-for="tag in allTags" :key="tag" :label="tag" :value="tag" />
                        </el-select>
                    </el-form-item>

                    <el-form-item label="AI 分析">
                        <el-switch v-model="form.aiAnalysis" />
                        <el-tooltip class="box-item" effect="dark"
                            content="开启后，将使用 AI 自动为新表情包生成更精准的名称、分类和标签。如果关闭，则使用文件名作为名称，并应用当前表单设置。" placement="top">
                            <el-icon style="margin-left: 8px; color: var(--k-text-light);">
                                <QuestionFilled />
                            </el-icon>
                        </el-tooltip>
                    </el-form-item>

                    <el-form-item label="选择文件" required>
                        <el-upload v-model:file-list="fileList" action="#" list-type="picture-card" :auto-upload="false"
                            multiple accept="image/*">
                            <el-icon>
                                <Plus />
                            </el-icon>
                        </el-upload>
                    </el-form-item>
                </el-form>
            </el-tab-pane>

            <!-- URL 添加 -->
            <el-tab-pane label="URL 添加" name="url">
                <el-form :model="urlForm" label-width="80px" v-loading="loading">
                    <el-form-item :label="t('emojiluna.emojiName')" required>
                        <el-input v-model="urlForm.name" :placeholder="t('emojiluna.emojiName')"
                            @input="validateUrlForm" />
                    </el-form-item>

                    <el-form-item :label="t('emojiluna.category')">
                        <el-select v-model="urlForm.category" :placeholder="t('emojiluna.category')" style="width: 100%"
                            filterable allow-create default-first-option>
                            <el-option v-for="category in categories" :key="category.name" :label="category.name"
                                :value="category.name" />
                        </el-select>
                    </el-form-item>

                    <el-form-item :label="t('emojiluna.tags.default')">
                        <el-select v-model="urlForm.tags" :placeholder="t('emojiluna.tags.default')" style="width: 100%"
                            multiple filterable allow-create default-first-option>
                            <el-option v-for="tag in allTags" :key="tag" :label="tag" :value="tag" />
                        </el-select>
                    </el-form-item>

                    <el-form-item label="图片URL" required>
                        <el-input v-model="urlForm.url" :placeholder="t('emojiluna.urlPlaceholder')"
                            @input="handleUrlChange" />
                    </el-form-item>

                    <el-form-item label="预览" v-if="urlPreview">
                        <div class="url-preview">
                            <img :src="urlForm.url" alt="URL Preview" class="preview-image" @error="handleUrlError" />
                        </div>
                    </el-form-item>
                </el-form>
            </el-tab-pane>
        </el-tabs>

        <template #footer>
            <span class="dialog-footer">
                <el-button type="primary" @click="handleSubmit" :loading="loading" :disabled="!canSubmit">
                    {{ t('common.add') }}
                </el-button>
                <el-button @click="handleClose">{{ t('common.cancel') }}</el-button>
            </span>
        </template>
    </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { send } from '@koishijs/client'
import { ElMessage, type UploadUserFile } from 'element-plus'
import { UploadFilled, Plus, QuestionFilled } from '@element-plus/icons-vue'
import type { Category, EmojiAddOptions } from 'koishi-plugin-emojiluna'

interface Props {
    modelValue: boolean
    defaultCategory?: string
}

interface Emits {
    (e: 'update:modelValue', value: boolean): void
    (e: 'success'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()

const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

const activeTab = ref('upload')
const loading = ref(false)
const categories = ref<Category[]>([])
const allTags = ref<string[]>([])
const urlPreview = ref(false)
const fileList = ref<UploadUserFile[]>([])

const form = reactive({
    category: '',
    tags: [] as string[],
    aiAnalysis: true,
})

const urlForm = reactive({
    name: '',
    category: '',
    tags: [] as string[],
    url: ''
})

const canSubmit = computed(() => {
    if (activeTab.value === 'upload') {
        return fileList.value.length > 0
    } else {
        return urlForm.name.trim() && urlForm.url.trim() && urlPreview.value
    }
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

const validateUrlForm = () => {
    // 可以添加URL表单验证逻辑
}

const handleUrlChange = () => {
    validateUrlForm()
    checkUrlPreview()
}

const checkUrlPreview = () => {
    if (urlForm.url.trim()) {
        urlPreview.value = true
    } else {
        urlPreview.value = false
    }
}

const handleUrlError = () => {
    urlPreview.value = false
    ElMessage.warning('图片URL无效或无法加载')
}

const handleSubmit = async () => {
    loading.value = true

    try {
        if (activeTab.value === 'upload') {
            await submitFile()
        } else {
            await submitUrl()
        }

        ElMessage.success(t('emojiluna.addSuccess'))
        emit('success')
        handleClose()
    } catch (error) {
        console.error('Failed to add emoji:', error)
        ElMessage.error(t('emojiluna.addFailed'))
    } finally {
        loading.value = false
    }
}

const submitFile = async () => {
    if (fileList.value.length === 0) return

    const filesToUpload = fileList.value.map(file => {
        return new Promise<EmojiAddOptions>((resolve, reject) => {
            if (!file.raw) {
                return reject(new Error('File object is missing.'))
            }
            const reader = new FileReader()
            reader.readAsDataURL(file.raw)
            reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1]
                resolve({
                    name: file.name.replace(/\.[^/.]+$/, ''),
                    category: form.category || '其他',
                    tags: form.tags,
                    imageData: base64,
                    //mimeType: file.raw.type,
                })
            }
            reader.onerror = error => reject(error)
        })
    })

    const emojisData = await Promise.all(filesToUpload)

    await send('emojiluna/addEmojis',
        emojisData,
        form.aiAnalysis,
    )
}

const submitUrl = async () => {
    // 从URL下载图片并转换为base64
    const response = await fetch(urlForm.url)
    const buffer = await response.arrayBuffer()
    const uint8Array = new Uint8Array(buffer)
    const base64 = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)))

    const emojiData = {
        name: urlForm.name,
        category: urlForm.category || '其他',
        tags: urlForm.tags,
        imageData: base64,
        mimeType: response.headers.get('content-type') || 'image/png'
    }

    await send('emojiluna/addEmoji', emojiData)
}

const resetForm = () => {
    form.category = ''
    form.tags = []
    form.aiAnalysis = true
    urlForm.name = ''
    urlForm.category = ''
    urlForm.tags = []
    urlForm.url = ''
    fileList.value = []
    urlPreview.value = false
    activeTab.value = 'upload'
}

const handleClose = () => {
    resetForm()
    visible.value = false
}

watch(
    () => props.modelValue,
    (newValue) => {
        if (newValue) {
            loadData()
            // 设置默认分类
            if (props.defaultCategory) {
                form.category = props.defaultCategory
                urlForm.category = props.defaultCategory
            }
        }
    }
)

onMounted(() => {
    loadData()
})
</script>

<style scoped>
.url-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
}

.preview-image {
    max-width: 100px;
    max-height: 100px;
    object-fit: cover;
    border-radius: 8px;
    border: 1px solid var(--k-border-color);
}

.dialog-footer {
    display: flex;
    gap: 10px;
}

:deep(.el-tabs__content) {
    padding-top: 20px;
}
</style>
