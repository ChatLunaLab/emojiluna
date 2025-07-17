<template>
  <k-layout>
    <el-scrollbar>
      <div class="dashboard">

        <el-tabs v-model="activeTab" type="card" class="dashboard-tabs">
          <!-- 表情包管理 -->
          <el-tab-pane :label="t('emojiluna.tabs.emojis')" name="emojis">
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
          </el-tab-pane>

          <!-- 标签管理 -->
          <el-tab-pane :label="t('emojiluna.tabs.tags')" name="tags">
            <div class="tags-manager">
              <div class="tab-header">
                <el-button type="primary" @click="showTagAddDialog = true">
                  <el-icon><Plus /></el-icon>
                  {{ t('emojiluna.tags.add') }}
                </el-button>
              </div>

              <!-- 标签统计 -->
              <div class="stats-section">
                <el-card>
                  <div class="stats">
                    <div class="stat-item">
                      <div class="stat-number">{{ tags.length }}</div>
                      <div class="stat-label">标签总数</div>
                    </div>
                    <div class="stat-item">
                      <div class="stat-number">{{ totalUsage }}</div>
                      <div class="stat-label">总使用次数</div>
                    </div>
                    <div class="stat-item">
                      <div class="stat-number">{{ averageUsage.toFixed(1) }}</div>
                      <div class="stat-label">平均使用次数</div>
                    </div>
                  </div>
                </el-card>
              </div>

              <!-- 标签列表 -->
              <el-card class="tags-section">
                <template #header>
                  <div class="section-header">
                    <span>标签列表</span>
                    <div class="search-box">
                      <el-input v-model="tagSearchKeyword" placeholder="搜索标签..." size="small"
                        style="width: 200px" @input="filterTags">
                        <template #prefix>
                          <el-icon><Search /></el-icon>
                        </template>
                      </el-input>
                    </div>
                  </div>
                </template>

                <div v-loading="tagsLoading">
                  <div v-if="filteredTags.length === 0" class="no-tags">
                    <el-empty description="暂无标签" />
                  </div>

                  <div v-else class="tags-grid">
                    <div v-for="tagInfo in paginatedTags" :key="tagInfo.name" class="tag-card">
                      <div class="tag-header">
                        <el-tag size="large" type="primary">{{ tagInfo.name }}</el-tag>
                        <div class="tag-actions">
                          <el-button size="small" @click="handleEditTag(tagInfo)" circle>
                            <el-icon><Edit /></el-icon>
                          </el-button>
                          <el-button size="small" type="danger" @click="handleDeleteTag(tagInfo)" circle>
                            <el-icon><Delete /></el-icon>
                          </el-button>
                        </div>
                      </div>

                      <div class="tag-info">
                        <div class="usage-count">使用次数: {{ tagInfo.usage }}</div>
                        <div class="usage-emojis" v-if="tagInfo.emojis.length > 0">
                          <span>表情包: </span>
                          <el-tag v-for="emoji in tagInfo.emojis.slice(0, 3)" :key="emoji.id"
                            size="small" type="info">{{ emoji.name }}</el-tag>
                          <el-tag v-if="tagInfo.emojis.length > 3" size="small" type="info">
                            +{{ tagInfo.emojis.length - 3 }}
                          </el-tag>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 分页 -->
                  <div class="pagination" v-if="filteredTags.length > tagPageSize">
                    <el-pagination v-model:current-page="tagCurrentPage" v-model:page-size="tagPageSize"
                      :page-sizes="[12, 24, 48]" :total="filteredTags.length"
                      layout="total, sizes, prev, pager, next" @size-change="handleTagSizeChange"
                      @current-change="handleTagCurrentChange" />
                  </div>
                </div>
              </el-card>
            </div>
          </el-tab-pane>

          <!-- 分类管理 -->
          <el-tab-pane :label="t('emojiluna.tabs.categories')" name="categories">
            <div class="categories-manager">
              <div class="tab-header">
                <el-button type="primary" @click="showCategoryAddDialog = true">
                  <el-icon><Plus /></el-icon>
                  {{ t('emojiluna.categories.add') }}
                </el-button>
              </div>

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
                      <el-input v-model="categorySearchKeyword" placeholder="搜索分类..." size="small"
                        style="width: 200px" @input="filterCategories">
                        <template #prefix>
                          <el-icon><Search /></el-icon>
                        </template>
                      </el-input>
                    </div>
                  </div>
                </template>

                <div v-loading="categoriesLoading">
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
                            <el-icon><Edit /></el-icon>
                          </el-button>
                          <el-button size="small" type="danger" @click="handleDeleteCategory(category)" circle
                            :disabled="category.emojiCount > 0">
                            <el-icon><Delete /></el-icon>
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
                            <img v-for="emoji in categoryEmojis[category.name].slice(0, 6)" :key="emoji.id"
                              :src="`${baseUrl}/get/${emoji.name}`" :alt="emoji.name" :title="emoji.name"
                              class="emoji-preview-img" @error="handleImageError" />
                            <div v-if="categoryEmojis[category.name].length > 6" class="emoji-preview-more">
                              +{{ categoryEmojis[category.name].length - 6 }}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 分页 -->
                  <div class="pagination" v-if="filteredCategories.length > categoryPageSize">
                    <el-pagination v-model:current-page="categoryCurrentPage" v-model:page-size="categoryPageSize"
                      :page-sizes="[9, 18, 36]" :total="filteredCategories.length"
                      layout="total, sizes, prev, pager, next" @size-change="handleCategorySizeChange"
                      @current-change="handleCategoryCurrentChange" />
                  </div>
                </div>
              </el-card>
            </div>
          </el-tab-pane>
        </el-tabs>

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

        <!-- 添加/编辑标签对话框 -->
        <el-dialog v-model="showTagEditDialog" :title="editingTag ? t('emojiluna.tags.edit') : t('emojiluna.tags.add')" width="400px">
          <el-form :model="tagForm" label-width="80px">
            <el-form-item :label="t('emojiluna.tags.name')" required>
              <el-input v-model="tagForm.name" :placeholder="t('emojiluna.tags.name')" />
            </el-form-item>
          </el-form>

          <template #footer>
            <span class="dialog-footer">
              <el-button @click="handleCloseTagDialog">{{ t('common.cancel') }}</el-button>
              <el-button type="primary" @click="handleSaveTag" :loading="saving">
                {{ t('common.save') }}
              </el-button>
            </span>
          </template>
        </el-dialog>

        <!-- 添加/编辑分类对话框 -->
        <el-dialog v-model="showCategoryEditDialog" :title="editingCategory ? t('emojiluna.categories.edit') : t('emojiluna.categories.add')" width="500px">
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
              <el-button @click="handleCloseCategoryDialog">{{ t('common.cancel') }}</el-button>
              <el-button type="primary" @click="handleSaveCategory" :loading="saving">
                {{ t('common.save') }}
              </el-button>
            </span>
          </template>
        </el-dialog>
      </div>
    </el-scrollbar>
  </k-layout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { send } from '@koishijs/client'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, Edit, Delete } from '@element-plus/icons-vue'
