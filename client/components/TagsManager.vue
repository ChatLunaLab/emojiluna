<template>
  <div class="tags-manager">
    <!-- 标签统计卡片 -->
    <div class="stats-cards">
      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon">
            <el-icon size="24" color="#409EFF">
              <PriceTag />
            </el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-number">{{ tags.length }}</div>
            <div class="stat-label">标签总数</div>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon">
            <el-icon size="24" color="#67C23A">
              <DataAnalysis />
            </el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-number">{{ totalUsage }}</div>
            <div class="stat-label">总使用次数</div>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon">
            <el-icon size="24" color="#E6A23C">
              <TrendCharts />
            </el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-number">{{ averageUsage.toFixed(1) }}</div>
            <div class="stat-label">平均使用次数</div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 操作栏 -->
    <div class="action-bar">
      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索标签..."
          size="large"
          class="search-input"
          @keyup.enter="filterTags"
          clearable
        />
        <el-button
          type="primary"
          size="large"
          class="search-button"
          @click="filterTags"
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
          添加标签
        </el-button>
        <el-button
          circle
          size="large"
          class="refresh-action"
          @click="loadData"
          title="刷新"
        >
          <el-icon><RefreshRight /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- 标签列表 -->
    <div class="tags-content" v-loading="loading">
      <div v-if="filteredTags.length === 0" class="empty-state">
        <el-empty description="暂无标签" />
      </div>

      <div v-else class="tags-grid">
        <div
          v-for="tagInfo in paginatedTags"
          :key="tagInfo.name"
          class="tag-card"
        >
          <div class="tag-header">
            <div class="tag-name">
              <el-tag size="large" effect="plain" round>
                {{ tagInfo.name }}
              </el-tag>
            </div>
            <div class="tag-actions">
              <el-button
                size="small"
                type="primary"
                text
                @click="handleEditTag(tagInfo)"
                :icon="Edit"
              />
              <el-button
                size="small"
                type="danger"
                text
                @click="handleDeleteTag(tagInfo)"
                :icon="Delete"
              />
            </div>
          </div>

          <div class="tag-stats">
            <div class="usage-count">
              <el-icon><DataBoard /></el-icon>
              <span>使用次数: {{ tagInfo.usage }}</span>
            </div>
          </div>

          <div class="tag-emojis" v-if="tagInfo.emojis.length > 0">
            <div class="emoji-preview-header">
              <el-icon size="14"><Picture /></el-icon>
              <span>相关表情包</span>
            </div>
            <div class="emoji-preview-grid">
              <div
                v-for="emoji in tagInfo.emojis.slice(0, 4)"
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
                v-if="tagInfo.emojis.length > 4"
                class="emoji-preview-more"
              >
                <span>+{{ tagInfo.emojis.length - 4 }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div class="pagination-wrapper" v-if="filteredTags.length > pageSize">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[12, 24, 36, 48]"
          :total="filteredTags.length"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>

    <!-- 添加/编辑标签对话框 -->
    <el-dialog
      v-model="showEditDialog"
      :title="editingTag ? '编辑标签' : '添加标签'"
      width="450px"
      :before-close="handleCloseDialog"
    >
      <el-form
        :model="tagForm"
        :rules="tagFormRules"
        ref="tagFormRef"
        label-width="80px"
      >
        <el-form-item label="标签名称" prop="name">
          <el-input
            v-model="tagForm.name"
            placeholder="请输入标签名称"
            maxlength="20"
            show-word-limit
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="handleCloseDialog">取消</el-button>
          <el-button
            type="primary"
            @click="handleSaveTag"
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
  PriceTag,
  DataAnalysis,
  TrendCharts,
  DataBoard,
  Picture
} from '@element-plus/icons-vue'
import type { EmojiItem } from 'koishi-plugin-emojiluna'
import type { FormInstance, FormRules } from 'element-plus'

interface TagInfo {
  name: string
  usage: number
  emojis: EmojiItem[]
}

// 状态管理
const loading = ref(false)
const saving = ref(false)
const tags = ref<TagInfo[]>([])
const allEmojis = ref<EmojiItem[]>([])
const searchKeyword = ref('')
const currentPage = ref(1)
const pageSize = ref(12)
const baseUrl = ref('')

// 对话框状态
const showAddDialog = ref(false)
const showEditDialog = ref(false)
const editingTag = ref<TagInfo | null>(null)
const tagFormRef = ref<FormInstance>()

const tagForm = reactive({
  name: ''
})

