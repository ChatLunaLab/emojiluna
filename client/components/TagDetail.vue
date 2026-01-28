<template>
  <div class="tag-detail">
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
          <h2 class="title-text">#{{ tagName }}</h2>
          <span class="subtitle-text">{{ total }} 项</span>
        </div>
      </div>
      <div class="header-right">
        <el-button
          :type="isSelectionMode ? 'primary' : 'default'"
          text
          @click="toggleSelectionMode"
        >
          {{ isSelectionMode ? t('common.cancel') : '选择' }}
        </el-button>

        <template v-if="!isSelectionMode">
             <el-button @click="showImportDialog = true">
                <el-icon><Plus /></el-icon>
                添加表情包
             </el-button>
        </template>
      </div>
    </div>

    <!-- Search Bar -->
    <div class="toolbar-container">
        <div class="search-section">
             <el-input
                v-model="searchKeyword"
                placeholder="搜索此标签下的表情包..."
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
    <div
        class="emoji-grid-container"
        v-loading="loading"
        ref="containerRef"
        @mousedown="handleMouseDown"
    >
      <div
          v-if="isDragSelecting"
          class="selection-box"
          :style="{
              left: selectionBox.left + 'px',
              top: selectionBox.top + 'px',
              width: selectionBox.width + 'px',
              height: selectionBox.height + 'px'
          }"
      ></div>
      <template v-if="emojis.length > 0">
        <div class="emoji-grid">
            <EmojiCard
              v-for="emoji in emojis"
              :key="emoji.id"
              :ref="(el) => setItemRef(el, emoji.id)"
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
        <el-empty description="该标签下暂无表情包" />
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
        small
      />
    </div>

    <!-- Floating Action Bar -->
    <Transition name="slide-up">
      <div class="floating-action-bar" v-if="isSelectionMode && selectedEmojis.length > 0">
        <div class="selection-count">
            已选择 {{ selectedEmojis.length }} 项
        </div>
        <div class="selection-actions">
            <el-button type="danger" text bg @click="handleBatchRemoveTag">
                <el-icon><Remove /></el-icon>
                移除标签
            </el-button>
             <el-button type="danger" text bg @click="handleBatchDelete">
                <el-icon><Delete /></el-icon>
                删除
            </el-button>
        </div>
      </div>
    </Transition>


    <!-- Dialogs -->
    <EmojiDialog
      v-model="showEditDialog"
      :emoji="selectedEmoji"
      :base-url="baseUrl"
      @success="handleEditSuccess"
    />

    <ImageSelector
        v-model="showImportDialog"
        title="添加表情包到当前标签"
        @confirm="handleImportConfirm"
    />

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
            <!-- ... same as CategoryDetail ... -->
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
        </div>
      </div>

      <template #footer>
        <span class="dialog-footer">
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
  Edit,
  Delete,
  Remove
} from '@element-plus/icons-vue'
import EmojiCard from './EmojiCard.vue'
import EmojiDialog from './EmojiDialog.vue'
import ImageSelector from './ImageSelector.vue'
import type { EmojiItem } from 'koishi-plugin-emojiluna'
import { useDragSelect } from '../composables/useDragSelect'

const { t } = useI18n()

interface Props {
  tagName: string
}

