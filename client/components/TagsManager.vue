<template>
  <div class="tags-manager">
    <!-- Toolbar -->
    <div class="toolbar-container">
      <div class="toolbar-main">
        <div class="search-section">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索标签..."
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
            title="添加标签"
          >
            <el-icon><Plus /></el-icon>
          </el-button>
          <el-button
            circle
            @click="refreshData"
            title="刷新"
          >
            <el-icon><RefreshRight /></el-icon>
          </el-button>
        </div>
      </div>
    </div>

    <!-- Tags Grid -->
    <div class="tags-grid-container" v-loading="loading">
      <div v-if="filteredTags.length > 0" class="tags-grid">
        <div
          v-for="tag in filteredTags"
          :key="tag.name"
          class="album-card"
          @click="handleTagClick(tag)"
        >
          <div class="album-cover">
             <img
                v-if="tagCovers[tag.name]"
                :src="getEmojiUrl(tagCovers[tag.name])"
                class="cover-image"
                loading="lazy"
                @error="(e) => handleImageError(e)"
            />
            <div v-else class="cover-placeholder">
                <el-icon :size="48"><PriceTag /></el-icon>
            </div>

            <!-- Hover Actions -->
            <div class="album-actions" @click.stop>
                 <el-dropdown trigger="click" @command="(cmd) => handleCommand(cmd, tag)">
                    <div class="action-btn">
                        <el-icon><MoreFilled /></el-icon>
                    </div>
                    <template #dropdown>
                        <el-dropdown-menu>
                            <el-dropdown-item command="edit">
                                <el-icon><Edit /></el-icon>编辑
                            </el-dropdown-item>
                            <el-dropdown-item command="delete" class="danger-item">
                                <el-icon><Delete /></el-icon>删除
                            </el-dropdown-item>
                        </el-dropdown-menu>
                    </template>
                 </el-dropdown>
            </div>
          </div>
          <div class="album-info">
            <div class="album-name" :title="tag.name">#{{ tag.name }}</div>
            <div class="album-count">{{ tag.usage }} 使用</div>
          </div>
        </div>
      </div>
      <div v-else class="no-data">
        <el-empty description="暂无标签" />
      </div>
    </div>

    <!-- Add/Edit Tag Dialog -->
    <el-dialog
      v-model="showEditDialog"
      :title="editingTag ? '编辑标签' : '添加标签'"
      width="400px"
      :before-close="handleCloseDialog"
    >
      <el-form
        :model="tagForm"
        :rules="tagFormRules"
        ref="tagFormRef"
        label-width="80px"
      >
        <el-form-item label="名称" prop="name">
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
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { send } from '@koishijs/client'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, RefreshRight, PriceTag, MoreFilled, Edit, Delete } from '@element-plus/icons-vue'
import type { EmojiItem } from 'koishi-plugin-emojiluna'
import type { FormInstance, FormRules } from 'element-plus'

interface TagInfo {
  name: string
  usage: number
}

const emit = defineEmits<{
  (e: 'tag-click', tag: string): void
}>()

// State
const loading = ref(false)
const saving = ref(false)
const tags = ref<TagInfo[]>([])
const tagCovers = ref<Record<string, EmojiItem>>({})
const searchKeyword = ref('')
const baseUrl = ref('/emojiluna')

// Dialog State
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

// Computed
const filteredTags = computed(() => {
  if (!searchKeyword.value.trim()) {
    return tags.value
  }
  return tags.value.filter(tag =>
    tag.name.toLowerCase().includes(searchKeyword.value.toLowerCase())
  )
})

