<template>
    <el-dialog
        v-model="visible"
        :title="t('emojiluna.folderImport.title')"
        width="550px"
        @close="handleClose"
        class="folder-import-dialog"
        destroy-on-close
    >
        <div class="dialog-content">
            <!-- Folder Path Input -->
            <div class="form-group">
                <label class="form-label required">{{ t('emojiluna.folderImport.folderPath') }}</label>
                <el-input
                    v-model="form.folderPath"
                    :placeholder="t('emojiluna.folderImport.folderPathPlaceholder')"
                    @blur="handleFolderPathChange"
                    clearable
                >
                    <template #prefix>
                        <el-icon><Folder /></el-icon>
                    </template>
                </el-input>
                <div class="form-hint">{{ t('emojiluna.folderImport.folderPathHint') }}</div>
            </div>

            <!-- Scan Result Preview -->
            <div v-if="scanResult" class="scan-preview">
                <div class="scan-header">
                    <el-icon><Files /></el-icon>
                    <span>{{ t('emojiluna.folderImport.scanResult') }}</span>
                </div>
                <div class="scan-stats">
                    <div class="stat-item">
                        <span class="stat-value">{{ scanResult.totalFiles }}</span>
                        <span class="stat-label">{{ t('emojiluna.folderImport.imageFiles') }}</span>
                    </div>
                    <div class="stat-item" v-if="scanResult.subfolders.length > 0">
                        <span class="stat-value">{{ scanResult.subfolders.length }}</span>
                        <span class="stat-label">{{ t('emojiluna.folderImport.subfolders') }}</span>
                    </div>
                </div>
                <div class="subfolder-list" v-if="scanResult.subfolders.length > 0">
                    <el-tag
                        v-for="folder in scanResult.subfolders.slice(0, 5)"
                        :key="folder"
                        size="small"
                        type="info"
                        effect="plain"
                    >
                        {{ folder }}
                    </el-tag>
                    <el-tag
                        v-if="scanResult.subfolders.length > 5"
                        size="small"
                        type="info"
                        effect="plain"
                    >
                        +{{ scanResult.subfolders.length - 5 }}
                    </el-tag>
                </div>
            </div>

            <!-- Scanning Indicator -->
            <div v-if="scanning" class="scanning-indicator">
                <el-icon class="is-loading"><Loading /></el-icon>
                <span>{{ t('emojiluna.folderImport.scanning') }}</span>
            </div>

            <!-- Options Section -->
            <div class="options-section">
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">{{ t('emojiluna.folderImport.defaultCategory') }}</label>
                        <el-select
                            v-model="form.defaultCategory"
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
                </div>

                <!-- Toggle Options -->
                <div class="option-switches">
                    <div class="option-item" :class="{ active: form.recursive }">
                        <div class="option-content">
                            <div class="option-icon">
                                <el-icon><FolderOpened /></el-icon>
                            </div>
                            <div class="option-text">
                                <div class="option-title">{{ t('emojiluna.folderImport.recursive') }}</div>
                                <div class="option-desc">{{ t('emojiluna.folderImport.recursiveDesc') }}</div>
                            </div>
                        </div>
                        <el-switch v-model="form.recursive" />
                    </div>

                    <div class="option-item" :class="{ active: form.useSubfoldersAsCategories }">
                        <div class="option-content">
                            <div class="option-icon">
                                <el-icon><Collection /></el-icon>
                            </div>
                            <div class="option-text">
                                <div class="option-title">{{ t('emojiluna.folderImport.useSubfolders') }}</div>
                                <div class="option-desc">{{ t('emojiluna.folderImport.useSubfoldersDesc') }}</div>
                            </div>
                        </div>
                        <el-switch v-model="form.useSubfoldersAsCategories" />
                    </div>

                    <div class="option-item" :class="{ active: form.skipExisting }">
                        <div class="option-content">
                            <div class="option-icon">
                                <el-icon><CircleCheck /></el-icon>
                            </div>
                            <div class="option-text">
                                <div class="option-title">{{ t('emojiluna.folderImport.skipExisting') }}</div>
                                <div class="option-desc">{{ t('emojiluna.folderImport.skipExistingDesc') }}</div>
                            </div>
                        </div>
                        <el-switch v-model="form.skipExisting" />
                    </div>

                    <div class="option-item ai-option" :class="{ active: form.aiAnalysis }">
                        <div class="option-content">
                            <div class="option-icon ai-icon">
                                <el-icon><MagicStick /></el-icon>
                            </div>
                            <div class="option-text">
                                <div class="option-title">{{ t('emojiluna.aiAnalysis') }}</div>
                                <div class="option-desc">{{ t('emojiluna.aiAnalysisDesc') }}</div>
                            </div>
                        </div>
                        <el-switch v-model="form.aiAnalysis" />
                    </div>
                </div>
            </div>

            <!-- Import Progress -->
            <div v-if="importing" class="import-progress">
                <el-progress
                    :percentage="importProgress"
                    :status="importProgress === 100 ? 'success' : undefined"
                    :stroke-width="8"
                />
                <div class="progress-text">{{ progressText }}</div>
            </div>

            <!-- Import Result -->
            <div v-if="importResult" class="import-result" :class="{ 'has-errors': importResult.errors.length > 0 }">
                <div class="result-header">
                    <el-icon v-if="importResult.success"><CircleCheck /></el-icon>
                    <el-icon v-else class="error-icon"><WarningFilled /></el-icon>
                    <span>{{ t('emojiluna.folderImport.importComplete') }}</span>
                </div>
                <div class="result-stats">
                    <div class="result-stat success">
                        <span class="stat-value">{{ importResult.imported }}</span>
                        <span class="stat-label">{{ t('emojiluna.folderImport.imported') }}</span>
                    </div>
                    <div class="result-stat warning" v-if="importResult.skipped > 0">
                        <span class="stat-value">{{ importResult.skipped }}</span>
                        <span class="stat-label">{{ t('emojiluna.folderImport.skipped') }}</span>
                    </div>
                    <div class="result-stat error" v-if="importResult.failed > 0">
                        <span class="stat-value">{{ importResult.failed }}</span>
                        <span class="stat-label">{{ t('emojiluna.folderImport.failed') }}</span>
                    </div>
                </div>
                <div v-if="importResult.errors.length > 0" class="error-list">
                    <div v-for="(error, index) in importResult.errors.slice(0, 3)" :key="index" class="error-item">
                        {{ error }}
                    </div>
                    <div v-if="importResult.errors.length > 3" class="error-more">
                        +{{ importResult.errors.length - 3 }} {{ t('emojiluna.folderImport.moreErrors') }}
                    </div>
                </div>
            </div>
        </div>

        <template #footer>
            <div class="dialog-footer">
                <el-button @click="handleClose" class="cancel-btn">{{ t('common.cancel') }}</el-button>
                <el-button
                    type="primary"
                    @click="handleImport"
                    :loading="importing"
                    :disabled="!canImport"
                    class="submit-btn"
                >
                    <el-icon v-if="!importing"><Download /></el-icon>
                    {{ importing ? t('emojiluna.folderImport.importing') : t('emojiluna.folderImport.startImport') }}
                </el-button>
            </div>
        </template>
    </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { send } from '@koishijs/client'