interface Emits {
  (e: 'back'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// State
const loading = ref(false)
const emojis = ref<EmojiItem[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(50)
const searchKeyword = ref('')
const baseUrl = ref('')

// UI
const showEditDialog = ref(false)
const showImportDialog = ref(false)
const selectedEmoji = ref<EmojiItem>()
const showPreviewDialog = ref(false)
const previewEmoji = ref<EmojiItem>()

// Selection
const isSelectionMode = ref(false)
const selectedEmojis = ref<EmojiItem[]>([])
const processing = ref(false)

// Drag Select
const containerRef = ref<HTMLElement>()
const itemRefs = new Map<string, HTMLElement>()
const setItemRef = (el: any, id: string) => {
    if (el && el.$el) {
        itemRefs.set(id, el.$el)
    } else if (el) {
        itemRefs.set(id, el)
    } else {
        itemRefs.delete(id)
    }
}

const { isDragSelecting, selectionBox, handleMouseDown } = useDragSelect(
    containerRef,
    emojis,
    (item) => itemRefs.get(item.id),
    'id',
    selectedEmojis,
    () => { isSelectionMode.value = true },
    () => { isSelectionMode.value = false }
)

const previewEmojiUrl = computed(() => {
  if (!previewEmoji.value) return ''
  return `${baseUrl.value}/get/${previewEmoji.value.name}`
})

const loadEmojis = async () => {
  if (!props.tagName) return

  loading.value = true
  try {
    const options = {
      tags: [props.tagName],
      limit: pageSize.value,
      offset: (currentPage.value - 1) * pageSize.value
    }

    let result
    if (searchKeyword.value.trim()) {
      const allResults = await send('emojiluna/searchEmoji', searchKeyword.value.trim())
      result = allResults?.filter((emoji: EmojiItem) => emoji.tags.includes(props.tagName)) || []
      emojis.value = result
      total.value = result.length
    } else {
      result = await send('emojiluna/getEmojiList', options)
      emojis.value = result || []

      const allInTag = await send('emojiluna/getEmojiList', { tags: [props.tagName] })
      total.value = allInTag?.length || 0
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

// Handlers
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
    // Standard delete
    try {
        await ElMessageBox.confirm(
            `确定要删除表情包 "${emoji.name}" 吗？`,
            '警告',
            { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
        )
        await send('emojiluna/deleteEmoji', emoji.id)
        ElMessage.success('删除成功')
        refreshData()
    } catch (e) {}
}

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
            { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
        )
        await Promise.all(selectedEmojis.value.map(e => send('emojiluna/deleteEmoji', e.id)))
        ElMessage.success('删除成功')
        selectedEmojis.value = []
        isSelectionMode.value = false
        refreshData()
    } catch (e) {}
}

const handleBatchRemoveTag = async () => {
    if (selectedEmojis.value.length === 0) return
    try {
        await ElMessageBox.confirm(
            `确定要从选中的 ${selectedEmojis.value.length} 个表情包中移除标签 #${props.tagName} 吗？`,
            '提示',
            { confirmButtonText: '确定', cancelButtonText: '取消', type: 'info' }
        )
        processing.value = true
        await Promise.all(selectedEmojis.value.map(e => {
            const newTags = e.tags.filter(t => t !== props.tagName)
            return send('emojiluna/updateEmojiTags', e.id, newTags)
        }))
        ElMessage.success('标签已移除')
        selectedEmojis.value = []
        isSelectionMode.value = false
        refreshData()
    } catch (e) {
        console.error(e)
    } finally {
        processing.value = false
    }
}

const handleImportConfirm = async (emojisToImport: EmojiItem[]) => {
    loading.value = true
    try {
        await Promise.all(emojisToImport.map(e => {
            if (e.tags.includes(props.tagName)) return Promise.resolve()
            const newTags = [...e.tags, props.tagName]
            return send('emojiluna/updateEmojiTags', e.id, newTags)
        }))
        ElMessage.success(`成功添加 ${emojisToImport.length} 个表情包到标签`)
        refreshData()
    } catch (e) {
        console.error(e)
        ElMessage.error('添加失败')
    } finally {
        loading.value = false
    }
}

const handleEditSuccess = () => refreshData()

const handlePreviewClose = () => {
    showPreviewDialog.value = false
    previewEmoji.value = undefined
}
const handlePreviewEdit = () => {
    if (previewEmoji.value) {
        selectedEmoji.value = previewEmoji.value
        showEditDialog.value = true
        showPreviewDialog.value = false
    }
}
const handlePreviewImageError = (e: Event) => {
    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0zMiAyMEM0Mi40IDIwIDQ0IDMwIDQ0IDMwQzQ0IDMwIDQyLjQgNDAgMzIgNDBDMjEuNiA0MCAyMCAzMCAyMCAzMEMyMCAzMCAyMS42IDIwIDMyIDIwWiIgZmlsbD0iI0NDQ0NDQyIvPgo8L3N2Zz4K'
}

watch(() => props.tagName, (val) => {
    if (val) {
        currentPage.value = 1
        searchKeyword.value = ''
        selectedEmojis.value = []
        loadEmojis()
    }
}, { immediate: true })

onMounted(() => loadEmojis())

</script>

<style scoped>
.tag-detail {
  min-height: 100%;
}
/* Reused styles from CategoryDetail - could be shared but keeping inline for now */
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
.floating-action-bar {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--k-color-surface-1);
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
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translate(-50%, 100%);
  opacity: 0;
}
/* Preview Dialog */
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
.dialog-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
@media (max-width: 768px) {
    .emoji-grid {
        grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
        gap: 8px;
    }
}

.emoji-grid-container {
    position: relative;
    user-select: none;
}

.selection-box {
    position: absolute;
    background-color: rgba(64, 158, 255, 0.2);
    border: 1px solid rgba(64, 158, 255, 0.6);
    z-index: 1000;
    pointer-events: none;
}
</style>
