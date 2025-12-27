<template>
  <div class="categories-manager">
    <!-- Toolbar -->
    <div class="toolbar-container">
      <div class="toolbar-main">
        <div class="search-section">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索分类..."
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
            type="primary"
            circle
            @click="showAddDialog = true"
            :title="t('emojiluna.addCategory')"
          >
            <el-icon><Plus /></el-icon>
          </el-button>
          <el-button
            circle
            @click="refreshData"
            :title="t('common.refresh')"
          >
            <el-icon><RefreshRight /></el-icon>
          </el-button>
        </div>
      </div>
    </div>

    <!-- Categories Grid -->
    <div class="categories-grid-container" v-loading="loading">
      <div v-if="filteredCategories.length > 0" class="categories-grid">
        <div
          v-for="category in filteredCategories"
          :key="category.id"
          class="album-card"
          @click="handleCategoryClick(category)"
        >
          <div class="album-cover">
            <img
                v-if="categoryCovers[category.name]"
                :src="getEmojiUrl(categoryCovers[category.name])"
                class="cover-image"
                loading="lazy"
                @error="(e) => handleImageError(e)"
            />
            <div v-else class="cover-placeholder">
                <el-icon :size="48"><FolderOpened /></el-icon>
            </div>

            <!-- Hover Actions -->
            <div class="album-actions" @click.stop>
                 <el-dropdown trigger="click" @command="(cmd) => handleCommand(cmd, category)">
                    <div class="action-btn">
                        <el-icon><MoreFilled /></el-icon>
                    </div>
                    <template #dropdown>
                        <el-dropdown-menu>
                            <el-dropdown-item command="edit">
                                <el-icon><Edit /></el-icon>编辑
                            </el-dropdown-item>
                            <el-dropdown-item command="delete" class="danger-item" :disabled="category.emojiCount > 0">
                                <el-icon><Delete /></el-icon>删除
                            </el-dropdown-item>
                        </el-dropdown-menu>
                    </template>
                 </el-dropdown>
            </div>
          </div>
          <div class="album-info">
            <div class="album-name" :title="category.name">{{ category.name }}</div>
            <div class="album-count">{{ category.emojiCount }} 项</div>
          </div>
        </div>
      </div>
       <div v-else class="no-data">
        <el-empty description="暂无分类" />
      </div>
    </div>

    <!-- Add/Edit Dialog -->
    <el-dialog
      v-model="showEditDialog"
      :title="editingCategory ? '编辑分类' : '添加分类'"
      width="400px"
      :before-close="handleCloseDialog"
    >
      <el-form
        :model="categoryForm"
        :rules="categoryFormRules"
        ref="categoryFormRef"
        label-width="80px"
      >
        <el-form-item label="名称" prop="name">
          <el-input
            v-model="categoryForm.name"
            placeholder="请输入分类名称"
            maxlength="30"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="描述" prop="description">
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
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { send } from '@koishijs/client'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, RefreshRight, FolderOpened, MoreFilled, Edit, Delete } from '@element-plus/icons-vue'
import type { Category, EmojiItem } from 'koishi-plugin-emojiluna'
import type { FormInstance, FormRules } from 'element-plus'

const emit = defineEmits<{
  (e: 'category-click', category: Category): void
}>()

const { t } = useI18n()

// State
const loading = ref(false)
const saving = ref(false)
const categories = ref<Category[]>([])
const categoryCovers = ref<Record<string, EmojiItem>>({}) // Map category name to cover emoji
const searchKeyword = ref('')
const baseUrl = ref('/emojiluna')

// Dialog State
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

// Computed
const filteredCategories = computed(() => {
  if (!searchKeyword.value.trim()) {
    return categories.value
  }
  const keyword = searchKeyword.value.toLowerCase()
  return categories.value.filter(cat =>
    cat.name.toLowerCase().includes(keyword) ||
    (cat.description && cat.description.toLowerCase().includes(keyword))
  )
})

// Methods
const loadCategories = async () => {
  loading.value = true
  try {
    categories.value = await send('emojiluna/getCategories') || []
    baseUrl.value = await send('emojiluna/getBaseUrl') || '/emojiluna'

    // Load covers
    const promises = categories.value.map(async (cat) => {
        if (cat.emojiCount > 0) {
            const result = await send('emojiluna/getEmojiList', { category: cat.name, limit: 1 })
            if (result && result.length > 0) {
                categoryCovers.value[cat.name] = result[0]
            }
        }
    })
    await Promise.all(promises)

  } catch (error) {
    console.error('Failed to load categories:', error)
    ElMessage.error('加载分类失败')
  } finally {
    loading.value = false
  }
}

const refreshData = () => {
    loadCategories()
}

