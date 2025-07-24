<template>
  <div class="category-detail">
    <!-- 头部导航 -->
    <div class="header">
      <div class="header-left">
        <el-button
          :icon="ArrowLeft"
          circle
          @click="$emit('back')"
          class="back-button"
          title="返回分类列表"
        />
        <div class="breadcrumb">
          <span class="breadcrumb-item-link" @click="$emit('back')">分类管理</span>
          <span class="breadcrumb-separator">/</span>
          <span class="breadcrumb-current">{{ category?.name }}</span>
        </div>
      </div>
      <div class="header-right">
        <el-button
          type="primary"
          size="large"
          @click="showAddDialog = true"
          class="add-button"
        >
          <el-icon><Plus /></el-icon>
          添加表情包
        </el-button>
      </div>
    </div>

    <!-- 分类信息 -->
    <div class="category-info-bar">
      <div class="info-main">
        <h2 class="category-name">{{ category?.name }}</h2>
        <p v-if="category?.description" class="category-description">
          {{ category.description }}
        </p>
      </div>
      <div class="info-stats">
        <div class="stat-item">
          <span class="stat-value">{{ total }}</span>
          <span class="stat-label">表情包</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ formatDate(category?.createdAt) }}</span>
          <span class="stat-label">创建于</span>
        </div>
      </div>
    </div>

    <!-- 搜索和筛选 -->
    <div class="toolbar">
      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索表情包..."
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
          circle
          size="large"
          class="refresh-action"
          @click="refreshData"
          title="刷新"
        >
          <el-icon><RefreshRight /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- 表情包网格 -->
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
        <el-empty description="该分类下暂无表情包" />
      </div>
    </div>

    <!-- 分页 -->
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

    <!-- 添加表情包对话框 -->
    <AddEmojiDialog
      v-model="showAddDialog"
      @success="handleAddSuccess"
      :default-category="category?.name"
    />

    <!-- 编辑表情包对话框 -->
    <EmojiDialog
      v-model="showEditDialog"
      :emoji="selectedEmoji"
      :base-url="baseUrl"
      @success="handleEditSuccess"
    />

    <!-- 预览对话框 -->
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
  Calendar
} from '@element-plus/icons-vue'
import EmojiCard from './EmojiCard.vue'
import EmojiDialog from './EmojiDialog.vue'
import AddEmojiDialog from './AddEmojiDialog.vue'
import type { EmojiItem, Category } from 'koishi-plugin-emojiluna'

interface Props {
  category: Category | null
}

interface Emits {
  (e: 'back'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 状态管理
const loading = ref(false)
const emojis = ref<EmojiItem[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const searchKeyword = ref('')

const showAddDialog = ref(false)
const showEditDialog = ref(false)
const selectedEmoji = ref<EmojiItem>()
const showPreviewDialog = ref(false)
const previewEmoji = ref<EmojiItem>()
const aiCategorizingId = ref<string>('')

const baseUrl = ref('')

// 计算属性
const previewEmojiUrl = computed(() => {
  if (!previewEmoji.value) return ''
  return `${baseUrl.value}/get/${previewEmoji.value.name}`
})

const previewEmojiLink = computed(() => {
  if (!previewEmoji.value) return ''
  return `${baseUrl.value}/get/${previewEmoji.value.name}`
})

// 数据加载
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
      // 先搜索所有表情包，然后筛选分类
      const allResults = await send('emojiluna/searchEmoji', searchKeyword.value.trim())
      result = allResults?.filter((emoji: EmojiItem) => emoji.category === props.category.name) || []
      emojis.value = result
      total.value = result.length
    } else {
      result = await send('emojiluna/getEmojiList', options)
      emojis.value = result || []
      
      // 获取该分类下的总数
      const allInCategory = await send('emojiluna/getEmojiList', { category: props.category.name })
      total.value = allInCategory?.length || 0
    }
  } catch (error) {
    console.error('Failed to load emojis:', error)
    ElMessage.error('加载表情包失败')
  } finally {
    loading.value = false
  }
}

const loadBaseUrl = async () => {
  try {
    baseUrl.value = await send('emojiluna/getBaseUrl') || '/emojiluna'
  } catch (error) {
    console.error('Failed to load base URL:', error)
  }
}

const refreshData = async () => {
  await Promise.all([
    loadEmojis(),
    loadBaseUrl()
  ])
}

// 工具函数
const formatDate = (date: Date | string | undefined) => {
  if (!date) return ''
  return new Date(date).toLocaleDateString('zh-CN')
}

// 事件处理
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

// 监听分类变化
watch(
  () => props.category,
  (newCategory) => {
    if (newCategory) {
      currentPage.value = 1
      searchKeyword.value = ''
      refreshData()
    }
  },
  { immediate: true }
)

onMounted(() => {
  refreshData()
})
</script>

<style scoped>
.category-detail {
  padding: 0;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px;
  background: var(--k-card-bg);
  border-radius: 6px;
  border: 1px solid var(--k-card-border);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-button {
  border: 1px solid var(--k-card-border);
  background-color: var(--k-card-bg);
}

.back-button:hover {
  background: var(--k-hover-bg);
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.breadcrumb-item-link {
  color: var(--k-text-light);
  cursor: pointer;
  transition: color 0.2s ease-in-out;
}

.breadcrumb-item-link:hover {
  color: var(--k-color-primary);
}

.breadcrumb-separator {
  color: var(--k-text-lighter);
}

.breadcrumb-current {
  color: var(--k-text-dark);
  font-weight: 500;
}

.add-button {
  padding: 12px 24px;
  font-weight: 600;
}

.category-info-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background-color: var(--k-card-bg);
  border: 1px solid var(--k-card-border);
  border-radius: 8px;
  margin-bottom: 20px;
}

.info-main {
  flex: 1;
  padding-right: 20px;
}

.category-name {
  margin: 0;
  color: var(--k-text-dark);
  font-size: 18px;
  font-weight: 600;
}

.category-description {
  margin: 4px 0 0;
  color: var(--k-text-normal);
  font-size: 13px;
  line-height: 1.5;
}

.info-stats {
  display: flex;
  gap: 20px;
  flex-shrink: 0;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--k-text-dark);
  display: block;
}

.stat-label {
  font-size: 12px;
  color: var(--k-text-light);
  margin-top: 2px;
  display: block;
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

.action-section {
  flex-shrink: 0;
  margin-left: auto;
  display: flex;
  gap: 10px;
  align-items: center;
}

.refresh-action:hover {
  background: var(--k-hover-bg);
  color: var(--k-color-primary);
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
  .header {
    flex-direction: column;
    gap: 15px;
    align-items: stretch;
  }

  .header-left {
    justify-content: space-between;
  }

  .toolbar {
    flex-direction: column;
    gap: 15px;
    padding: 15px;
  }

  .search-bar {
    width: 100%;
    max-width: none;
  }

  .info-content {
    flex-direction: column;
    text-align: center;
    gap: 16px;
  }

  .category-stats {
    justify-content: center;
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

  .header-left {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .breadcrumb {
    font-size: 12px;
  }
}
</style>