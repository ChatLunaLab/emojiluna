<template>
  <k-layout>
    <el-scrollbar>
      <div class="dashboard">
       

        <!-- 标签栏 -->
        <div class="dashboard-tabs-container">
          <el-tabs 
            v-model="activeTab" 
            type="card" 
            class="dashboard-tabs"
          
          >
            <!-- 表情包管理 -->
            <el-tab-pane name="emojis">
              <template #label>
                <span class="tab-label">
                  <el-icon><Picture /></el-icon>
                  {{ t('emojiluna.tabs.emojis') }}
                </span>
              </template>
              <div class="tab-content">
                <EmojiManager 
                />
              </div>
            </el-tab-pane>

            <!-- 标签管理 -->
            <el-tab-pane name="tags">
              <template #label>
                <span class="tab-label">
                  <el-icon><PriceTag /></el-icon>
                  {{ t('emojiluna.tabs.tags') }}
                </span>
              </template>
              <div class="tab-content">
                <TagsManager />
              </div>
            </el-tab-pane>

            <!-- 分类管理 -->
            <el-tab-pane name="categories">
              <template #label>
                <span class="tab-label">
                  <el-icon><FolderOpened /></el-icon>
                  {{ t('emojiluna.tabs.categories') }}
                </span>
              </template>
              <div class="tab-content">
                <CategoriesManager />
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </div>
    </el-scrollbar>
  </k-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Picture, PriceTag, FolderOpened } from '@element-plus/icons-vue'
import EmojiManager from './components/EmojiManager.vue'
import TagsManager from './components/TagsManager.vue'
import CategoriesManager from './components/CategoriesManager.vue'
import Emoji from './icons/emoji.vue'

const { t } = useI18n()

// 当前活动的标签页
const activeTab = ref('emojis')



</script>

<style scoped>
.dashboard {
  min-height: 100vh;
}


.dashboard-tabs-container {
  padding: 0 32px;
}

.dashboard-tabs {
  overflow: hidden;
  box-shadow: var(--k-card-shadow);
}

.dashboard-tabs :deep(.el-tabs__header) {
  margin: 0;
  background: var(--k-card-bg);
  border-bottom: 1px solid var(--k-color-divider);
}

.dashboard-tabs :deep(.el-tabs__nav) {
  border: none;
}

.dashboard-tabs :deep(.el-tabs__item) {
  border: none;
  border-radius: 0;
  padding: 16px 24px;
  font-size: 14px;
  font-weight: 500;
  color: var(--k-text-normal);
  background: var(--k-card-bg);
  transition: all 0.3s ease;
}

.dashboard-tabs :deep(.el-tabs__item:hover) {
  color: var(--k-color-primary);
  background: var(--k-hover-bg);
}

.dashboard-tabs :deep(.el-tabs__item.is-active) {
  color: var(--k-color-primary);
  background: var(--k-activity-bg);
  border-bottom: 2px solid var(--k-color-primary);
}

.dashboard-tabs :deep(.el-tabs__content) {
  background: var(--k-card-bg);
  min-height: 600px;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab-content {
  padding: 24px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .dashboard-header {
    padding: 20px 16px;
  }

  .header-content {
    flex-direction: column;
    text-align: center;
    gap: 12px;
  }

  .header-icon {
    width: 56px;
    height: 56px;
  }

  .header-text h1 {
    font-size: 24px;
  }

  .dashboard-tabs-container {
    padding: 0 16px;
  }

  .dashboard-tabs :deep(.el-tabs__item) {
    padding: 12px 16px;
    font-size: 13px;
  }

  .tab-content {
    padding: 16px;
  }
}

@media (max-width: 480px) {
  .dashboard-header {
    padding: 16px 12px;
  }

  .header-icon {
    width: 48px;
    height: 48px;
  }

  .header-text h1 {
    font-size: 20px;
  }

  .dashboard-tabs-container {
    padding: 0 12px;
  }

  .dashboard-tabs :deep(.el-tabs__item) {
    padding: 10px 12px;
    font-size: 12px;
  }

  .tab-label {
    gap: 4px;
  }

  .tab-content {
    padding: 12px;
  }
}

/* 自定义滚动条 */
:deep(.el-scrollbar__wrap) {
  overflow-x: hidden;
}

:deep(.el-scrollbar__bar) {
  border-radius: 4px;
}

:deep(.el-scrollbar__thumb) {
  background: rgba(144, 147, 153, 0.3);
  border-radius: 4px;
}

:deep(.el-scrollbar__thumb:hover) {
  background: rgba(144, 147, 153, 0.5);
}
</style>
