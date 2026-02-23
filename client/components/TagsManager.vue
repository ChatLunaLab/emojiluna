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
                        :type="isSelectionMode ? 'danger' : 'default'"
                        circle
                        @click="toggleSelectionMode"
                        :title="isSelectionMode ? '取消选择' : '选择'"
                    >
                        <el-icon v-if="isSelectionMode"><Close /></el-icon>
                        <el-icon v-else><Check /></el-icon>
                    </el-button>
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
                        @click="handleCleanupEmptyTags"
                        title="清理空标签"
                    >
                        <el-icon><Delete /></el-icon>
                    </el-button>
                    <el-button circle @click="refreshData" title="刷新">
                        <el-icon><RefreshRight /></el-icon>
                    </el-button>
                </div>
            </div>
        </div>

        <!-- Tags Grid -->
        <div class="tags-grid-container" v-loading="loading">
            <div v-if="tags.length > 0" class="tags-grid">
                <div
                    v-for="tag in tags"
                    :key="tag.name"
                    class="album-card"
                    :class="{ selected: isSelected(tag) }"
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

                        <div v-if="isSelectionMode" class="selection-badge">
                            <el-icon><Check /></el-icon>
                        </div>

                        <!-- Hover Actions -->
                        <div
                            class="album-actions"
                            @click.stop
                            v-if="!isSelectionMode"
                        >
                            <el-dropdown
                                trigger="click"
                                @command="(cmd) => handleCommand(cmd, tag)"
                            >
                                <div class="action-btn">
                                    <el-icon><MoreFilled /></el-icon>
                                </div>
                                <template #dropdown>
                                    <el-dropdown-menu>
                                        <el-dropdown-item command="edit">
                                            <el-icon><Edit /></el-icon>
                                            编辑
                                        </el-dropdown-item>
                                        <el-dropdown-item
                                            command="delete"
                                            class="danger-item"
                                        >
                                            <el-icon><Delete /></el-icon>
                                            删除
                                        </el-dropdown-item>
                                    </el-dropdown-menu>
                                </template>
                            </el-dropdown>
                        </div>
                    </div>
                    <div class="album-info">
                        <div class="album-name" :title="tag.name">
                            #{{ tag.name }}
                        </div>
                        <div class="album-count">{{ tag.usage }} 使用</div>
                    </div>
                </div>
            </div>
            <div v-else class="no-data">
                <el-empty description="暂无标签" />
            </div>
        </div>

        <div class="pagination" v-if="total > pageSize">
            <el-pagination
                v-model:current-page="currentPage"
                v-model:page-size="pageSize"
                :page-sizes="[12, 24, 48]"
                :total="total"
                layout="prev, pager, next"
                @size-change="handleSizeChange"
                @current-change="handleCurrentChange"
                background
            />
        </div>

        <Transition name="slide-up">
            <div
                class="floating-action-bar"
                v-if="isSelectionMode && selectedTags.length > 0"
            >
                <div class="selection-count">
                    已选择 {{ selectedTags.length }} 个标签
                </div>
                <div class="selection-actions">
                    <el-button
                        type="danger"
                        text
                        bg
                        @click="handleBatchDeleteTags"
                    >
                        <el-icon><Delete /></el-icon>
                        删除
                    </el-button>
                </div>
            </div>
        </Transition>

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
import {
    Search,
    Plus,
    RefreshRight,
    PriceTag,
    MoreFilled,
    Edit,
    Delete,
    Check,
    Close
} from '@element-plus/icons-vue'
import type { EmojiItem, TagInfo } from 'koishi-plugin-emojiluna'
import type { FormInstance, FormRules } from 'element-plus'

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
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(24)
const isSelectionMode = ref(false)
const selectedTagNames = ref<Set<string>>(new Set())

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
        {
            min: 1,
            max: 20,
            message: '标签名称长度在 1 到 20 个字符',
            trigger: 'blur'
        }
    ]
}

// Computed
const selectedTags = computed(() => {
    return tags.value.filter((tag) => selectedTagNames.value.has(tag.name))
})

