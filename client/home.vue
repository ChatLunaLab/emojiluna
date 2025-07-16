<template>
  <k-layout>
    <el-scrollbar>
      <div class="emoji-manager">
        <!-- 顶部工具栏 -->
        <div class="toolbar">
          <div class="search-section">
            <el-input
              v-model="searchKeyword"
              :placeholder="t('emojiluna.search')"
              size="large"
              @input="handleSearch"
              @keyup.enter="handleSearch"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
              <template #append>
                <el-button @click="handleSearch">
                  {{ t('emojiluna.searchButton') }}
                </el-button>
              </template>
            </el-input>
          </div>

          <div class="action-section">
            <el-button
              type="primary"
              size="large"
              @click="showAddDialog = true"
            >
              <el-icon><Plus /></el-icon>
              {{ t('emojiluna.addEmoji') }}
            </el-button>
          </div>
        </div>

        <!-- 筛选器 -->
        <div class="filters">
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

          <el-select
            v-if="selectedFilter === 'category'"
            v-model="selectedCategory"
            placeholder="选择分类"
            style="width: 200px"
            @change="loadEmojis"
            clearable
          >
            <el-option
              v-for="category in categories"
              :key="category.name"
              :label="`${category.name} (${category.emojiCount})`"
              :value="category.name"
            />
          </el-select>

          <el-select
            v-if="selectedFilter === 'tag'"
            v-model="selectedTag"
            placeholder="选择标签"
            style="width: 200px"
            @change="loadEmojis"
            clearable
          >
            <el-option
              v-for="tag in allTags"
              :key="tag"
              :label="tag"
              :value="tag"
            />
          </el-select>

          <el-button @click="resetFilters">重置筛选</el-button>
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
          />
        </div>
      </div>
    </el-scrollbar>

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
  </k-layout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { send } from '@koishijs/client'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus } from '@element-plus/icons-vue'
import EmojiCard from './components/EmojiCard.vue'
import EmojiDialog from './components/EmojiDialog.vue'
import AddEmojiDialog from './components/AddEmojiDialog.vue'
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
const baseUrl = computed(() => {
  // 根据实际的后端路径配置调整
  return '/emojiluna'
})

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

      // 获取总数（这里简化处理，实际可能需要单独的计数接口）
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
  // 点击表情包可以复制到剪贴板或其他操作
  navigator.clipboard?.writeText(`[${emoji.name}](${baseUrl.value}/get/${emoji.name})`)
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
      t('emojiluna.confirmDelete'),
      t('common.warning'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      }
    )

    await send('emojiluna/deleteEmoji', emoji.id)
    ElMessage.success(t('emojiluna.deleteSuccess'))
    loadEmojis()
    loadCategories() // 重新加载分类以更新计数
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to delete emoji:', error)
      ElMessage.error(t('emojiluna.deleteFailed'))
    }
  }
}

const handleAddSuccess = () => {
  loadEmojis()
  loadCategories()
  loadTags()
}

const handleEditSuccess = () => {
  loadEmojis()
  loadCategories()
  loadTags()
}

// 初始化
onMounted(async () => {
  await Promise.all([
    loadEmojis(),
    loadCategories(),
    loadTags()
  ])
})
</script>

<style scoped>
.emoji-manager {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.toolbar {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  align-items: center;
}

.search-section {
  flex: 1;
  max-width: 500px;
}

.action-section {
  flex-shrink: 0;
}

.filters {
  display: flex;
  gap: 15px;
  margin-bottom: 30px;
  align-items: center;
  flex-wrap: wrap;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
  min-height: 400px;
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
}

/* 响应式设计 */
@media (max-width: 768px) {
  .emoji-manager {
    padding: 15px;
  }

  .toolbar {
    flex-direction: column;
    gap: 15px;
  }

  .search-section {
    width: 100%;
    max-width: none;
  }

  .filters {
    gap: 10px;
  }

  .emoji-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 15px;
  }
}

@media (max-width: 480px) {
  .emoji-manager {
    padding: 10px;
  }

  .emoji-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 10px;
  }

  .filters {
    flex-direction: column;
    align-items: stretch;
  }

  .filters .el-select {
    width: 100% !important;
  }
}
</style>
