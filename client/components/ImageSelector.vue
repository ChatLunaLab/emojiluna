<template>
  <el-dialog
    v-model="visible"
    :title="title || '选择表情包'"
    width="800px"
    class="image-selector-dialog"
    :before-close="handleClose"
    append-to-body
  >
    <div class="selector-container">
      <!-- Toolbar -->
      <div class="selector-toolbar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索表情包..."
          class="search-input"
          @keyup.enter="loadEmojis"
          clearable
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>

        <el-select v-model="filterCategory" placeholder="全部分类" clearable style="width: 150px" @change="loadEmojis">
            <el-option label="全部分类" value="" />
            <el-option
                v-for="cat in categories"
                :key="cat.name"
                :label="cat.name"
                :value="cat.name"
            />
        </el-select>
      </div>

      <!-- Grid -->
      <div class="selector-grid" v-loading="loading">
        <template v-if="emojis.length > 0">
             <EmojiCard
                v-for="emoji in emojis"
                :key="emoji.id"
                :emoji="emoji"
                :base-url="baseUrl"
                selectable
                :selected="isSelected(emoji)"
                @select="handleSelect"
                class="selector-item"
            />
        </template>
        <div v-else class="no-data">
             <el-empty description="没有找到表情包" />
        </div>
      </div>

       <!-- Pagination -->
       <div class="selector-pagination">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :total="total"
            layout="prev, pager, next"
            small
            @current-change="loadEmojis"
          />
       </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <div class="selection-info">
            已选择 {{ selectedEmojis.length }} 项
        </div>
        <div class="footer-buttons">
             <el-button @click="handleClose">取消</el-button>
             <el-button type="primary" @click="handleConfirm" :disabled="selectedEmojis.length === 0">
                确定
            </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { send } from '@koishijs/client'
import { Search } from '@element-plus/icons-vue'
import EmojiCard from './EmojiCard.vue'
import type { EmojiItem, Category, EmojiSearchOptions } from 'koishi-plugin-emojiluna'

const props = defineProps<{
  modelValue: boolean
  title?: string
  excludeCategory?: string // exclude emojis from this category
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', emojis: EmojiItem[]): void
}>()

// State
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const loading = ref(false)
const emojis = ref<EmojiItem[]>([])
const categories = ref<Category[]>([])
const selectedEmojis = ref<EmojiItem[]>([])
const baseUrl = ref('/emojiluna')

// Filter
const searchKeyword = ref('')
const filterCategory = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

// Methods
const loadData = async () => {
    try {
        const [cats, url] = await Promise.all([
            send('emojiluna/getCategories'),
            send('emojiluna/getBaseUrl')
        ])
        categories.value = cats || []
        baseUrl.value = url || '/emojiluna'
        loadEmojis()
    } catch (e) {
        console.error(e)
    }
}

const loadEmojis = async () => {
    loading.value = true
    try {
        const options: EmojiSearchOptions = {
            limit: pageSize.value,
            offset: (currentPage.value - 1) * pageSize.value
        }

        if (filterCategory.value) {
            options.category = filterCategory.value
        }

        let result
        if (searchKeyword.value.trim()) {
            // Backend search doesn't support pagination properly in current interface?
            // Reuse logic from EmojiManager
             result = await send('emojiluna/searchEmoji', searchKeyword.value.trim())
             if (filterCategory.value) {
                result = result.filter((e: EmojiItem) => e.category === filterCategory.value)
             }
             // Filter excluded category
             if (props.excludeCategory) {
                 result = result.filter((e: EmojiItem) => e.category !== props.excludeCategory)
             }

             total.value = result.length
             // Manual pagination for search result
             const start = (currentPage.value - 1) * pageSize.value
             emojis.value = result.slice(start, start + pageSize.value)

        } else {
             // If excludeCategory is set, we can't use simple pagination unless we filter client side or backend supports 'excludeCategory'
             // Backend `getEmojiList` logic:
             /*
                if (category) filter...
             */
             // It doesn't support exclusion.
             // So if excludeCategory is set, we might need to fetch all (or large batch) and filter?
             // Or better: Use `getEmojiList` but if the result contains emojis from excludeCategory, filter them out.
             // But if we filter them out, page size shrinks.
             // Given the requirements, maybe just fetch all and paginate client side?
             // Let's try fetching all for now, as it's safer for exclusion logic.
             // BUT "all" might be large.
             // Let's assume for now we just show everything mixed, and user filters by category if they want.
             // We can just filter `categories` dropdown to NOT show the excludeCategory, but emojis from other categories are fine.
             // Wait, if I want to "Import from Other Category", I select a category.
             // The default "All" view should probably show everything EXCEPT current category.

             const allEmojis = await send('emojiluna/getEmojiList', {})
             let filtered = allEmojis || []

             if (props.excludeCategory) {
                 filtered = filtered.filter((e: EmojiItem) => e.category !== props.excludeCategory)
             }

             if (filterCategory.value) {
                 filtered = filtered.filter((e: EmojiItem) => e.category === filterCategory.value)
             }

             total.value = filtered.length
             const start = (currentPage.value - 1) * pageSize.value
             emojis.value = filtered.slice(start, start + pageSize.value)
        }

    } catch (e) {
        console.error(e)
    } finally {
        loading.value = false
    }
}

const isSelected = (emoji: EmojiItem) => {
    return selectedEmojis.value.some(e => e.id === emoji.id)
}

const handleSelect = (emoji: EmojiItem) => {
    const index = selectedEmojis.value.findIndex(e => e.id === emoji.id)
    if (index > -1) {
        selectedEmojis.value.splice(index, 1)
    } else {
        selectedEmojis.value.push(emoji)
    }
}

const handleClose = () => {
    selectedEmojis.value = []
    emit('update:modelValue', false)
}

const handleConfirm = () => {
    emit('confirm', [...selectedEmojis.value])
    handleClose()
}

watch(visible, (val) => {
    if (val) {
        loadData()
        selectedEmojis.value = []
        searchKeyword.value = ''
        filterCategory.value = ''
        currentPage.value = 1
    }
})
</script>

<style scoped>
.selector-container {
    height: 60vh;
    display: flex;
    flex-direction: column;
}

.selector-toolbar {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
}

.selector-grid {
    flex: 1;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 12px;
    padding: 4px;
    align-content: start;
}

.selector-item {
    height: 100px;
}

.selector-pagination {
    display: flex;
    justify-content: center;
    padding-top: 12px;
}

.dialog-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.selection-info {
    font-weight: 500;
    color: var(--k-color-primary);
}
</style>