const tagFormRules: FormRules = {
  name: [
    { required: true, message: '请输入标签名称', trigger: 'blur' },
    { min: 1, max: 20, message: '标签名称长度在 1 到 20 个字符', trigger: 'blur' }
  ]
}

// 计算属性
const totalUsage = computed(() => {
  return tags.value.reduce((sum, tag) => sum + tag.usage, 0)
})

const averageUsage = computed(() => {
  return tags.value.length > 0 ? totalUsage.value / tags.value.length : 0
})

const filteredTags = computed(() => {
  if (!searchKeyword.value.trim()) {
    return tags.value
  }
  return tags.value.filter(tag =>
    tag.name.toLowerCase().includes(searchKeyword.value.toLowerCase())
  )
})

const paginatedTags = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredTags.value.slice(start, end)
})

// 数据加载
const loadData = async () => {
  loading.value = true
  try {
    const [allTagsData, emojisData, baseUrlData] = await Promise.all([
      send('emojiluna/getAllTags'),
      send('emojiluna/getEmojiList', {}),
      send('emojiluna/getBaseUrl')
    ])

    allEmojis.value = emojisData || []
    baseUrl.value = baseUrlData || '/emojiluna'

    // 构建标签使用统计
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

    // 统计每个标签的使用情况
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
    loading.value = false
  }
}

// 事件处理
const filterTags = () => {
  currentPage.value = 1
}

const handleSizeChange = (newSize: number) => {
  pageSize.value = newSize
  currentPage.value = 1
}

const handleCurrentChange = (newPage: number) => {
  currentPage.value = newPage
}

const handleEditTag = (tag: TagInfo) => {
  editingTag.value = tag
  tagForm.name = tag.name
  showEditDialog.value = true
}

const handleDeleteTag = async (tag: TagInfo) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除标签 "${tag.name}" 吗？此操作将会从所有表情包中移除该标签。`,
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
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
    loadData()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to delete tag:', error)
      ElMessage.error('删除标签失败')
    }
  }
}

const handleSaveTag = async () => {
  if (!tagFormRef.value) return

  try {
    await tagFormRef.value.validate()
  } catch {
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

    handleCloseDialog()
    loadData()
  } catch (error) {
    console.error('Failed to save tag:', error)
    ElMessage.error('保存标签失败')
  } finally {
    saving.value = false
  }
}

const handleCloseDialog = () => {
  showEditDialog.value = false
  showAddDialog.value = false
  editingTag.value = null
  tagForm.name = ''
  tagFormRef.value?.resetFields()
}

const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0zMiAyMEM0Mi40IDIwIDQ0IDMwIDQ0IDMwQzQ0IDMwIDQyLjQgNDAgMzIgNDBDMjEuNiA0MCAyMCAzMCAyMCAzMEMyMCAzMCAyMS42IDIwIDMyIDIwWiIgZmlsbD0iI0NDQ0NDQyIvPgo8L3N2Zz4K'
}

// 监听添加对话框
import { watch } from 'vue'
watch(showAddDialog, (newValue) => {
  if (newValue) {
    editingTag.value = null
    tagForm.name = ''
    showEditDialog.value = true
    showAddDialog.value = false
  }
})

// 初始化
onMounted(() => {
  loadData()
})
</script>

<style scoped>
.tags-manager {
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
  background: #f5f7fa;
}

.stat-info {
  flex: 1;
}

.stat-number {
  font-size: 20px;
  font-weight: 600;
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
  color: var(--k-text-dark);
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

.tags-content {
  min-height: 400px;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.tags-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.tag-card {
  border: 1px solid var(--k-card-border);
  border-radius: 6px;
  padding: 16px;
  background: var(--k-card-bg);
}

.tag-card:hover {
  border-color: var(--k-color-primary);
}

.tag-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.tag-name {
  flex: 1;
}

.tag-actions {
  display: flex;
  gap: 8px;
}

.tag-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  color: var(--k-text-normal);
  font-size: 14px;
}

.usage-count {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tag-emojis {
  border-top: 1px solid var(--k-color-divider);
  padding-top: 16px;
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

.emoji-preview-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.emoji-preview-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 8px;
}

.emoji-preview-item {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 6px;
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
  background: var(--k-color-surface-1);
  border: 1px solid var(--k-border-color);
  border-radius: 6px;
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
  .tags-manager {
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

  .tags-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .tag-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .tag-actions {
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .tag-card {
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

  .emoji-preview-list {
    justify-content: center;
  }
}
</style>
