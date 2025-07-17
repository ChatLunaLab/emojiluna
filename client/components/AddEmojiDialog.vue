<template>
    <el-dialog v-model="visible" :title="t('emojiluna.addEmoji')" width="600px" @close="handleClose">
        <el-tabs v-model="activeTab" type="card">
            <!-- 文件上传 -->
            <el-tab-pane label="文件上传" name="upload">
                <el-form :model="form" label-width="80px" v-loading="loading">
                    <el-form-item :label="t('emojiluna.emojiName')" required>
                        <el-input v-model="form.name" :placeholder="t('emojiluna.emojiName')" @input="validateForm" />
                    </el-form-item>

                    <el-form-item :label="t('emojiluna.category')">
                        <el-select v-model="form.category" :placeholder="t('emojiluna.category')" style="width: 100%"
                            filterable allow-create default-first-option>
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

                    <el-form-item label="文件">
                        <div class="upload-area" :class="{ 'drag-over': isDragOver }" @drop="handleDrop"
                            @dragover="handleDragOver" @dragleave="handleDragLeave" @click="triggerFileInput">
                            <div v-if="!selectedFile" class="upload-placeholder">
                                <el-icon size="48">
                                    <UploadFilled />
                                </el-icon>
                                <p>{{ t('emojiluna.dragUpload') }}</p>
                                <el-button type="primary">选择文件</el-button>
                            </div>
                            <div v-else class="file-preview">
                                <img v-if="filePreview" :src="filePreview" alt="Preview" class="preview-image" />
                                <p>{{ selectedFile.name }}</p>
                                <el-button @click.stop="clearFile" size="small" type="danger">
                                    移除
                                </el-button>
                            </div>
                        </div>
                        <input ref="fileInput" type="file" accept="image/*" style="display: none"
                            @change="handleFileSelect" />
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
                <el-button @click="handleClose">{{ t('common.cancel') }}</el-button>
                <el-button type="primary" @click="handleSubmit" :loading="loading" :disabled="!canSubmit">
                    {{ t('common.add') }}
                </el-button>
            </span>
        </template>
    </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { send } from '@koishijs/client'
import { ElMessage } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import type { Category } from 'koishi-plugin-emojiluna'

interface Props {
    modelValue: boolean
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
const isDragOver = ref(false)
const selectedFile = ref<File | null>(null)
const filePreview = ref<string>('')
const urlPreview = ref(false)
const fileInput = ref<HTMLInputElement>()

const form = reactive({
    name: '',
    category: '',
    tags: [] as string[]
})

const urlForm = reactive({
    name: '',
    category: '',
    tags: [] as string[],
    url: ''
})

const canSubmit = computed(() => {
    if (activeTab.value === 'upload') {
        return form.name.trim() && selectedFile.value
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

const validateForm = () => {
    // 可以添加表单验证逻辑
}

const validateUrlForm = () => {
    // 可以添加URL表单验证逻辑
}

const triggerFileInput = () => {
    fileInput.value?.click()
}

const handleFileSelect = (event: Event) => {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    if (file) {
        setSelectedFile(file)
    }
}

const setSelectedFile = (file: File) => {
    selectedFile.value = file

    // 生成预览
    const reader = new FileReader()
    reader.onload = (e) => {
        filePreview.value = e.target?.result as string
    }
    reader.readAsDataURL(file)

    // 自动设置名称（如果未设置）
    if (!form.name) {
        form.name = file.name.replace(/\.[^/.]+$/, '')
    }
}

const clearFile = () => {
    selectedFile.value = null
    filePreview.value = ''
    if (fileInput.value) {
        fileInput.value.value = ''
    }
}

const handleDragOver = (event: DragEvent) => {
    event.preventDefault()
    isDragOver.value = true
}

const handleDragLeave = (event: DragEvent) => {
    event.preventDefault()
    isDragOver.value = false
}

const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    isDragOver.value = false

    const files = event.dataTransfer?.files
    if (files && files.length > 0) {
        setSelectedFile(files[0])
    }
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
    if (!selectedFile.value) return

    // 将文件转换为base64
    const buffer = await selectedFile.value.arrayBuffer()
    const uint8Array = new Uint8Array(buffer)
    const base64 = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)))

    const emojiData = {
        name: form.name,
        category: form.category || '其他',
        tags: form.tags,
        imageData: base64,
        mimeType: selectedFile.value.type
    }

    await send('emojiluna/addEmoji', emojiData)
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
    form.name = ''
    form.category = ''
    form.tags = []
    urlForm.name = ''
    urlForm.category = ''
    urlForm.tags = []
    urlForm.url = ''
    clearFile()
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
        }
    }
)

onMounted(() => {
    loadData()
})
</script>

<style scoped>
.upload-area {
    border: 2px dashed var(--k-border-color);
    border-radius: 8px;
    padding: 20px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s ease;
    min-height: 150px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.upload-area:hover,
.upload-area.drag-over {
    border-color: var(--k-color-primary);
    background-color: var(--k-color-primary-light-9);
}

.upload-placeholder p {
    margin: 10px 0;
    color: var(--k-color-text-2);
}

.file-preview,
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
