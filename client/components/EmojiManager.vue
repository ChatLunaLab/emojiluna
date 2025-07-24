<template>
  <div class="emoji-manager">
    <div class="toolbar">
      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          :placeholder="t('emojiluna.search')"
          size="large"
          class="search-input"
          @keyup.enter="handleSearch"
          clearable
        />
        <el-button
          type="primary"
          size="large"
          class="search-button"
          @click="handleSearch"
        >
          <el-icon><Search /></el-icon>
        </el-button>
      </div>
      <div class="action-section">
        <el-button
          type="primary"
          size="large"
          @click="showAddDialog = true"
          class="add-button"
        >
          <el-icon><Plus /></el-icon>
          {{ t('emojiluna.addEmoji') }}
        </el-button>
        <el-button
          circle
          size="large"
          class="refresh-action"
          @click="refreshData"
          :title="t('common.refresh')"
        >
          <el-icon><RefreshRight /></el-icon>
        </el-button>
      </div>
    </div>

    <div class="filters">
      <div class="filter-group">
        <el-text class="filter-label">筛选方式：</el-text>
        <el-select
          v-model="selectedFilter"
          placeholder="筛选方式"
          style="width: 150px"
          @change="handleFilterChange"
        >
          <el-option :label="t('emojiluna.filter.all')" value="all" />
          <el-option :label="t('emojiluna.filter.byCategory')" value="category" />
          <el-option :label="t('emojiluna.filter.byTag')" value="tag" />
        </el-select>
      </div>

      <div class="filter-group" v-if="selectedFilter === 'category'">
        <el-text class="filter-label">分类：</el-text>
        <el-select
          v-model="selectedCategory"
          placeholder="选择分类"
          style="width: 200px"
          @change="handleFilterApply"
          clearable
        >
          <el-option
            v-for="category in categories"
            :key="category.name"
            :label="`${category.name} (${category.emojiCount})`"
            :value="category.name"
          />
        </el-select>
      </div>

      <div class="filter-group" v-if="selectedFilter === 'tag'">
        <el-text class="filter-label">标签：</el-text>
        <el-select
          v-model="selectedTag"
          placeholder="选择标签"
          style="width: 200px"
          @change="handleFilterApply"
          clearable
        >
          <el-option
            v-for="tag in allTags"
            :key="tag"
            :label="tag"
            :value="tag"
          />
        </el-select>
      </div>

      <el-button @click="resetFilters" class="reset-button">
        <el-icon><RefreshRight /></el-icon>
        重置筛选
      </el-button>
    </div>

    <div class="emoji-grid" v-loading="loading">
      <template v-if="emojis.length > 0">
        <EmojiCard
          v-for="emoji in emojis"
          :key="emoji.id"
          :emoji="emoji"
          :base-url="baseUrl"
          @click="handleEmojiClick"
          @edit="handleEmojiEdit"
          @delete="handleEmojiDelete"
          class="emoji-card-item"
        />
      </template>
      <div v-else class="no-emojis">
        <el-empty :description="t('emojiluna.noEmojis')" />
      </div>
    </div>

    <div class="pagination" v-if="total > pageSize">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[20, 40, 60, 100]"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
        background
      />
    </div>

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
                <el-button @click="copyPreviewLink" :icon="copyIcon">
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
import { useI18n } from 'vue-i18n'
import { send } from '@koishijs/client'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, RefreshRight, DocumentCopy, Edit, MagicStick } from '@element-plus/icons-vue'
import EmojiCard from './EmojiCard.vue'
import EmojiDialog from './EmojiDialog.vue'
import AddEmojiDialog from './AddEmojiDialog.vue'
import type { EmojiItem, Category, EmojiSearchOptions } from 'koishi-plugin-emojiluna'

const { t } = useI18n()

