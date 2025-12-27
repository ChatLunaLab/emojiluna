<template>
    <k-layout>
        <div class="dashboard-container">
            <!-- Main Content Area -->
            <div class="main-content">
                <el-scrollbar>
                    <div class="content-wrapper">
                        <Transition name="fade-slide" mode="out-in">
                            <div
                                v-if="activeTab === 'emojis'"
                                key="emojis"
                                class="view-container"
                            >
                                <EmojiManager />
                            </div>

                            <div
                                v-else-if="activeTab === 'categories'"
                                key="categories"
                                class="view-container"
                            >
                                <CategoryDetail
                                    v-if="showCategoryDetail"
                                    :category="currentCategory"
                                    @back="handleBackToCategories"
                                />
                                <CategoriesManager
                                    v-else
                                    @category-click="handleCategoryClick"
                                />
                            </div>

                            <div
                                v-else-if="activeTab === 'tags'"
                                key="tags"
                                class="view-container"
                            >
                                <TagDetail
                                    v-if="showTagDetail"
                                    :tag-name="currentTag"
                                    @back="handleBackToTags"
                                />
                                <TagsManager
                                    v-else
                                    @tag-click="handleTagClick"
                                />
                            </div>
                        </Transition>
                    </div>
                </el-scrollbar>
            </div>

            <!-- Side Navigation Bar (Floating) -->
            <div class="side-nav">
                <div class="nav-segment">
                    <div
                        class="nav-item"
                        :class="{ active: activeTab === 'emojis' }"
                        @click="handleTabChange('emojis')"
                    >
                        <el-icon :size="24"><Picture /></el-icon>
                        <span class="nav-label">
                            {{ t('emojiluna.tabs.emojis') }}
                        </span>
                    </div>
                    <div
                        class="nav-item"
                        :class="{ active: activeTab === 'categories' }"
                        @click="handleTabChange('categories')"
                    >
                        <el-icon :size="24"><FolderOpened /></el-icon>
                        <span class="nav-label">
                            {{ t('emojiluna.tabs.categories') }}
                        </span>
                    </div>
                    <div
                        class="nav-item"
                        :class="{ active: activeTab === 'tags' }"
                        @click="handleTabChange('tags')"
                    >
                        <el-icon :size="24"><PriceTag /></el-icon>
                        <span class="nav-label">
                            {{ t('emojiluna.tabs.tags') }}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </k-layout>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Picture, PriceTag, FolderOpened } from '@element-plus/icons-vue'
import EmojiManager from './components/EmojiManager.vue'
import TagsManager from './components/TagsManager.vue'
import CategoriesManager from './components/CategoriesManager.vue'
import CategoryDetail from './components/CategoryDetail.vue'
import TagDetail from './components/TagDetail.vue'
import Emoji from './icons/emoji.vue'
import type { Category } from 'koishi-plugin-emojiluna'

const { t } = useI18n()

// Navigation state
const activeTab = ref('emojis')

// Category detail state
const showCategoryDetail = ref(false)
const currentCategory = ref<Category | null>(null)

// Tag detail state
const showTagDetail = ref(false)
const currentTag = ref('')

const handleTabChange = (tab: string) => {
    activeTab.value = tab
}

const handleCategoryClick = (category: Category) => {
    currentCategory.value = category
    showCategoryDetail.value = true
}

const handleBackToCategories = () => {
    showCategoryDetail.value = false
    currentCategory.value = null
}

const handleTagClick = (tag: string) => {
    currentTag.value = tag
    showTagDetail.value = true
}

const handleBackToTags = () => {
    showTagDetail.value = false
    currentTag.value = ''
}

watch(activeTab, (newTab) => {
    if (newTab !== 'categories') {
        handleBackToCategories()
    }
    if (newTab !== 'tags') {
        handleBackToTags()
    }
})
</script>

<style scoped>
.dashboard-container {
    position: relative;
    height: 100vh;
    background-color: var(--k-color-base);
    color: var(--k-color-text);
    overflow: hidden;
}

.main-content {
    height: 100%;
    width: 100%;
}

.content-wrapper {
    padding: 24px 80px 24px 24px; /* Right padding to avoid overlap with floating nav */
    max-width: 1600px;
    margin: 0 auto;
}

.view-container {
    min-height: 500px;
}

/* Side Navigation (Floating) */
.side-nav {
    position: fixed;
    right: 24px;
    top: 50%;
    transform: translateY(-50%);
    background: color-mix(in srgb, var(--k-color-surface-1), transparent 20%);
    backdrop-filter: blur(8px);
    border: 1px solid var(--k-color-divider);
    border-radius: 16px;
    padding: 12px;
    z-index: 100;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    width: 42px; /* Collapsed width */
    overflow: hidden;
}

.side-nav:hover {
    width: 180px; /* Expanded width */
}

.nav-segment {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.nav-item {
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    padding: 0 8px; /* Inner padding */
    cursor: pointer;
    color: var(--k-text-light);
    transition: all 0.2s ease;
    white-space: nowrap;
    position: relative;
}

.nav-item:hover {
    background-color: var(--k-hover-bg);
    color: var(--k-color-text);
}

.nav-item.active {
    background-color: var(--k-color-primary);
    color: white;
    box-shadow: 0 2px 8px rgba(var(--k-color-primary-rgb), 0.3);
}

.nav-item .el-icon {
    flex-shrink: 0;
    /* Center the icon when collapsed */
    margin: 0 auto;
    transition: margin 0.3s ease;
}

.side-nav:hover .nav-item .el-icon {
    /* When expanded, icon moves to left (via flex gap/margin reset) */
    margin: 0;
    margin-right: 12px;
}

.nav-label {
    opacity: 0;
    transform: translateX(10px);
    transition: all 0.3s ease;
    font-size: 14px;
    font-weight: 500;
}

.side-nav:hover .nav-label {
    opacity: 1;
    transform: translateX(0);
}

/* Responsive */
@media (max-width: 768px) {
    .content-wrapper {
        padding: 16px;
        padding-bottom: 80px; /* Space for bottom nav */
    }

    .side-nav {
        top: auto;
        bottom: 20px;
        right: 50%;
        transform: translateX(50%);
        width: auto;
        flex-direction: row;
        padding: 8px 16px;
        border-radius: 30px; /* Pill shape on mobile */
    }

    .side-nav:hover {
        width: auto; /* No expansion on hover for mobile usually */
    }

    .nav-segment {
        flex-direction: row;
        gap: 20px;
    }

    .nav-item {
        padding: 0;
        height: auto;
        background: transparent !important; /* Remove background on mobile items */
        box-shadow: none !important;
        color: var(--k-text-light);
    }

    .nav-item.active {
        color: var(--k-color-primary);
    }

    .nav-label {
        display: none;
    }

    .nav-item .el-icon {
        margin: 0;
    }
}
</style>
