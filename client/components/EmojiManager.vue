<template>
  <div class="emoji-manager">
    <!-- Toolbar -->
    <div class="toolbar-container">
      <div class="toolbar-main">
        <div class="search-section">
          <el-input
            v-model="searchKeyword"
            :placeholder="t('emojiluna.search')"
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
          <el-button
            :type="isSelectionMode ? 'danger' : 'default'"
            circle
            @click="toggleSelectionMode"
            :title="isSelectionMode ? t('common.cancel') : '选择'"
          >
            <el-icon v-if="isSelectionMode"><Close /></el-icon>
            <el-icon v-else><Check /></el-icon>
          </el-button>

          <el-dropdown trigger="click" @command="handleFilterCommand">
             <el-button circle>
               <el-icon><Filter /></el-icon>
             </el-button>
             <template #dropdown>
               <el-dropdown-menu>
                 <el-dropdown-item command="reset">重置筛选</el-dropdown-item>
                 <el-dropdown-item divided disabled>按分类筛选</el-dropdown-item>
                 <el-dropdown-item
                    v-for="cat in categories"
                    :key="cat.name"
                    :command="{ type: 'category', value: cat.name }"
                 >
                   {{ cat.name }}
                 </el-dropdown-item>
               </el-dropdown-menu>
             </template>
          </el-dropdown>

          <el-button
            type="primary"
            circle
            @click="showAddDialog = true"
            v-if="!isSelectionMode"
            :title="t('emojiluna.addEmoji')"
          >
            <el-icon><Plus /></el-icon>
          </el-button>

          <el-button
            circle
            @click="showFolderImportDialog = true"
            v-if="!isSelectionMode"
            :title="t('emojiluna.folderImport.title')"
          >
            <el-icon><FolderAdd /></el-icon>
          </el-button>
        </div>
      </div>

      <!-- Active Filters Display -->
      <div class="active-filters" v-if="selectedCategory || selectedTag">
         <el-tag
            v-if="selectedCategory"
            closable
            @close="clearCategoryFilter"
            type="info"
            size="small"
         >
           分类: {{ selectedCategory }}
         </el-tag>
         <el-tag
            v-if="selectedTag"
            closable
            @close="clearTagFilter"
            type="info"
            size="small"
         >
           标签: {{ selectedTag }}
         </el-tag>
      </div>
    </div>

    <!-- Emoji Grid -->
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
        <el-empty :description="t('emojiluna.noEmojis')" />
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
    />

    <EmojiDialog
      v-model="showEditDialog"
      :emoji="selectedEmoji"
      :base-url="baseUrl"
      @success="handleEditSuccess"
    />

    <FolderImportDialog
      v-model="showFolderImportDialog"
      @success="handleFolderImportSuccess"
    />

    <!-- Move to Category Dialog -->
    <el-dialog
        v-model="showMoveDialog"
        title="移动到分类"
        width="400px"
    >
        <el-select v-model="targetCategory" placeholder="选择目标分类" style="width: 100%">
            <el-option
                v-for="cat in categories"
                :key="cat.name"
                :label="cat.name"
                :value="cat.name"
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
      width="600px"
      @close="handlePreviewClose"
      class="preview-dialog"
      align-center
    >
      <div class="preview-content">
        <div class="preview-layout">
          <div class="preview-image-wrapper">
            <div class="image-box">
               <img
                :src="previewEmojiUrl"
                :alt="previewEmoji?.name"
                class="preview-image"
                @error="handlePreviewImageError"
              />
            </div>
            <div class="image-meta">
              <span class="meta-badge" v-if="previewEmoji?.size">{{ formatSize(previewEmoji.size) }}</span>
              <span class="meta-badge">{{ previewEmoji?.id.slice(0, 8) }}...</span>
            </div>
          </div>

          <div class="preview-details">
            <div class="detail-group">
                <label class="detail-label">名称</label>
                <div class="detail-value text-strong">{{ previewEmoji?.name }}</div>
            </div>

            <div class="detail-group">
                <label class="detail-label">分类</label>
                <div class="detail-value">
                     <el-tag effect="light" round>{{ previewEmoji?.category }}</el-tag>
                </div>
            </div>

            <div class="detail-group" v-if="previewEmoji?.tags?.length">
                <label class="detail-label">标签</label>
                <div class="detail-value tags-wrapper">
                  <el-tag
                    v-for="tag in previewEmoji.tags"
                    :key="tag"
                    size="small"
                    type="info"
                    effect="plain"
                    class="tag-item"
                    round
                  >
                    {{ tag }}
                  </el-tag>
                </div>
            </div>

            <div class="detail-group">
                <label class="detail-label">链接</label>
                <div class="link-box" @click="copyPreviewLink">
                    <span class="link-text">{{ previewEmojiLink }}</span>
                    <el-icon class="copy-icon"><DocumentCopy /></el-icon>
                </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <div class="footer-left">
              <el-button
                type="warning"
                text
                bg
                @click="handleAIAnalyze"
                :loading="aiCategorizingId === previewEmoji?.id"
                :disabled="aiCategorizingId !== ''"
                class="ai-btn"
              >
                <el-icon><MagicStick /></el-icon>
                AI 重新分析
              </el-button>
          </div>
          <div class="footer-right">
              <el-button @click="handlePreviewEdit" round>
                <el-icon><Edit /></el-icon>
                编辑
              </el-button>
              <el-button type="primary" @click="handlePreviewClose" round>关闭</el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { send } from '@koishijs/client'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, RefreshRight, DocumentCopy, Edit, MagicStick, Filter, Delete, FolderOpened, Check, Close, FolderAdd } from '@element-plus/icons-vue'
