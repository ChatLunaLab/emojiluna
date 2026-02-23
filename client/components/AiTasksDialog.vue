<template>
    <el-dialog
        :model-value="modelValue"
        @update:model-value="$emit('update:modelValue', $event)"
        :title="t('emojiluna.aiTasksDetails', 'AI 任务详情')"
        width="600px"
        @open="fetchTasks"
    >
        <div class="ai-tasks-dialog">
            <div class="ai-tasks-header">
                <el-form inline>
                    <el-form-item
                        :label="
                            t('emojiluna.aiTotalSwitch', '全局 AI 暂停/恢复')
                        "
                    >
                        <el-switch
                            v-model="internalPaused"
                            :active-text="t('emojiluna.aiPaused', '已暂停')"
                            :inactive-text="t('emojiluna.aiRunning', '运行中')"
                            style="
                                --el-switch-on-color: #ff4949;
                                --el-switch-off-color: #13ce66;
                            "
                            @change="togglePaused"
                        />
                    </el-form-item>
                    <el-form-item>
                        <el-button @click="fetchTasks" circle>
                            <el-icon><Refresh /></el-icon>
                        </el-button>
                    </el-form-item>
                </el-form>
            </div>

            <el-table
                :data="tasks"
                v-loading="loading"
                height="400"
                empty-text="当前无 AI 任务"
            >
                <el-table-column width="60" align="center">
                    <template #default="{ row }">
                        <img
                            :src="`${baseUrl}/get/${row.emojiId}`"
                            class="task-emoji-img"
                            @error="handleImgError"
                        />
                    </template>
                </el-table-column>
                <el-table-column
                    :label="t('emojiluna.emojiName', '名称')"
                    prop="name"
                    min-width="120"
                >
                    <template #default="{ row }">
                        <div class="task-name" :title="row.name || row.emojiId">
                            {{
                                row.name ||
                                (row.emojiId && row.emojiId.slice(0, 8)) ||
                                '未知'
                            }}
                        </div>
                    </template>
                </el-table-column>
                <el-table-column
                    :label="t('emojiluna.status', '状态')"
                    width="100"
                >
                    <template #default="{ row }">
                        <el-tag
                            :type="getStatusType(row.status)"
                            effect="light"
                            size="small"
                        >
                            {{ getStatusText(row.status) }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column
                    :label="t('emojiluna.info', '信息')"
                    min-width="150"
                    show-overflow-tooltip
                >
                    <template #default="{ row }">
                        <span class="error-text" v-if="row.error">
                            {{ row.error }}
                        </span>
                        <span
                            v-else-if="row.status === 'succeeded'"
                            class="success-text"
                        >
                            {{ t('emojiluna.completed', '已完成') }}
                        </span>
                        <span v-else class="info-text">--</span>
                    </template>
                </el-table-column>
                <el-table-column
                    :label="t('common.actions', '操作')"
                    width="100"
                    fixed="right"
                >
                    <template #default="{ row }">
                        <el-button-group>
                            <el-button
                                v-if="row.status === 'failed'"
                                size="small"
                                type="primary"
                                :title="t('emojiluna.retry', '重试')"
                                @click="retryTask(row)"
                            >
                                <el-icon><RefreshRight /></el-icon>
                            </el-button>
                            <el-button
                                size="small"
                                type="danger"
                                :title="t('common.delete', '删除')"
                                @click="deleteTask(row)"
                            >
                                <el-icon><Delete /></el-icon>
                            </el-button>
                        </el-button-group>
                    </template>
                </el-table-column>
            </el-table>
        </div>
    </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { send } from '@koishijs/client'
import { ElMessage } from 'element-plus'
import { Refresh, RefreshRight, Delete } from '@element-plus/icons-vue'
import type { AITaskDetail } from 'koishi-plugin-emojiluna'

const props = defineProps<{
    modelValue: boolean
    paused: boolean
    baseUrl: string
}>()

const emit = defineEmits([
    'update:modelValue',
    'update:paused',
    'refresh-stats'
])
const { t } = useI18n()

const loading = ref(false)
const tasks = ref<AITaskDetail[]>([])
const internalPaused = ref(props.paused)
let pollTimer: any = null

watch(
    () => props.paused,
    (val) => {
        internalPaused.value = val
    }
)

watch(
    () => props.modelValue,
    (val) => {
        if (val) {
            startPolling()
        } else {
            stopPolling()
        }
    }
)

const startPolling = () => {
    fetchTasks()
    pollTimer = setInterval(fetchTasks, 3000)
}

const stopPolling = () => {
    if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
    }
}

onUnmounted(() => {
    stopPolling()
})

const fetchTasks = async () => {
    try {
        loading.value = true
        tasks.value = (await send('emojiluna/getAiTasksAll')) || []
    } catch (e) {
        console.warn('Failed to fetch tasks', e)
    } finally {
        loading.value = false
    }
}

const togglePaused = async (val: boolean) => {
    try {
        await send('emojiluna/setAiPaused', !!val)
        emit('update:paused', val)
        emit('refresh-stats')
        ElMessage.success(
            val
                ? t('emojiluna.aiPausedMsg', 'AI 已暂停')
                : t('emojiluna.aiResumedMsg', 'AI 已恢复')
        )
    } catch (e) {
        internalPaused.value = props.paused
        ElMessage.error(
            `${t('emojiluna.setFailed', '设置失败')}: ${e?.message || e}`
        )
    }
}

const getStatusType = (status: string) => {
    switch (status) {
        case 'pending':
            return 'info'
        case 'processing':
            return 'primary'
        case 'succeeded':
            return 'success'
        case 'failed':
            return 'danger'
        default:
            return 'info'
    }
}

const getStatusText = (status: string) => {
    switch (status) {
        case 'pending':
            return t('emojiluna.aiPending', '等待中')
        case 'processing':
            return t('emojiluna.aiRunning', '处理中')
        case 'succeeded':
            return t('emojiluna.aiSucceeded', '已完成')
        case 'failed':
            return t('emojiluna.aiFailed', '失败')
        default:
            return status
    }
}

const retryTask = async (task: AITaskDetail) => {
    try {
        await send('emojiluna/retryAiTask', task.emojiId)
        ElMessage.success(t('emojiluna.taskRequeued', '已加入重试队列'))
        fetchTasks()
        emit('refresh-stats')
    } catch (e) {
        ElMessage.error(
            `${t('emojiluna.retryFailed', '重试失败')}: ${e.message}`
        )
    }
}

const deleteTask = async (task: AITaskDetail) => {
    try {
        await send('emojiluna/deleteAiTask', task.emojiId)
        fetchTasks()
        emit('refresh-stats')
    } catch (e) {
        ElMessage.error(`${t('common.deleteFailed', '删除失败')}: ${e.message}`)
    }
}

const handleImgError = (e: Event) => {
    const target = e.target as HTMLImageElement
    target.style.display = 'none'
}
</script>

<style scoped>
.ai-tasks-header {
    margin-bottom: 10px;
}
.task-emoji-img {
    width: 32px;
    height: 32px;
    object-fit: cover;
    border-radius: 4px;
}
.task-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.error-text {
    color: var(--el-color-danger);
    font-size: 0.9em;
}
.success-text {
    color: var(--el-color-success);
    font-size: 0.9em;
}
.info-text {
    color: var(--el-text-color-secondary);
    font-size: 0.9em;
}
</style>