import EmojiCard from './components/EmojiCard.vue'
import EmojiDialog from './components/EmojiDialog.vue'
import AddEmojiDialog from './components/AddEmojiDialog.vue'
import type { EmojiItem, Category, EmojiSearchOptions } from 'koishi-plugin-emojiluna'

interface TagInfo {
  name: string
  usage: number
  emojis: EmojiItem[]
}

const { t } = useI18n()

// 标签页状态
const activeTab = ref('emojis')

// 表情包管理状态
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

// 标签管理状态
const tagsLoading = ref(false)
const tags = ref<TagInfo[]>([])
const allEmojis = ref<EmojiItem[]>([])
const tagSearchKeyword = ref('')
const tagCurrentPage = ref(1)
const tagPageSize = ref(12)

// 标签对话框状态
const showTagAddDialog = ref(false)
const showTagEditDialog = ref(false)
const editingTag = ref<TagInfo | null>(null)

const tagForm = reactive({
  name: ''
})

// 分类管理状态
const categoriesLoading = ref(false)
const categoryEmojis = ref<Record<string, EmojiItem[]>>({})
const categorySearchKeyword = ref('')
const categoryCurrentPage = ref(1)
const categoryPageSize = ref(9)

// 分类对话框状态
const showCategoryAddDialog = ref(false)
const showCategoryEditDialog = ref(false)
const editingCategory = ref<Category | null>(null)

const categoryForm = reactive({
  name: '',
  description: ''
})

// 通用状态
const saving = ref(false)

// 配置
const baseUrl = ref('')

// 表情包管理计算属性和方法
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
    baseUrl.value = await send('emojiluna/getBaseUrl') || ''
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
  navigator.clipboard?.writeText(`${baseUrl.value}/get/${emoji.id})`)
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
    loadCategories()
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

// 标签管理计算属性和方法
const totalUsage = computed(() => {
  return tags.value.reduce((sum, tag) => sum + tag.usage, 0)
})

const averageUsage = computed(() => {
  return tags.value.length > 0 ? totalUsage.value / tags.value.length : 0
})