const loading = ref(false)
const emojis = ref<EmojiItem[]>([])
const categories = ref<Category[]>([])
const allTags = ref<string[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

const searchKeyword = ref('')
const selectedFilter = ref('all')
const selectedCategory = ref('')
const selectedTag = ref('')

const showAddDialog = ref(false)
const showEditDialog = ref(false)
const selectedEmoji = ref<EmojiItem>()
const showPreviewDialog = ref(false)
const previewEmoji = ref<EmojiItem>()
const copyIcon = ref(DocumentCopy)
const aiCategorizingId = ref<string>('')

const baseUrl = ref('')

const previewEmojiUrl = computed(() => {
  if (!previewEmoji.value) return ''
  return `${baseUrl.value}/get/${previewEmoji.value.name}`
})

const previewEmojiLink = computed(() => {
  if (!previewEmoji.value) return ''
  return `${baseUrl.value}/get/${previewEmoji.value.name}`
})

const loadEmojis = async () => {
  loading.value = true
  try {
    const options: EmojiSearchOptions = {
      limit: pageSize.value,
      offset: (currentPage.value - 1) * pageSize.value
    }

    if (selectedFilter.value === 'category' && selectedCategory.value) {
      options.category = selectedCategory.value
    }

    if (selectedFilter.value === 'tag' && selectedTag.value) {
      options.tags = [selectedTag.value]
    }

    let result
    if (searchKeyword.value.trim()) {
      result = await send('emojiluna/searchEmoji', searchKeyword.value.trim())
      emojis.value = result || []
      total.value = emojis.value.length
    } else {
      result = await send('emojiluna/getEmojiList', options)
      emojis.value = result || []

      const allEmojis = await send('emojiluna/getEmojiList', {})
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

const handleSearch = () => {
  currentPage.value = 1
  loadEmojis()
}

const handleFilterChange = () => {
  selectedCategory.value = ''
  selectedTag.value = ''
  currentPage.value = 1
  loadEmojis()
}

const handleFilterApply = () => {
  currentPage.value = 1
  loadEmojis()
}

const resetFilters = () => {
  selectedFilter.value = 'all'
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
    ElMessage.info('请手动复制链接')
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

        // 更新局部状态
        if (previewEmoji.value) {
          previewEmoji.value.category = newData.category
          previewEmoji.value.tags = newData.tags
        }

        // 刷新数据
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
  padding: 0;
}

.toolbar {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  align-items: center;
  padding: 16px;
  background: var(--k-card-bg);
  border-radius: 6px;
  border: 1px solid var(--k-card-border);
}


.search-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  max-width: 500px;
}

.search-input {
  flex: 1;
}

.search-input :deep(.el-input__wrapper) {
  background: var(--k-hover-bg);
}

.search-button {
  padding: 12px 24px;
  font-weight: 600;
  margin-left: 0;
}

.search-button:hover {
  background: var(--k-hover-bg);
}

.refresh-action {
  margin-left: auto;
}

.refresh-action:hover {
  background: var(--k-hover-bg);
  color: var(--k-color-primary);
}

.action-section {
  flex-shrink: 0;
  margin-left: auto;
  display: flex;
  gap: 10px;
  align-items: center;
}

.add-button {
  padding: 12px 24px;
  font-weight: 600;
}

.add-button:hover {
  background: var(--k-hover-bg);
  color: var(--k-color-primary);
}

.filters {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  align-items: center;
  flex-wrap: wrap;
  padding: 12px 16px;
  background: var(--k-card-bg);
  border-radius: 4px;
  border: 1px solid var(--k-card-border);
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label {
  font-weight: 500;
  color: var(--k-text-normal);
  white-space: nowrap;
}

.reset-button {
  margin-left: auto;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
  min-height: 400px;
}

.emoji-card-item {
  border-radius: 6px;
  overflow: hidden;
}

.emoji-card-item:hover {
  opacity: 0.8;
}

.no-emojis {
  grid-column: 1 / -1;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.pagination {
  display: flex;
  justify-content: center;
  padding: 20px;
}

/* 预览对话框样式 */
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

/* 响应式设计 */
@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    gap: 15px;
    padding: 15px;
  }

  .search-section {
    width: 100%;
    max-width: none;
  }

  .filters {
    gap: 10px;
    padding: 10px 15px;
  }

  .filter-group {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .emoji-grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 15px;
  }
}

@media (max-width: 480px) {
  .emoji-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 10px;
  }

  .filters {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-group {
    width: 100%;
  }

  .filter-group .el-select {
    width: 100% !important;
  }
}
</style>
