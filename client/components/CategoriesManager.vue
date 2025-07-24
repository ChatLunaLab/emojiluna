<template>
  <div class="categories-manager">
    <!-- 分类统计卡片 -->
    <div class="stats-cards">
      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon">
            <el-icon size="24" color="#409EFF">
              <FolderOpened />
            </el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-number">{{ categories.length }}</div>
            <div class="stat-label">分类总数</div>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon">
            <el-icon size="24" color="#67C23A">
              <Picture />
            </el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-number">{{ totalEmojis }}</div>
            <div class="stat-label">表情包总数</div>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon">
            <el-icon size="24" color="#E6A23C">
              <DataAnalysis />
            </el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-number">{{ averageEmojisPerCategory.toFixed(1) }}</div>
            <div class="stat-label">平均每分类表情包数</div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 操作栏 -->
    <div class="action-bar">
      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索分类..."
          size="large"
          class="search-input"
          @keyup.enter="filterCategories"
          clearable
        />
        <el-button
          type="primary"
          size="large"
          class="search-button"
          @click="filterCategories"
        >
          <el-icon><Search /></el-icon>
        </el-button>
      </div>
      <div class="action-buttons">
        <el-button
          type="primary"
          size="large"
          @click="showAddDialog = true"
          class="add-button"
        >
          <el-icon><Plus /></el-icon>
          添加分类
        </el-button>
        <el-button
          circle
          size="large"
          class="refresh-action"
          @click="() => { loadCategories(); loadCategoryEmojis(); }"
          title="刷新"
        >
          <el-icon><RefreshRight /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- 分类列表 -->
    <div class="categories-content" v-loading="loading">
      <div v-if="filteredCategories.length === 0" class="empty-state">
        <el-empty description="暂无分类" />
      </div>

      <div v-else class="categories-grid">
        <div
          v-for="category in paginatedCategories"
          :key="category.id"
          class="category-card"
        >
          <div class="category-header">
            <div class="category-title">
              <h3>{{ category.name }}</h3>
              <el-tag type="info" effect="plain" round>
                {{ category.emojiCount }} 个表情包
              </el-tag>
            </div>
            <div class="category-actions">
              <el-button
                size="small"
                type="primary"
                text
                @click="handleEditCategory(category)"
                :icon="Edit"
              />
              <el-button
                size="small"
                type="danger"
                text
                @click="handleDeleteCategory(category)"
                :disabled="category.emojiCount > 0"
                :icon="Delete"
              />
            </div>
          </div>

          <div class="category-description" v-if="category.description">
            <p>{{ category.description }}</p>
          </div>

          <div class="category-meta">
            <div class="created-date">
              <el-icon size="14"><Calendar /></el-icon>
              <span>创建于: {{ formatDate(category.createdAt) }}</span>
            </div>
          </div>

          <!-- 表情包预览 -->
          <div class="emoji-preview" v-if="categoryEmojis[category.name]?.length > 0">
            <div class="emoji-preview-header">
              <el-icon size="14"><Picture /></el-icon>
              <span>表情包预览</span>
            </div>
            <div class="emoji-preview-grid">
              <div
                v-for="emoji in categoryEmojis[category.name].slice(0, 6)"
                :key="emoji.id"
                class="emoji-preview-item"
              >
                <img
                  :src="`${baseUrl}/get/${emoji.name}`"
                  :alt="emoji.name"
                  :title="emoji.name"
                  class="emoji-preview-img"
                  @error="handleImageError"
                />
              </div>
              <div
                v-if="categoryEmojis[category.name].length > 6"
                class="emoji-preview-more"
              >
                <span>+{{ categoryEmojis[category.name].length - 6 }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div class="pagination-wrapper" v-if="filteredCategories.length > pageSize">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[9, 18, 27, 36]"
          :total="filteredCategories.length"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>

    <!-- 添加/编辑分类对话框 -->
    <el-dialog
      v-model="showEditDialog"
      :title="editingCategory ? '编辑分类' : '添加分类'"
      width="500px"
      :before-close="handleCloseDialog"
    >
      <el-form
        :model="categoryForm"
        :rules="categoryFormRules"
        ref="categoryFormRef"
        label-width="80px"
      >
        <el-form-item label="分类名称" prop="name">
          <el-input
            v-model="categoryForm.name"
            placeholder="请输入分类名称"
            maxlength="30"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="分类描述" prop="description">
          <el-input
            v-model="categoryForm.description"
            placeholder="请输入分类描述（可选）"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="handleCloseDialog">取消</el-button>
          <el-button
            type="primary"
            @click="handleSaveCategory"
            :loading="saving"
          >
            保存
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { send } from '@koishijs/client'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Search,
  Plus,
  Edit,
  Delete,
  FolderOpened,
  Picture,
  DataAnalysis,
  Calendar
} from '@element-plus/icons-vue'
import type { Category, EmojiItem } from 'koishi-plugin-emojiluna'
import type { FormInstance, FormRules } from 'element-plus'