import { ElMessage } from 'element-plus'
import {
    Folder,
    FolderOpened,
    Files,
    Collection,
    CircleCheck,
    MagicStick,
    Download,
    Loading,
    WarningFilled
} from '@element-plus/icons-vue'
import type { Category, FolderImportOptions, FolderImportResult, FolderScanResult } from 'koishi-plugin-emojiluna'

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

const categories = ref<Category[]>([])
const scanning = ref(false)
const importing = ref(false)
const scanResult = ref<FolderScanResult | null>(null)
const importResult = ref<FolderImportResult | null>(null)
const importProgress = ref(0)
const progressText = ref('')

const form = reactive<FolderImportOptions>({
    folderPath: '',
    useSubfoldersAsCategories: true,
    defaultCategory: '其他',
    recursive: true,
    aiAnalysis: false,
    skipExisting: true
})

const canImport = computed(() => {
    return form.folderPath.trim() && !scanning.value && !importing.value
})

const loadCategories = async () => {
    try {
        categories.value = await send('emojiluna/getCategories') || []
    } catch (error) {
        console.error('Failed to load categories:', error)
    }
}

const handleFolderPathChange = async () => {
    if (!form.folderPath.trim()) {
        scanResult.value = null
        return
    }

    scanning.value = true
    scanResult.value = null

    try {
        const result = await send('emojiluna/scanFolder', form.folderPath.trim())
        scanResult.value = result
    } catch (error) {
        console.error('Scan failed:', error)
        ElMessage.warning(`${error.message || '扫描文件夹失败'}`)
    } finally {
        scanning.value = false
    }
}

const handleImport = async () => {
    if (!canImport.value) return

    importing.value = true
    importResult.value = null
    importProgress.value = 0
    progressText.value = t('emojiluna.folderImport.preparingImport')

    try {
        progressText.value = t('emojiluna.folderImport.importingEmojis')
        importProgress.value = 20

        const result = await send('emojiluna/importFromFolder', {
            folderPath: form.folderPath.trim(),
            useSubfoldersAsCategories: form.useSubfoldersAsCategories,
            defaultCategory: form.defaultCategory || '其他',
            recursive: form.recursive,
            aiAnalysis: form.aiAnalysis,
            skipExisting: form.skipExisting
        })

        importProgress.value = 100
        importResult.value = result

        if (result.success && result.imported > 0) {
            ElMessage.success(t('emojiluna.folderImport.importSuccess', { count: result.imported }))
            emit('success')
        } else if (result.imported === 0 && result.skipped > 0) {
            ElMessage.info(t('emojiluna.folderImport.allSkipped'))
        } else if (!result.success) {
            ElMessage.error(t('emojiluna.folderImport.importFailed'))
        }
    } catch (error) {
        console.error('Import failed:', error)
        ElMessage.error(`${error.message || '导入失败'}`)
        importResult.value = {
            success: false,
            imported: 0,
            skipped: 0,
            failed: 0,
            errors: [error.message || '导入失败'],
            importedEmojis: []
        }
    } finally {
        importing.value = false
    }
}