const filteredTags = computed(() => {
  if (!tagSearchKeyword.value.trim()) {
    return tags.value
  }
  return tags.value.filter(tag =>
    tag.name.toLowerCase().includes(tagSearchKeyword.value.toLowerCase())
  )
})

const paginatedTags = computed(() => {
  const start = (tagCurrentPage.value - 1) * tagPageSize.value
  const end = start + tagPageSize.value
  return filteredTags.value.slice(start, end)
})

const loadTagsData = async () => {
  tagsLoading.value = true
  try {
    const [allTagsData, emojisData] = await Promise.all([
      send('emojiluna/getAllTags'),
      send('emojiluna/getEmojiList', {})
    ])

    allEmojis.value = emojisData || []

    const tagUsageMap = new Map<string, TagInfo>()

    if (allTagsData && allTagsData.length > 0) {
      allTagsData.forEach((tagName: string) => {
        tagUsageMap.set(tagName, {
          name: tagName,
          usage: 0,
          emojis: []
        })
      })
    }

    allEmojis.value.forEach(emoji => {
      emoji.tags.forEach(tagName => {
        if (!tagUsageMap.has(tagName)) {
          tagUsageMap.set(tagName, {
            name: tagName,
            usage: 0,
            emojis: []
          })
        }
        const tagInfo = tagUsageMap.get(tagName)!
        tagInfo.usage++
        tagInfo.emojis.push(emoji)
      })
    })

    tags.value = Array.from(tagUsageMap.values())
      .sort((a, b) => b.usage - a.usage)
  } catch (error) {
    console.error('Failed to load tags:', error)
    ElMessage.error('加载标签失败')
  } finally {
    tagsLoading.value = false
  }
}

const filterTags = () => {
  tagCurrentPage.value = 1
}

const handleTagSizeChange = (newSize: number) => {
  tagPageSize.value = newSize
  tagCurrentPage.value = 1
}

const handleTagCurrentChange = (newPage: number) => {
  tagCurrentPage.value = newPage
}

const handleEditTag = (tag: TagInfo) => {
  editingTag.value = tag
  tagForm.name = tag.name
  showTagEditDialog.value = true
}

