<template>
  <div class="category-detail">
    <!-- Header -->
    <div class="detail-header">
      <div class="header-left">
        <el-button
          circle
          text
          @click="$emit('back')"
          class="back-button"
        >
          <el-icon :size="20"><ArrowLeft /></el-icon>
        </el-button>
        <div class="header-title">
          <h2 class="title-text">{{ category?.name }}</h2>
          <span class="subtitle-text">{{ category?.emojiCount }} 项</span>
        </div>
      </div>
      <div class="header-right">
        <el-button
          :type="isSelectionMode ? 'danger' : 'default'"
          circle
          @click="toggleSelectionMode"
          :title="isSelectionMode ? t('common.cancel') : '选择'"
        >
          <el-icon v-if="isSelectionMode"><Close /></el-icon>
          <el-icon v-else><Check /></el-icon>
        </el-button>

        <template v-if="!isSelectionMode">
             <el-button @click="showImportDialog = true">
                <el-icon><Download /></el-icon>
                导入
             </el-button>
             <el-button type="primary" @click="showAddDialog = true">
                <el-icon><Plus /></el-icon>
                上传
             </el-button>
        </template>
      </div>
    </div>

    <!-- Search Bar (Compact) -->
    <div class="toolbar-container">
        <div class="search-section">
             <el-input
                v-model="searchKeyword"
                placeholder="在此分类中搜索..."
                class="search-input"
                @keyup.enter="handleSearch"
                clearable
              >
                <template #prefix>
                  <el-icon><Search /></el-icon>
                </template>
              </el-input>
        </div>
        <div class="actions-section">
             <el-button circle @click="refreshData">
                <el-icon><RefreshRight /></el-icon>
             </el-button>
        </div>
    </div>

    <!-- Grid -->
    <div class="emoji-grid-container" v-loading="loading">
      <template v-if="emojis.length > 0">
        <div class="emoji-grid">
            <EmojiCard
              v-for="emoji in emojis"
              :key="emoji.id"
              :emoji="emoji"
              :base-url="baseUrl"
              :selectable="isSelectionMode"
              :selected="isSelected(emoji)"
              @click="handleEmojiClick"
              @select="handleEmojiSelect"
              @edit="handleEmojiEdit"
              @delete="handleEmojiDelete"
              class="emoji-card-item"
            />
        </div>
      </template>
      <div v-else class="no-emojis">
        <el-empty description="该分类下暂无表情包" />
      </div>
    </div>

    <!-- Pagination -->
    <div class="pagination" v-if="total > pageSize">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[20, 50, 100]"
        :total="total"
        layout="prev, pager, next"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
        background
      />
    </div>

    <!-- Floating Action Bar (Selection Mode) -->
    <Transition name="slide-up">
      <div class="floating-action-bar" v-if="isSelectionMode && selectedEmojis.length > 0">
        <div class="selection-count">
            已选择 {{ selectedEmojis.length }} 项
        </div>
        <div class="selection-actions">
             <el-button type="primary" text bg @click="openMoveDialog">
                <el-icon><FolderOpened /></el-icon>
                移动到...
            </el-button>
            <el-button type="danger" text bg @click="handleBatchDelete">
                <el-icon><Delete /></el-icon>
                删除
            </el-button>
        </div>
      </div>
    </Transition>


    <!-- Dialogs -->
    <AddEmojiDialog
      v-model="showAddDialog"
      @success="handleAddSuccess"
      :default-category="category?.name"
    />

    <EmojiDialog
      v-model="showEditDialog"
      :emoji="selectedEmoji"
      :base-url="baseUrl"
      @success="handleEditSuccess"
    />

    <ImageSelector
        v-model="showImportDialog"
        title="导入表情包到当前分类"
        :exclude-category="category?.name"
        @confirm="handleImportConfirm"
    />

    <!-- Move Dialog -->
    <el-dialog
        v-model="showMoveDialog"
        title="移动到分类"
        width="400px"
    >
        <el-select v-model="targetCategory" placeholder="选择目标分类" style="width: 100%">
            <el-option
                v-for="cat in allCategories"
                :key="cat.name"
                :label="cat.name"
                :value="cat.name"
                :disabled="cat.name === category?.name"
            />
        </el-select>
        <template #footer>
            <span class="dialog-footer">
                <el-button @click="showMoveDialog = false">取消</el-button>
                <el-button type="primary" @click="confirmMove" :loading="moving">
                    确定
                </el-button>
            </span>
        </template>
    </el-dialog>

    <!-- Preview Dialog -->
    <el-dialog
      v-model="showPreviewDialog"
      :title="previewEmoji?.name || '表情包预览'"
      width="500px"
      @close="handlePreviewClose"
    >
      <div class="preview-content">
        <div class="preview-image-container">
          <img
            :src="previewEmojiUrl"
            :alt="previewEmoji?.name"
            class="preview-image"
            @error="handlePreviewImageError"
          />
        </div>

        <div class="preview-info">
          <div class="info-item">
            <span class="info-label">名称：</span>
            <span class="info-value">{{ previewEmoji?.name }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">分类：</span>
            <span class="info-value">{{ previewEmoji?.category }}</span>
          </div>
          <div class="info-item" v-if="previewEmoji?.tags?.length">
            <span class="info-label">标签：</span>
            <span class="info-value">
              <el-tag
                v-for="tag in previewEmoji.tags"
                :key="tag"
                size="small"
                class="tag-item"
              >
                {{ tag }}
              </el-tag>
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">链接：</span>
            <el-input
              v-model="previewEmojiLink"
              readonly
              size="small"
              class="link-input"
            >
              <template #append>
                <el-button @click="copyPreviewLink" :icon="DocumentCopy">
                  复制
                </el-button>
              </template>
            </el-input>
          </div>
        </div>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button type="primary" @click="copyPreviewLink">
            <el-icon><DocumentCopy /></el-icon>
            复制链接
          </el-button>
          <el-button
            type="warning"
            @click="handleAIAnalyze"
            :loading="aiCategorizingId === previewEmoji?.id"
            :disabled="aiCategorizingId !== ''"
          >
            <el-icon><MagicStick /></el-icon>
            AI分析
          </el-button>
          <el-button @click="handlePreviewEdit">
            <el-icon><Edit /></el-icon>
            编辑
          </el-button>
          <el-button @click="handlePreviewClose">关闭</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { send } from '@koishijs/client'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft,
  Search,
  Plus,
  RefreshRight,
  DocumentCopy,
  Edit,
  MagicStick,
  FolderOpened,
  Delete,
  Download,
  Check,
  Close
} from '@element-plus/icons-vue'
import EmojiCard from './EmojiCard.vue'
import EmojiDialog from './EmojiDialog.vue'
import AddEmojiDialog from './AddEmojiDialog.vue'
import ImageSelector from './ImageSelector.vue'
import type { EmojiItem, Category } from 'koishi-plugin-emojiluna'