// Methods
const loadTags = async () => {
    loading.value = true
    try {
        const keyword = searchKeyword.value.trim() || undefined
        const [tagsPage, baseUrlData] = await Promise.all([
            send('emojiluna/getTagsPage', {
                keyword,
                limit: pageSize.value,
                offset: (currentPage.value - 1) * pageSize.value
            }),
            send('emojiluna/getBaseUrl')
        ])

        baseUrl.value = baseUrlData || '/emojiluna'

        tags.value = tagsPage?.items || []
        total.value = tagsPage?.total || 0
        tagCovers.value = {}

        const currentNames = new Set(tags.value.map((tag) => tag.name))
        selectedTagNames.value = new Set(
            Array.from(selectedTagNames.value).filter((name) =>
                currentNames.has(name)
            )
        )

        await Promise.all(
            tags.value.map(async (tag) => {
                if (tag.usage <= 0) return
                const result: EmojiItem[] =
                    (await send('emojiluna/getEmojiList', {
                        tags: [tag.name],
                        limit: 1
                    })) || []
                if (result.length > 0) {
                    tagCovers.value[tag.name] = result[0]
                }
            })
        )
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
    currentPage.value = 1
    loadTags()
}

const handleSizeChange = (newSize: number) => {
    pageSize.value = newSize
    currentPage.value = 1
    loadTags()
}

const handleCurrentChange = (newPage: number) => {
    currentPage.value = newPage
    loadTags()
}

const getEmojiUrl = (emoji: EmojiItem) => {
    return `${baseUrl.value}/get/${emoji.id}`
}

const handleImageError = (event: Event) => {
    const target = event.target as HTMLElement
    target.style.display = 'none'
    const img = event.target as HTMLImageElement
    img.src =
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0zMiAyMEM0Mi40IDIwIDQ0IDMwIDQ0IDMwQzQ0IDMwIDQyLjQgNDAgMzIgNDBDMjEuNiA0MCAyMCAzMCAyMCAzMEMyMCAzMCAyMS42IDIwIDMyIDIwWiIgZmlsbD0iI0NDQ0NDQyIvPgo8L3N2Zz4K'
}

const handleTagClick = (tag: TagInfo) => {
    if (isSelectionMode.value) {
        handleTagSelect(tag)
        return
    }

    emit('tag-click', tag.name)
}

const toggleSelectionMode = () => {
    isSelectionMode.value = !isSelectionMode.value
    selectedTagNames.value = new Set()
}

const isSelected = (tag: TagInfo) => {
    return selectedTagNames.value.has(tag.name)
}

const handleTagSelect = (tag: TagInfo) => {
    const next = new Set(selectedTagNames.value)
    if (next.has(tag.name)) {
        next.delete(tag.name)
    } else {
        next.add(tag.name)
    }
    selectedTagNames.value = next
}

const removeTagsFromEmojis = async (tagNames: string[]) => {
    const tagNameSet = new Set(tagNames)
    const emojiMap = new Map<string, EmojiItem>()

    for (const tagName of tagNames) {
        const emojisWithTag: EmojiItem[] =
            (await send('emojiluna/getEmojiList', { tags: [tagName] })) || []

        for (const emoji of emojisWithTag) {
            emojiMap.set(emoji.id, emoji)
        }
    }

    const updates = Array.from(emojiMap.values())
        .map((emoji) => {
            const newTags = emoji.tags.filter((t) => !tagNameSet.has(t))
            if (newTags.length === emoji.tags.length) {
                return null
            }
            return send('emojiluna/updateEmojiTags', emoji.id, newTags)
        })
        .filter((task): task is Promise<unknown> => task !== null)

    await Promise.all(updates)
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
                type: 'warning'
            }
        )

        await removeTagsFromEmojis([tag.name])

        ElMessage.success('标签删除成功')
        refreshData()
    } catch (error) {
        if (error !== 'cancel') {
            console.error('Failed to delete tag:', error)
            ElMessage.error('删除标签失败')
        }
    }
}

const handleBatchDeleteTags = async () => {
    if (selectedTags.value.length === 0) return

    const selected = selectedTags.value.map((item) => item.name)
    try {
        await ElMessageBox.confirm(
            `确定要删除选中的 ${selected.length} 个标签吗？\n这些标签将从关联表情包中移除。`,
            '警告',
            {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning'
            }
        )

        await removeTagsFromEmojis(selected)
        ElMessage.success('批量删除标签成功')
        selectedTagNames.value = new Set()
        isSelectionMode.value = false
        await loadTags()
    } catch (error) {
        if (error !== 'cancel') {
            console.error('Failed to batch delete tags:', error)
            ElMessage.error('批量删除标签失败')
        }
    }
}

const handleCleanupEmptyTags = async () => {
    try {
        const cleanedCount = await send('emojiluna/cleanupEmptyTags')
        if (cleanedCount > 0) {
            ElMessage.success(`已清理 ${cleanedCount} 个空标签`)
        } else {
            ElMessage.info('没有可清理的空标签')
        }
        await loadTags()
    } catch (error) {
        console.error('Failed to cleanup empty tags:', error)
        ElMessage.error('清理空标签失败')
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
                        const emojisWithTag = await send(
                            'emojiluna/getEmojiList',
                            { tags: [oldName] }
                        )
                        if (emojisWithTag) {
                            for (const emoji of emojisWithTag) {
                                const newTags = emoji.tags.map((t: string) =>
                                    t === oldName ? newName : t
                                )
                                await send(
                                    'emojiluna/updateEmojiTags',
                                    emoji.id,
                                    newTags
                                )
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

.album-card.selected .album-cover {
    box-shadow:
        0 0 0 2px var(--k-color-primary),
        0 6px 12px rgba(0, 0, 0, 0.12);
}

.album-cover {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 12px;
    background-color: var(--k-color-surface-2);
    overflow: hidden;
    position: relative;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
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

.selection-badge {
    position: absolute;
    left: 8px;
    top: 8px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--k-color-base), transparent 8%);
    border: 1px solid var(--k-color-divider);
    display: flex;
    align-items: center;
    justify-content: center;
    color: transparent;
    transition: all 0.2s ease;
}

.album-card.selected .selection-badge {
    color: #fff;
    background: var(--k-color-primary);
    border-color: var(--k-color-primary);
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
    background-color: rgba(255, 255, 255, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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

.pagination {
    display: flex;
    justify-content: center;
    padding: 20px 0;
}

.floating-action-bar {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--k-color-base);
    border: 1px solid var(--k-color-divider);
    border-radius: 12px;
    padding: 12px 20px;
    display: flex;
    align-items: center;
    gap: 20px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    z-index: 100;
}

.selection-count {
    font-weight: 600;
    color: var(--k-color-text);
}

.selection-actions {
    display: flex;
    gap: 10px;
}

.slide-up-enter-active,
.slide-up-leave-active {
    transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
    transform: translate(-50%, 100%);
    opacity: 0;
}
</style>