const resetForm = () => {
    form.folderPath = ''
    form.useSubfoldersAsCategories = true
    form.defaultCategory = '其他'
    form.recursive = true
    form.aiAnalysis = false
    form.skipExisting = true
    scanResult.value = null
    importResult.value = null
    importProgress.value = 0
}

const handleClose = () => {
    resetForm()
    visible.value = false
}

watch(
    () => props.modelValue,
    (newValue) => {
        if (newValue) {
            loadCategories()
        }
    }
)

onMounted(() => {
    loadCategories()
})
</script>

<style scoped>
.dialog-content {
    padding: 0 4px;
}

.form-group {
    margin-bottom: 20px;
}

.form-label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--k-text-light);
}

.form-label.required::after {
    content: '*';
    color: var(--k-color-danger);
    margin-left: 4px;
}

.form-hint {
    margin-top: 6px;
    font-size: 12px;
    color: var(--k-text-lighter);
}

.form-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 20px;
    margin-bottom: 20px;
}

/* Scan Result */
.scan-preview {
    background: var(--k-color-surface-1);
    border: 1px solid var(--k-color-divider);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 20px;
}

.scan-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: var(--k-color-text);
    margin-bottom: 12px;
}

.scan-stats {
    display: flex;
    gap: 24px;
    margin-bottom: 12px;
}

.stat-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.stat-value {
    font-size: 24px;
    font-weight: 700;
    color: var(--k-color-primary);
}

.stat-label {
    font-size: 12px;
    color: var(--k-text-light);
}

.subfolder-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.scanning-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 20px;
    color: var(--k-text-light);
}

/* Options Section */
.options-section {
    margin-bottom: 20px;
}

.option-switches {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.option-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--k-color-surface-1);
    padding: 10px 14px;
    border-radius: 12px;
    border: 1px solid var(--k-color-divider);
    transition: all 0.3s ease;
}

.option-item.active {
    border-color: var(--k-color-primary);
    background: color-mix(in srgb, var(--k-color-primary), transparent 97%);
}

.option-item.ai-option.active {
    border-color: #a855f7;
    background: color-mix(in srgb, #a855f7, transparent 97%);
}

.option-content {
    display: flex;
    align-items: center;
    gap: 12px;
}

.option-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: var(--k-color-surface-2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--k-color-primary);
    font-size: 16px;
}

.option-icon.ai-icon {
    background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
    color: white;
}

.option-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.option-title {
    font-weight: 500;
    font-size: 13px;
    color: var(--k-color-text);
}

.option-desc {
    font-size: 12px;
    color: var(--k-text-light);
    line-height: 1.2;
}

/* Progress */
.import-progress {
    margin-bottom: 20px;
}

.progress-text {
    text-align: center;
    margin-top: 8px;
    font-size: 13px;
    color: var(--k-text-light);
}

/* Import Result */
.import-result {
    background: var(--k-color-surface-1);
    border: 1px solid var(--k-color-success);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 20px;
}

.import-result.has-errors {
    border-color: var(--k-color-warning);
}

.result-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: var(--k-color-success);
    margin-bottom: 12px;
}

.import-result.has-errors .result-header {
    color: var(--k-color-warning);
}

.error-icon {
    color: var(--k-color-warning);
}

.result-stats {
    display: flex;
    gap: 24px;
    margin-bottom: 12px;
}

.result-stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.result-stat .stat-value {
    font-size: 20px;
    font-weight: 700;
}

.result-stat.success .stat-value {
    color: var(--k-color-success);
}

.result-stat.warning .stat-value {
    color: var(--k-color-warning);
}

.result-stat.error .stat-value {
    color: var(--k-color-danger);
}

.result-stat .stat-label {
    font-size: 12px;
    color: var(--k-text-light);
}

.error-list {
    background: color-mix(in srgb, var(--k-color-danger), transparent 94%);
    border-radius: 8px;
    padding: 12px;
    margin-top: 12px;
}

.error-item {
    font-size: 12px;
    color: var(--k-color-danger);
    margin-bottom: 4px;
}

.error-item:last-child {
    margin-bottom: 0;
}

.error-more {
    font-size: 12px;
    color: var(--k-text-light);
    margin-top: 8px;
}

/* Footer */
.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding-top: 10px;
}
</style>