const handleSearch = () => {
    // Client side filtering is enough for categories usually
}

const getEmojiUrl = (emoji: EmojiItem) => {
    return `${baseUrl.value}/get/${emoji.name}`
}

const handleImageError = (event: Event) => {
    const target = event.target as HTMLElement
    target.style.display = 'none'
    // Show placeholder sibling? CSS handles this via v-if/else logic or we can swap src
    // Simpler: swap src to placeholder if we had one URL, but here we switch to div
    // Actually the img v-if will handle "has cover", but if cover fails to load...
    // Let's just set a transparent pixel or hide it to reveal background
    // For now, simpler error handling in template logic is hard.
    // Let's replace src with svg placeholder
    const img = event.target as HTMLImageElement
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0zMiAyMEM0Mi40IDIwIDQ0IDMwIDQ0IDMwQzQ0IDMwIDQyLjQgNDAgMzIgNDBDMjEuNiA0MCAyMCAzMCAyMCAzMEMyMCAzMCAyMS42IDIwIDMyIDIwWiIgZmlsbD0iI0NDQ0NDQyIvPgo8L3N2Zz4K'
}

const handleCategoryClick = (category: Category) => {
    emit('category-click', category)
}

const handleCommand = (command: string, category: Category) => {
    if (command === 'edit') {
        handleEditCategory(category)
    } else if (command === 'delete') {
        handleDeleteCategory(category)
    }
}

const handleEditCategory = (category: Category) => {
  editingCategory.value = category
  categoryForm.name = category.name
  categoryForm.description = category.description || ''
  showEditDialog.value = true
}

const handleDeleteCategory = async (category: Category) => {
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
        ElMessage.error('删除失败：可能分类不为空')
    }
  }
}

const handleSaveCategory = async () => {
  if (!categoryFormRef.value) return
  await categoryFormRef.value.validate(async (valid) => {
      if (valid) {
        saving.value = true
        try {
            if (editingCategory.value) {
                 // API for update category not seen in backend.ts, assuming strictly add/delete?
                 // Wait, backend.ts has 'addCategory', 'deleteCategory'.
                 // Service.ts has addCategory but no updateCategoryName?
                 // Let's check backend.ts again.
                 // It has 'emojiluna/updateEmojiCategory' for moving emojis.
                 // It does NOT seem to have 'updateCategory' for renaming the category itself.
                 // So editing might be limited or require implementing a new backend method.
                 // For now, I'll show a message.
                 ElMessage.info('重命名分类功能暂未在后端实现')
            } else {
                await send('emojiluna/addCategory', categoryForm.name, categoryForm.description)
                ElMessage.success('添加成功')
                showEditDialog.value = false
                refreshData()
            }
        } catch (error) {
            console.error(error)
            ElMessage.error('保存失败')
        } finally {
            saving.value = false
        }
      }
  })
}

const handleCloseDialog = () => {
    showEditDialog.value = false
    showAddDialog.value = false
    editingCategory.value = null
    categoryForm.name = ''
    categoryForm.description = ''
}

watch(showAddDialog, (val) => {
    if (val) {
        editingCategory.value = null
        categoryForm.name = ''
        categoryForm.description = ''
        showEditDialog.value = true
        showAddDialog.value = false
    }
})

onMounted(() => {
    loadCategories()
})
</script>

<style scoped>
.categories-manager {
  min-height: 100%;
}

.toolbar-container {
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--k-color-base);
  padding: 12px 0;
  margin-bottom: 12px;
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

.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 20px;
  padding-bottom: 40px;
}

.album-card {
  cursor: pointer;
  transition: transform 0.2s;
}

.album-card:hover {
    transform: translateY(-4px);
}

.album-cover {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 12px;
    background-color: var(--k-color-surface-2);
    overflow: hidden;
    position: relative;
    box-shadow: 0 4px 6px rgba(0,0,0,0.05);
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.cover-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.cover-placeholder {
    color: var(--k-text-light);
}

.album-info {
    padding: 0 4px;
}

.album-name {
    font-weight: 600;
    font-size: 15px;
    color: var(--k-color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 2px;
}

.album-count {
    font-size: 13px;
    color: var(--k-text-light);
}

.album-actions {
    position: absolute;
    top: 8px;
    right: 8px;
    opacity: 0;
    transition: opacity 0.2s;
}

.album-card:hover .album-actions {
    opacity: 1;
}

.action-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background-color: rgba(255,255,255,0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    color: var(--k-color-text);
}

.action-btn:hover {
    background-color: white;
    color: var(--k-color-primary);
}

.danger-item {
    color: var(--el-color-danger);
}

.no-data {
    margin-top: 40px;
}
</style>
