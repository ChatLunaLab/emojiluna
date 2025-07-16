<template>
    <k-layout>
        <el-scrollbar>
            <div class="tags-manager">
                <div class="header">
                    <h1>{{ t('emojiluna.tags.title') }}</h1>
                    <el-button type="primary" @click="showAddDialog = true">
                        <el-icon>
                            <Plus />
                        </el-icon>
                        {{ t('emojiluna.tags.add') }}
                    </el-button>
                </div>

                <div class="content">
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
                                    <el-input v-model="searchKeyword" placeholder="搜索标签..." size="small"
                                        style="width: 200px" @input="filterTags">
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
                            <div v-if="filteredTags.length === 0" class="no-tags">
                                <el-empty description="暂无标签" />
                            </div>

                            <div v-else class="tags-grid">
                                <div v-for="tagInfo in paginatedTags" :key="tagInfo.name" class="tag-card">
                                    <div class="tag-header">
                                        <el-tag size="large" type="primary">{{ tagInfo.name }}</el-tag>
                                        <div class="tag-actions">
                                            <el-button size="small" @click="handleEditTag(tagInfo)" circle>
                                                <el-icon>
                                                    <Edit />
                                                </el-icon>
                                            </el-button>
                                            <el-button size="small" type="danger" @click="handleDeleteTag(tagInfo)"
                                                circle>
                                                <el-icon>
                                                    <Delete />
                                                </el-icon>
                                            </el-button>
                                        </div>
                                    </div>

                                    <div class="tag-info">
                                        <div class="usage-count">使用次数: {{ tagInfo.usage }}</div>
                                        <div class="usage-emojis" v-if="tagInfo.emojis.length > 0">
                                            <span>表情包: </span>
                                            <el-tag v-for="emoji in tagInfo.emojis.slice(0, 3)" :key="emoji.id"
                                                size="small" type="info">
                                                {{ emoji.name }}
                                            </el-tag>
                                            <el-tag v-if="tagInfo.emojis.length > 3" size="small" type="info">
                                                +{{ tagInfo.emojis.length - 3 }}
                                            </el-tag>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- 分页 -->
                            <div class="pagination" v-if="filteredTags.length > pageSize">
                                <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize"
                                    :page-sizes="[12, 24, 48]" :total="filteredTags.length"
                                    layout="total, sizes, prev, pager, next" @size-change="handleSizeChange"
                                    @current-change="handleCurrentChange" />
                            </div>
                        </div>
                    </el-card>
                </div>
            </div>
        </el-scrollbar>

        <!-- 添加/编辑标签对话框 -->
        <el-dialog v-model="showEditDialog" :title="editingTag ? t('emojiluna.tags.edit') : t('emojiluna.tags.add')"
            width="400px">
            <el-form :model="tagForm" label-width="80px">
                <el-form-item :label="t('emojiluna.tags.name')" required>
                    <el-input v-model="tagForm.name" :placeholder="t('emojiluna.tags.name')" />
                </el-form-item>
            </el-form>

            <template #footer>
                <span class="dialog-footer">
                    <el-button @click="handleCloseDialog">{{ t('common.cancel') }}</el-button>
                    <el-button type="primary" @click="handleSaveTag" :loading="saving">
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
import type { EmojiItem } from 'koishi-plugin-emojiluna'

interface TagInfo {
    name: string
    usage: number
    emojis: EmojiItem[]
}

const { t } = useI18n()

// 状态管理
const loading = ref(false)
const saving = ref(false)
const tags = ref<TagInfo[]>([])
const allEmojis = ref<EmojiItem[]>([])
const searchKeyword = ref('')
const currentPage = ref(1)
const pageSize = ref(12)

// 对话框状态
const showAddDialog = ref(false)
const showEditDialog = ref(false)
const editingTag = ref<TagInfo | null>(null)

const tagForm = reactive({
    name: ''
})

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
        const [allTagsData, emojisData] = await Promise.all([
            send('emojiluna/getAllTags'),
            send('emojiluna/getEmojiList', {})
        ])

        allEmojis.value = emojisData || []

        // 构建标签使用统计
        const tagUsageMap = new Map<string, TagInfo>()

        if (allTagsData && allTagsData.length > 0) {
            // 初始化所有标签
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
            t('common.warning'),
            {
                confirmButtonText: t('common.confirm'),
                cancelButtonText: t('common.cancel'),
                type: 'warning',
            }
        )

        // 删除标签需要从所有使用该标签的表情包中移除
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
    if (!tagForm.name.trim()) {
        ElMessage.warning('请输入标签名称')
        return
    }

    saving.value = true
    try {
        if (editingTag.value) {
            // 编辑标签 - 更新所有使用该标签的表情包
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
            // 新增标签 - 标签会在使用时自动创建，这里只是提示
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
}

// 监听添加对话框
const handleShowAddDialog = () => {
    editingTag.value = null
    tagForm.name = ''
    showEditDialog.value = true
}

// 初始化
onMounted(() => {
    loadData()
})

// 监听 showAddDialog 变化
const unwatchAddDialog = () => {
    if (showAddDialog.value) {
        handleShowAddDialog()
        showAddDialog.value = false
    }
}

// 使用 watch 替代
import { watch } from 'vue'
watch(showAddDialog, unwatchAddDialog)
</script>

<style scoped>
.tags-manager {
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
    .tags-manager {
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

    .tags-grid {
        grid-template-columns: 1fr;
        gap: 15px;
    }

    .stats {
        flex-direction: column;
        gap: 20px;
    }
}

@media (max-width: 480px) {
    .tags-manager {
        padding: 10px;
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
}
</style>