const handleDeleteTag = async (tag: TagInfo) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除标签 "${tag.name}" 吗？此操作将会从所有表情包中移除该标签。`,
      t('common.warning'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      }
    )

    const emojisWithTag = allEmojis.value.filter(emoji =>
      emoji.tags.includes(tag.name)
    )

    for (const emoji of emojisWithTag) {
      const newTags = emoji.tags.filter(t => t !== tag.name)
      await send('emojiluna/updateEmojiTags', emoji.id, newTags)
    }

    ElMessage.success('标签删除成功')
    loadTagsData()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to delete tag:', error)
      ElMessage.error('删除标签失败')
    }
  }
}

const handleSaveTag = async () => {
  if (!tagForm.name.trim()) {
    ElMessage.warning('请输入标签名称')
    return
  }

  saving.value = true
  try {
    if (editingTag.value) {
      const emojisWithTag = allEmojis.value.filter(emoji =>
        emoji.tags.includes(editingTag.value!.name)
      )

      for (const emoji of emojisWithTag) {
        const newTags = emoji.tags.map(t =>
          t === editingTag.value!.name ? tagForm.name : t
        )
        await send('emojiluna/updateEmojiTags', emoji.id, newTags)
      }

      ElMessage.success('标签更新成功')
    } else {
      ElMessage.success('标签将在使用时自动创建')
    }

    handleCloseTagDialog()
    loadTagsData()
  } catch (error) {
    console.error('Failed to save tag:', error)
    ElMessage.error('保存标签失败')
  } finally {
    saving.value = false
  }
}

const handleCloseTagDialog = () => {
  showTagEditDialog.value = false
  showTagAddDialog.value = false
  editingTag.value = null
  tagForm.name = ''
}

// 分类管理计算属性和方法
const totalEmojis = computed(() => {
  return categories.value.reduce((sum, category) => sum + category.emojiCount, 0)
})

const averageEmojisPerCategory = computed(() => {
  return categories.value.length > 0 ? totalEmojis.value / categories.value.length : 0
})

const filteredCategories = computed(() => {
  if (!categorySearchKeyword.value.trim()) {
    return categories.value
  }
  return categories.value.filter(category =>
    category.name.toLowerCase().includes(categorySearchKeyword.value.toLowerCase()) ||
    (category.description && category.description.toLowerCase().includes(categorySearchKeyword.value.toLowerCase()))
  )
})

const paginatedCategories = computed(() => {
  const start = (categoryCurrentPage.value - 1) * categoryPageSize.value
  const end = start + categoryPageSize.value
  return filteredCategories.value.slice(start, end)
})

const loadCategoriesData = async () => {
  categoriesLoading.value = true
  try {
    categories.value = await send('emojiluna/getCategories') || []
  } catch (error) {
    console.error('Failed to load categories:', error)
    ElMessage.error('加载分类失败')
  } finally {
    categoriesLoading.value = false
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

const formatDate = (date: Date) => {
  return new Date(date).toLocaleDateString('zh-CN')
}

const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0zMiAyMEM0Mi40IDIwIDQ0IDMwIDQ0IDMwQzQ0IDMwIDQyLjQgNDAgMzIgNDBDMjEuNiA0MCAyMCAzMCAyMCAzMEMyMCAzMCAyMS42IDIwIDMyIDIwWiIgZmlsbD0iI0NDQ0NDQyIvPgo8L3N2Zz4K'
}

const filterCategories = () => {
  categoryCurrentPage.value = 1
}

const handleCategorySizeChange = (newSize: number) => {
  categoryPageSize.value = newSize
  categoryCurrentPage.value = 1
}

const handleCategoryCurrentChange = (newPage: number) => {
  categoryCurrentPage.value = newPage
}

const handleEditCategory = (category: Category) => {
  editingCategory.value = category
  categoryForm.name = category.name
  categoryForm.description = category.description || ''
  showCategoryEditDialog.value = true
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
    loadCategoriesData()
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
      ElMessage.info('编辑分类功能暂未实现')
    } else {
      await send('emojiluna/addCategory', categoryForm.name, categoryForm.description)
      ElMessage.success('分类添加成功')
    }

    handleCloseCategoryDialog()
    loadCategoriesData()
  } catch (error) {
    console.error('Failed to save category:', error)
    ElMessage.error('保存分类失败')
  } finally {
    saving.value = false
  }
}

const handleCloseCategoryDialog = () => {
  showCategoryEditDialog.value = false
  showCategoryAddDialog.value = false
  editingCategory.value = null
  categoryForm.name = ''
  categoryForm.description = ''
}

// 监听对话框状态
watch(showTagAddDialog, (newValue) => {
  if (newValue) {
    editingTag.value = null
    tagForm.name = ''
    showTagEditDialog.value = true
    showTagAddDialog.value = false
  }
})

watch(showCategoryAddDialog, (newValue) => {
  if (newValue) {
    editingCategory.value = null
    categoryForm.name = ''
    categoryForm.description = ''
    showCategoryEditDialog.value = true
    showCategoryAddDialog.value = false
  }
})

// 初始化
onMounted(async () => {
  await Promise.all([
    loadEmojis(),
    loadCategories(),
    loadTags(),
    loadTagsData(),
    loadCategoriesData()
  ])
  await loadCategoryEmojis()
})
</script>

<style scoped>
.dashboard {
  padding: 20px;
  margin: 20px;
}

.header {
  text-align: center;
  margin-bottom: 30px;
}

.header h1 {
  margin: 0;
  color: var(--k-color-text-1);
  font-size: 2em;
}

.dashboard-tabs {
  min-height: 600px;
}

.tab-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 20px;
}

/* 表情包管理样式 */
.emoji-manager {
  padding: 0;
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

/* 标签管理样式 */
.tags-manager {
  padding: 0;
}

.stats-section {
  margin-bottom: 20px;
}

.stats {
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

.tags-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.tag-card {
  border: 1px solid var(--k-border-color);
  border-radius: 8px;
  padding: 15px;
  background: var(--k-color-surface-1);
  transition: all 0.3s ease;
}

.tag-card:hover {
  border-color: var(--k-color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.tag-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.tag-actions {
  display: flex;
  gap: 8px;
}

.tag-info {
  font-size: 0.9em;
  color: var(--k-color-text-2);
}

.usage-count {
  margin-bottom: 8px;
}

.usage-emojis {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.usage-emojis span {
  margin-right: 4px;
}

.no-tags {
  text-align: center;
  padding: 40px;
}

/* 分类管理样式 */
.categories-manager {
  padding: 0;
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

.dialog-footer {
  display: flex;
  gap: 10px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .dashboard {
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

  .tags-grid {
    grid-template-columns: 1fr;
    gap: 15px;
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
  .dashboard {
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

  .tag-header {
    flex-direction: column;
    gap: 10px;
    align-items: stretch;
  }

  .tag-actions {
    justify-content: center;
  }

  .usage-emojis {
    flex-direction: column;
    align-items: flex-start;
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
