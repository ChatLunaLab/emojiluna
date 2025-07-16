<template>
    <k-layout>
        <el-scrollbar>
            <div class="categories-manager">
                <div class="header">
                    <h1>{{ t('emojiluna.categories.title') }}</h1>
                    <el-button type="primary" @click="showAddDialog = true">
                        <el-icon>
                            <Plus />
                        </el-icon>
                        {{ t('emojiluna.categories.add') }}
                    </el-button>
                </div>

                <div class="content">
                    <!-- 分类统计 -->
                    <div class="stats-section">
                        <el-card>
                            <div class="stats">
                                <div class="stat-item">
                                    <div class="stat-number">{{ categories.length }}</div>
                                    <div class="stat-label">分类总数</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-number">{{ totalEmojis }}</div>
                                    <div class="stat-label">表情包总数</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-number">{{ averageEmojisPerCategory.toFixed(1) }}</div>
                                    <div class="stat-label">平均每分类表情包数</div>
                                </div>
                            </div>
                        </el-card>
                    </div>

                    <!-- 分类列表 -->
                    <el-card class="categories-section">
                        <template #header>
                            <div class="section-header">
                                <span>分类列表</span>
                                <div class="search-box">
                                    <el-input v-model="searchKeyword" placeholder="搜索分类..." size="small"
                                        style="width: 200px" @input="filterCategories">
                                        <template #prefix>
                                            <el-icon>
                                                <Search />
                                            </el-icon>
                                        </template>
                                    </el-input>
                                </div>
                            </div>
                        </template>

                        <div v-loading="loading">
                            <div v-if="filteredCategories.length === 0" class="no-categories">
                                <el-empty description="暂无分类" />
                            </div>

                            <div v-else class="categories-grid">
                                <div v-for="category in paginatedCategories" :key="category.id" class="category-card">
                                    <div class="category-header">
                                        <div class="category-title">
                                            <h3>{{ category.name }}</h3>
                                            <el-tag type="info">{{ category.emojiCount }} 个表情包</el-tag>
                                        </div>
                                        <div class="category-actions">
                                            <el-button size="small" @click="handleEditCategory(category)" circle>
                                                <el-icon>
                                                    <Edit />
                                                </el-icon>
                                            </el-button>
                                            <el-button size="small" type="danger"
                                                @click="handleDeleteCategory(category)" circle
                                                :disabled="category.emojiCount > 0">
                                                <el-icon>
                                                    <Delete />
                                                </el-icon>
                                            </el-button>
                                        </div>
                                    </div>

                                    <div class="category-info">
                                        <div class="description" v-if="category.description">
                                            {{ category.description }}
                                        </div>
                                        <div class="meta-info">
                                            <div class="created-date">
                                                创建于: {{ formatDate(category.createdAt) }}
                                            </div>
                                        </div>

                                        <!-- 显示该分类下的表情包预览 -->
                                        <div class="emoji-preview" v-if="categoryEmojis[category.name]?.length > 0">
                                            <div class="emoji-preview-header">表情包预览</div>
                                            <div class="emoji-preview-list">
                                                <img v-for="emoji in categoryEmojis[category.name].slice(0, 6)"
                                                    :key="emoji.id" :src="`${baseUrl}/get/${emoji.name}`"
                                                    :alt="emoji.name" :title="emoji.name" class="emoji-preview-img"
                                                    @error="handleImageError" />
                                                <div v-if="categoryEmojis[category.name].length > 6"
                                                    class="emoji-preview-more">
                                                    +{{ categoryEmojis[category.name].length - 6 }}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- 分页 -->
                            <div class="pagination" v-if="filteredCategories.length > pageSize">
                                <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize"
                                    :page-sizes="[9, 18, 36]" :total="filteredCategories.length"
                                    layout="total, sizes, prev, pager, next" @size-change="handleSizeChange"
                                    @current-change="handleCurrentChange" />
                            </div>
                        </div>
                    </el-card>
                </div>
            </div>
        </el-scrollbar>

        <!-- 添加/编辑分类对话框 -->
        <el-dialog v-model="showEditDialog"
            :title="editingCategory ? t('emojiluna.categories.edit') : t('emojiluna.categories.add')" width="500px">
            <el-form :model="categoryForm" label-width="80px">
                <el-form-item :label="t('emojiluna.categories.name')" required>
                    <el-input v-model="categoryForm.name" :placeholder="t('emojiluna.categories.name')" />
                </el-form-item>

                <el-form-item :label="t('emojiluna.categories.description')">
                    <el-input v-model="categoryForm.description" :placeholder="t('emojiluna.categories.description')"
                        type="textarea" :rows="3" />
                </el-form-item>
            </el-form>

            <template #footer>
                <span class="dialog-footer">
                    <el-button @click="handleCloseDialog">{{ t('common.cancel') }}</el-button>
                    <el-button type="primary" @click="handleSaveCategory" :loading="saving">
                        {{ t('common.save') }}
                    </el-button>
                </span>
            </template>
        </el-dialog>
    </k-layout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { send } from '@koishijs/client'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, Edit, Delete } from '@element-plus/icons-vue'