const { t } = useI18n()

interface Props {
  category: Category | null
}

interface Emits {
  (e: 'back'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Data State
const loading = ref(false)
const emojis = ref<EmojiItem[]>([])
const allCategories = ref<Category[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(50)
const searchKeyword = ref('')
const baseUrl = ref('')

// UI State
const showAddDialog = ref(false)
const showEditDialog = ref(false)
const showImportDialog = ref(false)
const selectedEmoji = ref<EmojiItem>()
const showPreviewDialog = ref(false)
const previewEmoji = ref<EmojiItem>()
const aiCategorizingId = ref<string>('')

// Selection Mode State
const isSelectionMode = ref(false)
const selectedEmojis = ref<EmojiItem[]>([])
const showMoveDialog = ref(false)
const targetCategory = ref('')
const moving = ref(false)

// Computed
const previewEmojiUrl = computed(() => {
  if (!previewEmoji.value) return ''
  return `${baseUrl.value}/get/${previewEmoji.value.name}`
})

const previewEmojiLink = computed(() => {
  if (!previewEmoji.value) return ''
  return `${baseUrl.value}/get/${previewEmoji.value.name}`
})

// Loading
const loadEmojis = async () => {
  if (!props.category) return

  loading.value = true
  try {
    const options = {
      category: props.category.name,
      limit: pageSize.value,
      offset: (currentPage.value - 1) * pageSize.value
    }

    let result
    if (searchKeyword.value.trim()) {
      // Client side filter after global search
      const allResults = await send('emojiluna/searchEmoji', searchKeyword.value.trim())
      result = allResults?.filter((emoji: EmojiItem) => emoji.category === props.category?.name) || []
      emojis.value = result
      total.value = result.length
    } else {
      result = await send('emojiluna/getEmojiList', options)
      emojis.value = result || []

      // Get total count for category
      // Optimization: The category object passed in prop has 'emojiCount'.
      // But it might be stale.
      // Let's rely on backend if we can, or just use the prop.
      // Re-fetching category list to get fresh count might be better.
      // Or separate API for count.
      // For now, let's fetch all (limitless) to count? No, that's heavy.
      // Let's use `getEmojiList` without limit for this category to count? Still heavy?
      // Actually `getEmojiList` without limit returns all ids, which is okay for < 1000 items.
      const allInCategory = await send('emojiluna/getEmojiList', { category: props.category.name })
      total.value = allInCategory?.length || 0
    }

    // Also load all categories for Move Dialog
    if (allCategories.value.length === 0) {
        allCategories.value = await send('emojiluna/getCategories') || []
    }
    if (!baseUrl.value) {
        baseUrl.value = await send('emojiluna/getBaseUrl') || '/emojiluna'
    }

  } catch (error) {
    console.error('Failed to load emojis:', error)
    ElMessage.error('加载表情包失败')
  } finally {
    loading.value = false
  }
}

const refreshData = async () => {
  await loadEmojis()
}

// Event Handlers
const handleSearch = () => {
  currentPage.value = 1
  loadEmojis()
}

const handleSizeChange = (newSize: number) => {
  pageSize.value = newSize
  currentPage.value = 1
  loadEmojis()
}

const handleCurrentChange = (newPage: number) => {
  currentPage.value = newPage
  loadEmojis()
}

const handleEmojiClick = (emoji: EmojiItem) => {
  previewEmoji.value = emoji
  showPreviewDialog.value = true
}

const handleEmojiEdit = (emoji: EmojiItem) => {
  selectedEmoji.value = emoji
  showEditDialog.value = true
}

const handleEmojiDelete = async (emoji: EmojiItem) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除表情包 "${emoji.name}" 吗？`,
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    await send('emojiluna/deleteEmoji', emoji.id)
    ElMessage.success('删除成功')
    refreshData()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to delete emoji:', error)
      ElMessage.error('删除失败')
    }
  }
}

// Selection Logic
const toggleSelectionMode = () => {
    isSelectionMode.value = !isSelectionMode.value
    selectedEmojis.value = []
}

const isSelected = (emoji: EmojiItem) => {
    return selectedEmojis.value.some(e => e.id === emoji.id)
}

const handleEmojiSelect = (emoji: EmojiItem) => {
    const index = selectedEmojis.value.findIndex(e => e.id === emoji.id)
    if (index > -1) {
        selectedEmojis.value.splice(index, 1)
    } else {
        selectedEmojis.value.push(emoji)
    }
}

const handleBatchDelete = async () => {
    if (selectedEmojis.value.length === 0) return

    try {
         await ElMessageBox.confirm(
            `确定要删除选中的 ${selectedEmojis.value.length} 个表情包吗？`,
            '警告',
            {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning',
            }
        )

        const deletePromises = selectedEmojis.value.map(emoji => send('emojiluna/deleteEmoji', emoji.id))
        await Promise.all(deletePromises)

        ElMessage.success(`成功删除 ${selectedEmojis.value.length} 个表情包`)
        selectedEmojis.value = []
        isSelectionMode.value = false
        refreshData()
    } catch (error) {
        if (error !== 'cancel') {
             console.error('Batch delete failed', error)
             ElMessage.error('批量删除失败')
        }
    }
}

const openMoveDialog = () => {
    targetCategory.value = ''
    showMoveDialog.value = true
}

const confirmMove = async () => {
    if (!targetCategory.value) {
        ElMessage.warning('请选择目标分类')
        return
    }

    moving.value = true
    try {
        const movePromises = selectedEmojis.value.map(emoji => {
            return send('emojiluna/updateEmojiCategory', emoji.id, targetCategory.value)
        })

        await Promise.all(movePromises)
        ElMessage.success('移动成功')
        showMoveDialog.value = false
        selectedEmojis.value = []
        isSelectionMode.value = false
        refreshData()
    } catch (error) {
        console.error('Move failed', error)
        ElMessage.error('移动失败')
    } finally {
        moving.value = false
    }
}

const handleImportConfirm = async (emojisToImport: EmojiItem[]) => {
    if (!props.category) return

    loading.value = true
    try {
        const movePromises = emojisToImport.map(emoji => {
             // Assuming updateEmoji exists or we use updateEmojiCategory
             // Actually backend.ts exposes 'emojiluna/updateEmojiCategory' (id, category)
             // Let's use that one, it's safer/faster.
             return send('emojiluna/updateEmojiCategory', emoji.id, props.category!.name)
        })
        await Promise.all(movePromises)
        ElMessage.success(`成功导入 ${emojisToImport.length} 个表情包`)
        refreshData()
    } catch (error) {
        console.error('Import failed', error)
        ElMessage.error('导入失败')
    } finally {
        loading.value = false
    }
}


const handleAddSuccess = () => {
  refreshData()
}

const handleEditSuccess = () => {
  refreshData()
}

const handlePreviewClose = () => {
  showPreviewDialog.value = false
  previewEmoji.value = undefined
}

const handlePreviewImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0zMiAyMEM0Mi40IDIwIDQ0IDMwIDQ0IDMwQzQ0IDMwIDQyLjQgNDAgMzIgNDBDMjEuNiA0MCAyMCAzMCAyMCAzMEMyMCAzMCAyMS42IDIwIDMyIDIwWiIgZmlsbD0iI0NDQ0NDQyIvPgo8L3N2Zz4K'
}

const copyPreviewLink = async () => {
  if (!previewEmojiLink.value) return

  try {
    await navigator.clipboard.writeText(previewEmojiLink.value)
    ElMessage.success('链接已复制到剪贴板')
  } catch (error) {
    // Fallback for browsers that don't support clipboard API
    const textArea = document.createElement('textarea')
    textArea.value = previewEmojiLink.value
    textArea.style.position = 'fixed'
    textArea.style.left = '-9999px'
    textArea.style.top = '-9999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    try {
      document.execCommand('copy')
      ElMessage.success('链接已复制到剪贴板')
    } catch (err) {
      ElMessage.error('复制失败，请手动复制')
    }
    document.body.removeChild(textArea)
  }
}

const handlePreviewEdit = () => {
  if (previewEmoji.value) {
    selectedEmoji.value = previewEmoji.value
    showEditDialog.value = true
    showPreviewDialog.value = false
  }
}

const handleAIAnalyze = async () => {
  if (!previewEmoji.value) return

  aiCategorizingId.value = previewEmoji.value.id

  try {
    const result = await send('emojiluna/analyzeEmoji', previewEmoji.value.id)

    if (result.success) {
      const { updates, newData } = result

      if (updates.length > 0) {
        ElMessage.success(`AI分析完成，已更新：${updates.join(', ')}`)

        if (previewEmoji.value) {
          previewEmoji.value.category = newData.category
          previewEmoji.value.tags = newData.tags
        }

        await refreshData()
      } else {
        ElMessage.info('没有检测到需要更新的内容')
      }
    } else {
      ElMessage.info(result.message || 'AI分析未返回结果')
    }
  } catch (error) {
    console.error('AI分析失败:', error)
    ElMessage.error(`AI分析失败: ${error.message || error}`)
  } finally {
    aiCategorizingId.value = ''
  }
}

// Watchers
watch(
  () => props.category,
  (newCategory) => {
    if (newCategory) {
      currentPage.value = 1
      searchKeyword.value = ''
      isSelectionMode.value = false
      selectedEmojis.value = []
      loadEmojis()
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.category-detail {
  min-height: 100%;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px;
  background: var(--k-color-base);
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-title {
    display: flex;
    flex-direction: column;
}

.title-text {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--k-color-text);
}

.subtitle-text {
    font-size: 12px;
    color: var(--k-text-light);
}

.header-right {
    display: flex;
    gap: 8px;
    align-items: center;
}

.toolbar-container {
  padding: 0 16px 16px 16px;
  display: flex;
  gap: 12px;
  align-items: center;
}

.search-section {
  flex: 1;
  max-width: 400px;
}

.search-input :deep(.el-input__wrapper) {
  border-radius: 20px;
  background-color: var(--k-color-surface-1);
  box-shadow: none !important;
  border: 1px solid transparent;
}

.search-input :deep(.el-input__wrapper:hover),
.search-input :deep(.el-input__wrapper.is-focus) {
    background-color: var(--k-color-surface-2);
}

.actions-section {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-left: auto;
}

.emoji-grid-container {
    padding-bottom: 80px;
    min-height: 200px;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
  align-content: start;
}

.pagination {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}

/* Floating Action Bar */
.floating-action-bar {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--k-color-base);
    border: 1px solid var(--k-color-divider);
    border-radius: 12px;
    padding: 12px 24px;
    display: flex;
    align-items: center;
    gap: 24px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    z-index: 100;
}

.selection-count {
    font-weight: 600;
    color: var(--k-color-text);
}

.selection-actions {
    display: flex;
    gap: 12px;
}

/* Transitions */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translate(-50%, 100%);
  opacity: 0;
}

/* Dialog Styles */
.preview-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.preview-image-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  background: var(--k-color-surface-1);
  border-radius: 6px;
  border: 1px solid var(--k-border-color);
}

.preview-image {
  max-width: 200px;
  max-height: 200px;
  border-radius: 4px;
  object-fit: contain;
}

.preview-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.info-label {
  font-weight: 600;
  color: var(--k-text-normal);
  min-width: 50px;
  flex-shrink: 0;
}

.info-value {
  flex: 1;
  color: var(--k-text-light);
}

.tag-item {
  margin-right: 6px;
  margin-bottom: 4px;
}

.link-input {
  flex: 1;
}

.dialog-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

/* Responsive */
@media (max-width: 768px) {
    .emoji-grid {
        grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
        gap: 8px;
    }
}
</style>