import EmojiCard from './EmojiCard.vue'
import EmojiDialog from './EmojiDialog.vue'
import AddEmojiDialog from './AddEmojiDialog.vue'
import FolderImportDialog from './FolderImportDialog.vue'
import type { EmojiItem, Category, EmojiSearchOptions } from 'koishi-plugin-emojiluna'

const { t } = useI18n()

// Data State
const loading = ref(false)
const emojis = ref<EmojiItem[]>([])
const categories = ref<Category[]>([])
const allTags = ref<string[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(50) // Increased default page size
const baseUrl = ref('')

// Filter State
const searchKeyword = ref('')
const selectedCategory = ref('')
const selectedTag = ref('')

// UI State
const showAddDialog = ref(false)
const showEditDialog = ref(false)
const showFolderImportDialog = ref(false)
const selectedEmoji = ref<EmojiItem>()
const showPreviewDialog = ref(false)
const previewEmoji = ref<EmojiItem>()
const copyIcon = ref(DocumentCopy)
const aiCategorizingId = ref<string>('')

// Selection Mode State
const isSelectionMode = ref(false)
const selectedEmojis = ref<EmojiItem[]>([])
const showMoveDialog = ref(false)
const targetCategory = ref('')
const moving = ref(false)

const previewEmojiUrl = computed(() => {
  if (!previewEmoji.value) return ''
  return `${baseUrl.value}/get/${previewEmoji.value.name}`
})

const previewEmojiLink = computed(() => {
  if (!previewEmoji.value) return ''
  return `${baseUrl.value}/get/${previewEmoji.value.name}`
})

const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Data Loading
const loadEmojis = async () => {
  loading.value = true
  try {
    const options: EmojiSearchOptions = {
      limit: pageSize.value,
      offset: (currentPage.value - 1) * pageSize.value
    }

    if (selectedCategory.value) {
      options.category = selectedCategory.value
    }

    if (selectedTag.value) {
      options.tags = [selectedTag.value]
    }

    let result
    if (searchKeyword.value.trim()) {
      result = await send('emojiluna/searchEmoji', searchKeyword.value.trim())
      // Client-side filtering for category/tags if search is used (since backend search might be global)
       if (selectedCategory.value) {
            result = result.filter((e: EmojiItem) => e.category === selectedCategory.value)
       }
      emojis.value = result || []
      total.value = emojis.value.length
    } else {
      result = await send('emojiluna/getEmojiList', options)
      emojis.value = result || []

      // Ideally get count from API, but for now reuse logic
      const allEmojis = await send('emojiluna/getEmojiList', {
          category: selectedCategory.value || undefined,
          tags: selectedTag.value ? [selectedTag.value] : undefined
      })
      total.value = allEmojis?.length || 0
    }
  } catch (error) {
    console.error('Failed to load emojis:', error)
    ElMessage.error('加载表情包失败')
  } finally {
    loading.value = false
  }
}

const loadCategories = async () => {
  try {
    categories.value = await send('emojiluna/getCategories') || []
    baseUrl.value = await send('emojiluna/getBaseUrl') || '/emojiluna'
  } catch (error) {
    console.error('Failed to load categories:', error)
  }
}

const loadTags = async () => {
  try {
    allTags.value = await send('emojiluna/getAllTags') || []
  } catch (error) {
    console.error('Failed to load tags:', error)
  }
}

const refreshData = async () => {
  await Promise.all([
    loadEmojis(),
    loadCategories(),
    loadTags()
  ])
}

// Event Handlers
const handleSearch = () => {
  currentPage.value = 1
  loadEmojis()
}

const handleFilterCommand = (command: any) => {
    if (command === 'reset') {
        resetFilters()
    } else if (command.type === 'category') {
        selectedCategory.value = command.value
        loadEmojis()
    }
}

const clearCategoryFilter = () => {
    selectedCategory.value = ''
    loadEmojis()
}

const clearTagFilter = () => {
    selectedTag.value = ''
    loadEmojis()
}

const resetFilters = () => {
  selectedCategory.value = ''
  selectedTag.value = ''
  searchKeyword.value = ''
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

// Selection Mode Logic
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

        // Sequential delete or Parallel?
        // Backend API seems single delete. Use Promise.all
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

const handleAddSuccess = () => {
  refreshData()
}

const handleEditSuccess = () => {
  refreshData()
}

const handleFolderImportSuccess = () => {
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

onMounted(refreshData)
</script>

<style scoped>
.emoji-manager {
  position: relative;
  min-height: 100%;
}

.toolbar-container {
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--k-bg-light); /* fallback */
  background: var(--k-color-base);
  padding: 12px 0;
  margin-bottom: 12px;
  border-bottom: 1px solid transparent;
}

.toolbar-main {
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
  border: 1px solid var(--k-color-divider);
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

.active-filters {
    display: flex;
    gap: 8px;
    margin-top: 8px;
    flex-wrap: wrap;
}

.emoji-grid-container {
    padding-bottom: 80px; /* Space for floating bar */
    min-height: 200px;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
  align-content: start;
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}

/* Floating Action Bar */
.floating-action-bar {
    position: fixed;
    bottom: 40px;
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

/* Preview Dialog Styles */
.preview-dialog :deep(.el-dialog__body) {
    padding-top: 10px;
    padding-bottom: 20px;
}

.preview-layout {
    display: flex;
    gap: 24px;
}

.preview-image-wrapper {
    width: 200px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.image-box {
    width: 100%;
    box-sizing: border-box;
    aspect-ratio: 1;
    background: var(--k-color-surface-1);
    border: 1px solid var(--k-color-divider);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    overflow: hidden;
}

.preview-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    transition: transform 0.3s ease;
}

.image-box:hover .preview-image {
    transform: scale(1.05);
}

.image-meta {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.meta-badge {
    font-size: 12px;
    color: var(--k-text-light);
    background: var(--k-color-surface-2);
    padding: 2px 8px;
    border-radius: 6px;
    font-family: monospace;
}

.preview-details {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding-top: 4px;
}

.detail-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.detail-label {
    font-size: 12px;
    color: var(--k-text-light);
    font-weight: 500;
}

.detail-value {
    font-size: 14px;
    color: var(--k-color-text);
    line-height: 1.5;
}

.text-strong {
    font-weight: 600;
    font-size: 16px;
}

.tags-wrapper {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.tag-item {
    margin: 0 !important;
}

.link-box {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--k-color-surface-2);
    padding: 8px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid transparent;
}

.link-box:hover {
    background: var(--k-color-surface-1);
    border-color: var(--k-color-primary);
}

.link-text {
    font-family: monospace;
    font-size: 12px;
    color: var(--k-text-light);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-right: 12px;
}

.copy-icon {
    color: var(--k-text-light);
}

.link-box:hover .copy-icon {
    color: var(--k-color-primary);
}

.dialog-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
}

.footer-left {
    display: flex;
    gap: 12px;
}

.footer-right {
    display: flex;
    gap: 12px;
}

.ai-btn:hover {
    color: #ec4899;
}

/* Responsive */
@media (max-width: 768px) {
    .emoji-grid {
        grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
        gap: 8px;
    }

    .preview-layout {
        flex-direction: column;
    }

    .preview-image-wrapper {
        width: 100%;
        flex-direction: row;
        align-items: center;
    }

    .image-box {
        width: 120px;
    }
}
</style>