// Methods
const loadTags = async () => {
  loading.value = true
  try {
    // We need to fetch all tags and calculate usage or fetch usage from backend
    // Backend `getAllTags` returns string[]
    // We need to fetch emojis to count usage? That's heavy.
    // Let's check how it was done before.
    // Before: fetched ALL emojis and counted locally. Heavy but accurate if backend doesn't support tag stats.
    // Let's stick to that for now or ask backend to support it.
    // Ideally backend should return `TagWithCount[]`.
    // Since I can't modify backend easily (user said "only frontend"), I have to stick to frontend counting or simplify.
    // Wait, fetching ALL emojis just to count tags is very bad if we have 10k emojis.
    // But `getAllTags` returns all tags.
    // Maybe we just show tags without precise count if it's too heavy?
    // User requirement: "remove statistics... optimize... like gallery albums".
    // Albums usually have count.
    // Let's try to get counts by fetching all emojis meta data (without heavy load? `getEmojiList` returns full object).
    // If I have to, I'll fetch all. `getEmojiList` sends everything.

    const [allTagsData, allEmojis, baseUrlData] = await Promise.all([
      send('emojiluna/getAllTags'),
      send('emojiluna/getEmojiList', {}),
      send('emojiluna/getBaseUrl')
    ])

    baseUrl.value = baseUrlData || '/emojiluna'

    const tagUsageMap = new Map<string, number>()
    const tagFirstEmoji = new Map<string, EmojiItem>()

    if (allTagsData) {
        allTagsData.forEach((t: string) => tagUsageMap.set(t, 0))
    }

    if (allEmojis) {
        allEmojis.forEach((emoji: EmojiItem) => {
            emoji.tags.forEach((t: string) => {
                const current = tagUsageMap.get(t) || 0
                tagUsageMap.set(t, current + 1)
                if (!tagFirstEmoji.has(t)) {
                    tagFirstEmoji.set(t, emoji)
                }
            })
        })
    }

    tags.value = Array.from(tagUsageMap.entries()).map(([name, usage]) => ({
        name,
        usage
    })).sort((a, b) => b.usage - a.usage)

    // Set covers
    tagFirstEmoji.forEach((emoji, tag) => {
        tagCovers.value[tag] = emoji
    })

  } catch (error) {
    console.error('Failed to load tags:', error)
    ElMessage.error('加载标签失败')
  } finally {
    loading.value = false
  }
}

const refreshData = () => {
    loadTags()
}

const handleSearch = () => {
    // Client side filtering
}

const getEmojiUrl = (emoji: EmojiItem) => {
    return `${baseUrl.value}/get/${emoji.name}`
}

const handleImageError = (event: Event) => {
    const target = event.target as HTMLElement
    target.style.display = 'none'
    const img = event.target as HTMLImageElement
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0zMiAyMEM0Mi40IDIwIDQ0IDMwIDQ0IDMwQzQ0IDMwIDQyLjQgNDAgMzIgNDBDMjEuNiA0MCAyMCAzMCAyMCAzMEMyMCAzMCAyMS42IDIwIDMyIDIwWiIgZmlsbD0iI0NDQ0NDQyIvPgo8L3N2Zz4K'
}

const handleTagClick = (tag: TagInfo) => {
    emit('tag-click', tag.name)
}

const handleCommand = (command: string, tag: TagInfo) => {
    if (command === 'edit') {
        handleEditTag(tag)
    } else if (command === 'delete') {
        handleDeleteTag(tag)
    }
}

const handleEditTag = (tag: TagInfo) => {
  editingTag.value = tag
  tagForm.name = tag.name
  showEditDialog.value = true
}

const handleDeleteTag = async (tag: TagInfo) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除标签 "${tag.name}" 吗？`,
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    // We need to remove this tag from all emojis
    // Fetch emojis with this tag
    const emojisWithTag = await send('emojiluna/getEmojiList', { tags: [tag.name] })
    if (emojisWithTag) {
        for (const emoji of emojisWithTag) {
            const newTags = emoji.tags.filter((t: string) => t !== tag.name)
            await send('emojiluna/updateEmojiTags', emoji.id, newTags)
        }
    }

    ElMessage.success('标签删除成功')
    refreshData()
  } catch (error) {
    if (error !== 'cancel') {
        console.error('Failed to delete tag:', error)
        ElMessage.error('删除标签失败')
    }
  }
}

const handleSaveTag = async () => {
  if (!tagFormRef.value) return
  await tagFormRef.value.validate(async (valid) => {
      if (valid) {
        saving.value = true
        try {
            if (editingTag.value) {
                // Update tag name
                const oldName = editingTag.value.name
                const newName = tagForm.name
                if (oldName !== newName) {
                    const emojisWithTag = await send('emojiluna/getEmojiList', { tags: [oldName] })
                    if (emojisWithTag) {
                        for (const emoji of emojisWithTag) {
                            const newTags = emoji.tags.map((t: string) => t === oldName ? newName : t)
                            await send('emojiluna/updateEmojiTags', emoji.id, newTags)
                        }
                    }
                    ElMessage.success('更新成功')
                }
            } else {
                // Adding a tag standalone doesn't really do much until assigned, but okay
                ElMessage.success('标签将在分配给表情包时创建')
            }
            showEditDialog.value = false
            refreshData()
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
    editingTag.value = null
    tagForm.name = ''
}

watch(showAddDialog, (val) => {
    if (val) {
        editingTag.value = null
        tagForm.name = ''
        showEditDialog.value = true
        showAddDialog.value = false
    }
})

onMounted(() => {
    loadTags()
})
</script>

<style scoped>
.tags-manager {
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

.tags-grid {
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