// 状态管理
const loading = ref(false)
const saving = ref(false)
const categories = ref<Category[]>([])
const categoryEmojis = ref<Record<string, EmojiItem[]>>({})
const searchKeyword = ref('')
const currentPage = ref(1)
const pageSize = ref(9)

// 对话框状态
const showAddDialog = ref(false)
const showEditDialog = ref(false)
const editingCategory = ref<Category | null>(null)
const categoryFormRef = ref<FormInstance>()

const categoryForm = reactive({
  name: '',
  description: ''
})

const categoryFormRules: FormRules = {
  name: [
    { required: true, message: '请输入分类名称', trigger: 'blur' },
    { min: 1, max: 30, message: '分类名称长度在 1 到 30 个字符', trigger: 'blur' }
  ],
  description: [
    { max: 200, message: '分类描述不能超过 200 个字符', trigger: 'blur' }
  ]
}

// 配置
const baseUrl = computed(() => '/emojiluna')

// 计算属性
const totalEmojis = computed(() => {
  return categories.value.reduce((sum, category) => sum + category.emojiCount, 0)
})

const averageEmojisPerCategory = computed(() => {
  return categories.value.length > 0 ? totalEmojis.value / categories.value.length : 0
})

const filteredCategories = computed(() => {
  if (!searchKeyword.value.trim()) {
    return categories.value
  }
  return categories.value.filter(category =>
    category.name.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
    (category.description && category.description.toLowerCase().includes(searchKeyword.value.toLowerCase()))
  )
})

const paginatedCategories = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredCategories.value.slice(start, end)
})

// 数据加载
const loadCategories = async () => {
  loading.value = true
  try {
    categories.value = await send('emojiluna/getCategories') || []
  } catch (error) {
    console.error('Failed to load categories:', error)
    ElMessage.error('加载分类失败')
  } finally {
    loading.value = false
  }
}

const loadCategoryEmojis = async () => {
  try {
    const promises = categories.value.map(async category => {
      const emojis = await send('emojiluna/getEmojiList', { category: category.name })
      return { categoryName: category.name, emojis: emojis || [] }
    })

    const results = await Promise.all(promises)
    const emojiMap: Record<string, EmojiItem[]> = {}

    results.forEach(result => {
      emojiMap[result.categoryName] = result.emojis
    })

    categoryEmojis.value = emojiMap
  } catch (error) {
    console.error('Failed to load category emojis:', error)
  }
}

// 工具函数
const formatDate = (date: Date | string) => {
  return new Date(date).toLocaleDateString('zh-CN')
}

const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0zMiAyMEM0Mi40IDIwIDQ0IDMwIDQ0IDMwQzQ0IDMwIDQyLjQgNDAgMzIgNDBDMjEuNiA0MCAyMCAzMCAyMCAzMEMyMCAzMCAyMS42IDIwIDMyIDIwWiIgZmlsbD0iI0NDQ0NDQyIvPgo8L3N2Zz4K'
}

// 事件处理
const filterCategories = () => {
  currentPage.value = 1
}

const handleSizeChange = (newSize: number) => {
  pageSize.value = newSize
  currentPage.value = 1
}

const handleCurrentChange = (newPage: number) => {
  currentPage.value = newPage
}

const handleEditCategory = (category: Category) => {
  editingCategory.value = category
  categoryForm.name = category.name
  categoryForm.description = category.description || ''
  showEditDialog.value = true
}

