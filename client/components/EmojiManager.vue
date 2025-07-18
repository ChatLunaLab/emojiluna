<template>
  <div class="emoji-manager">
    <!-- 顶部工具栏 -->
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

    <!-- 筛选器 -->
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
        <el-empty :description="t('emojiluna.noEmojis')" />
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
    />

    <!-- 编辑表情包对话框 -->
    <EmojiDialog
      v-model="showEditDialog"
      :emoji="selectedEmoji"
      :base-url="baseUrl"
      @success="handleEditSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { send } from '@koishijs/client'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, RefreshRight } from '@element-plus/icons-vue'
import EmojiCard from './EmojiCard.vue'
import EmojiDialog from './EmojiDialog.vue'
import AddEmojiDialog from './AddEmojiDialog.vue'
import type { EmojiItem, Category, EmojiSearchOptions } from 'koishi-plugin-emojiluna'

const { t } = useI18n()

// 状态管理
const loading = ref(false)
const emojis = ref<EmojiItem[]>([])
const categories = ref<Category[]>([])
const allTags = ref<string[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

// 搜索和筛选
const searchKeyword = ref('')
const selectedFilter = ref('all')
const selectedCategory = ref('')
const selectedTag = ref('')

// 对话框状态
const showAddDialog = ref(false)
const showEditDialog = ref(false)
const selectedEmoji = ref<EmojiItem>()

// 配置
const baseUrl = ref('')

// 数据加载
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

// 事件处理
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
  const link = `${baseUrl.value}/get/${emoji.name}`
  navigator.clipboard?.writeText(link)
    .then(() => {
      ElMessage.success('表情包链接已复制到剪贴板')
    })
    .catch(() => {
      ElMessage.info('请手动复制表情包链接')
    })
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

// 初始化
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
  padding: 20px;
  background: var(--k-card-bg);
  border-radius: 12px;
  border: 1px solid var(--k-card-border);
  box-shadow: var(--k-card-shadow);
}


.search-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  max-width: 500px;
}

.search-input {
  border-radius: 25px;
  flex: 1;
}

.search-input :deep(.el-input__wrapper) {
  border-radius: 25px;
  background: var(--k-hover-bg);
  box-shadow: var(--k-card-shadow);
}

.search-button {
  border-radius: 25px;
  padding: 12px 24px;
  font-weight: 600;
  box-shadow: var(--k-card-shadow);
  transition: all 0.3s ease;
  margin-left: 0;
}

.search-button:hover {
  transform: translateY(-2px);
}

.refresh-action {
  border-radius: 50%;
  box-shadow: var(--k-card-shadow);
  transition: all 0.3s ease;
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
  border-radius: 25px;
  padding: 12px 24px;
  font-weight: 600;
  box-shadow: var(--k-card-shadow);
  transition: all 0.3s ease;
  color: var(--k-text-dark);
}

.add-button:hover {
  transform: translateY(-2px);
  background: var(--k-hover-bg);
  color: var(--k-color-primary);
}

.filters {
  display: flex;
  gap: 20px;
  margin-bottom: 30px;
  align-items: center;
  flex-wrap: wrap;
  padding: 15px 20px;
  background: var(--k-card-bg);
  border-radius: 8px;
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
  border-radius: 20px;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
  min-height: 400px;
}

.emoji-card-item {
  transition: all 0.3s ease;
  border-radius: 12px;
  overflow: hidden;
}

.emoji-card-item:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
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