import type { Category, EmojiItem } from 'koishi-plugin-emojiluna'

const { t } = useI18n()

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

const categoryForm = reactive({
    name: '',
    description: ''
})

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
        // 为每个分类加载表情包
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
const formatDate = (date: Date) => {
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
            t('common.warning'),
            {
                confirmButtonText: t('common.confirm'),
                cancelButtonText: t('common.cancel'),
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
    if (!categoryForm.name.trim()) {
        ElMessage.warning('请输入分类名称')
        return
    }

    saving.value = true
    try {
        if (editingCategory.value) {
            // 编辑分类 - 需要后端支持分类更新接口
            ElMessage.info('编辑分类功能暂未实现')
        } else {
            // 新增分类
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
}

// 监听添加对话框
const handleShowAddDialog = () => {
    editingCategory.value = null
    categoryForm.name = ''
    categoryForm.description = ''
    showEditDialog.value = true
}

// 初始化
onMounted(async () => {
    await loadCategories()
    await loadCategoryEmojis()
})

// 监听 showAddDialog 变化
import { watch } from 'vue'
watch(showAddDialog, (newValue) => {
    if (newValue) {
        handleShowAddDialog()
        showAddDialog.value = false
    }
})
</script>

<style scoped>
.categories-manager {
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
}

.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
}

.header h1 {
    margin: 0;
    color: var(--k-color-text-1);
}

.content {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.stats-section .stats {
    display: flex;
    justify-content: space-around;
    text-align: center;
}

.stat-item {
    flex: 1;
}

.stat-number {
    font-size: 2.5em;
    font-weight: bold;
    color: var(--k-color-primary);
    margin-bottom: 8px;
}

.stat-label {
    font-size: 0.9em;
    color: var(--k-color-text-2);
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.categories-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 20px;
    margin-bottom: 20px;
}

.category-card {
    border: 1px solid var(--k-border-color);
    border-radius: 12px;
    padding: 20px;
    background: var(--k-color-surface-1);
    transition: all 0.3s ease;
}

.category-card:hover {
    border-color: var(--k-color-primary);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
}

.category-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 15px;
}

.category-title h3 {
    margin: 0 0 8px 0;
    color: var(--k-color-text-1);
    font-size: 1.2em;
}

.category-actions {
    display: flex;
    gap: 8px;
}

.category-info {
    font-size: 0.9em;
    color: var(--k-color-text-2);
}

.description {
    margin-bottom: 12px;
    line-height: 1.5;
    color: var(--k-color-text-1);
}

.meta-info {
    margin-bottom: 15px;
    padding-bottom: 15px;
    border-bottom: 1px solid var(--k-border-color-light);
}

.created-date {
    font-size: 0.8em;
    color: var(--k-color-text-3);
}

.emoji-preview {
    margin-top: 12px;
}

.emoji-preview-header {
    font-size: 0.8em;
    color: var(--k-color-text-2);
    margin-bottom: 8px;
    font-weight: 500;
}

.emoji-preview-list {
    display: flex;
    gap: 4px;
    align-items: center;
    flex-wrap: wrap;
}

.emoji-preview-img {
    width: 24px;
    height: 24px;
    object-fit: cover;
    border-radius: 4px;
    border: 1px solid var(--k-border-color-light);
}

.emoji-preview-more {
    font-size: 0.7em;
    color: var(--k-color-text-3);
    background: var(--k-color-surface-2);
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid var(--k-border-color-light);
}

.no-categories {
    text-align: center;
    padding: 40px;
}

.pagination {
    display: flex;
    justify-content: center;
    margin-top: 20px;
}

.dialog-footer {
    display: flex;
    gap: 10px;
}

/* 响应式设计 */
@media (max-width: 768px) {
    .categories-manager {
        padding: 15px;
    }

    .header {
        flex-direction: column;
        gap: 15px;
        text-align: center;
    }

    .section-header {
        flex-direction: column;
        gap: 10px;
    }

    .search-box {
        width: 100%;
    }

    .search-box .el-input {
        width: 100% !important;
    }

    .categories-grid {
        grid-template-columns: 1fr;
        gap: 15px;
    }

    .stats {
        flex-direction: column;
        gap: 20px;
    }
}

@media (max-width: 480px) {
    .categories-manager {
        padding: 10px;
    }

    .category-header {
        flex-direction: column;
        gap: 10px;
        align-items: stretch;
    }

    .category-actions {
        justify-content: center;
    }

    .category-card {
        padding: 15px;
    }

    .emoji-preview-list {
        justify-content: center;
    }
}
</style>