const handleDeleteCategory = async (category: Category) => {
  if (category.emojiCount > 0) {
    ElMessage.warning('该分类下还有表情包，无法删除')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除分类 "${category.name}" 吗？`,
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    await send('emojiluna/deleteCategory', category.id)
    ElMessage.success('分类删除成功')
    loadCategories()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to delete category:', error)
      ElMessage.error('删除分类失败')
    }
  }
}

const handleSaveCategory = async () => {
  if (!categoryFormRef.value) return

  try {
    await categoryFormRef.value.validate()
  } catch {
    return
  }

  saving.value = true
  try {
    if (editingCategory.value) {
      ElMessage.info('编辑分类功能暂未实现')
    } else {
      await send('emojiluna/addCategory', categoryForm.name, categoryForm.description)
      ElMessage.success('分类添加成功')
    }

    handleCloseDialog()
    loadCategories()
  } catch (error) {
    console.error('Failed to save category:', error)
    ElMessage.error('保存分类失败')
  } finally {
    saving.value = false
  }
}

const handleCloseDialog = () => {
  showEditDialog.value = false
  showAddDialog.value = false
  editingCategory.value = null
  categoryForm.name = ''
  categoryForm.description = ''
  categoryFormRef.value?.resetFields()
}

// 监听添加对话框
import { watch } from 'vue'
watch(showAddDialog, (newValue) => {
  if (newValue) {
    editingCategory.value = null
    categoryForm.name = ''
    categoryForm.description = ''
    showEditDialog.value = true
    showAddDialog.value = false
  }
})

// 初始化
onMounted(async () => {
  await loadCategories()
  await loadCategoryEmojis()
})
</script>

<style scoped>
.categories-manager {
  padding: 0;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  border: 1px solid var(--k-card-border);
  border-radius: 6px;
  background: var(--k-card-bg);
}

.stat-card:hover {
  border-color: var(--k-color-primary);
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 6px;
  background: var(--k-hover-bg);
}

.stat-info {
  flex: 1;
}

.stat-number {
  font-size: 20px;
  font-weight: 600;
  color: var(--k-text-dark);
  margin-bottom: 2px;
}

.stat-label {
  font-size: 13px;
  color: var(--k-text-light);
}

.action-bar {
  display: flex;
  gap: 20px;
  margin-bottom: 24px;
  align-items: center;
}


.search-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  max-width: 400px;
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

.action-buttons {
  display: flex;
  gap: 12px;
  margin-left: auto;
}

.add-button {
  padding: 12px 24px;
  font-weight: 600;
}

.add-button:hover {
  background: var(--k-hover-bg);
  color: var(--k-color-primary);
}

.refresh-action {
}

.refresh-action:hover {
  background: var(--k-hover-bg);
  color: var(--k-color-primary);
}

.categories-content {
  min-height: 400px;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.category-card {
  border: 1px solid var(--k-card-border);
  border-radius: 6px;
  padding: 20px;
  background: var(--k-card-bg);
}

.category-card:hover {
  border-color: var(--k-color-primary);
}

.category-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.category-title {
  flex: 1;
}

.category-title h3 {
  margin: 0 0 8px 0;
  color: var(--k-text-dark);
  font-size: 18px;
  font-weight: 600;
}

.category-actions {
  display: flex;
  gap: 8px;
}

.category-description {
  margin-bottom: 16px;
  color: var(--k-text-normal);
  font-size: 14px;
  line-height: 1.6;
}

.category-description p {
  margin: 0;
}

.category-meta {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f2f5;
}

.created-date {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--k-text-light);
}

.emoji-preview {
  margin-top: 16px;
}

.emoji-preview-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 14px;
  color: var(--k-text-normal);
  font-weight: 500;
}

.emoji-preview-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  max-width: 200px;
}

.emoji-preview-item {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--k-border-color);
}

.emoji-preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.emoji-preview-more {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 4px;
  background: var(--k-color-surface-1);
  border: 1px solid var(--k-border-color);
  font-size: 12px;
  color: var(--k-text-light);
  font-weight: 500;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}

.dialog-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .categories-manager {
    padding: 0;
  }

  .stats-cards {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .action-bar {
    flex-direction: column;
    gap: 16px;
  }

  .search-section {
    max-width: none;
    width: 100%;
  }

  .action-buttons {
    width: 100%;
  }

  .action-buttons .el-button {
    flex: 1;
  }

  .categories-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .category-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .category-actions {
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .category-card {
    padding: 16px;
  }

  .stat-content {
    gap: 12px;
  }

  .stat-icon {
    width: 40px;
    height: 40px;
  }

  .stat-number {
    font-size: 20px;
  }

  .emoji-preview-grid {
    max-width: none;
    justify-content: center;
  }
}
</style>
