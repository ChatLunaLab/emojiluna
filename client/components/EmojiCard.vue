<template>
  <div class="emoji-card" @click="$emit('click', emoji)">
    <div class="emoji-image-container">
      <img
        :src="emojiUrl"
        :alt="emoji.name"
        class="emoji-image"
        @error="handleImageError"
      />
      <div class="emoji-overlay">
        <el-button
          type="primary"
          size="small"
          @click.stop="$emit('edit', emoji)"
          circle
        >
          <el-icon><Edit /></el-icon>
        </el-button>
        <el-button
          type="danger"
          size="small"
          @click.stop="$emit('delete', emoji)"
          circle
        >
          <el-icon><Delete /></el-icon>
        </el-button>
      </div>
    </div>
    <div class="emoji-info">
      <div class="emoji-name">{{ emoji.name }}</div>
      <div class="emoji-category">{{ emoji.category }}</div>
      <div class="emoji-tags" v-if="emoji.tags.length > 0">
        <el-tag
          v-for="tag in emoji.tags.slice(0, 3)"
          :key="tag"
          size="small"
          type="info"
        >
          {{ tag }}
        </el-tag>
        <el-tag v-if="emoji.tags.length > 3" size="small" type="info">
          +{{ emoji.tags.length - 3 }}
        </el-tag>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Edit, Delete } from '@element-plus/icons-vue'
import type { EmojiItem } from '../types'

interface Props {
  emoji: EmojiItem
  baseUrl?: string
}

interface Emits {
  (e: 'click', emoji: EmojiItem): void
  (e: 'edit', emoji: EmojiItem): void
  (e: 'delete', emoji: EmojiItem): void
}

const props = withDefaults(defineProps<Props>(), {
  baseUrl: '/emojiluna'
})

defineEmits<Emits>()

const emojiUrl = computed(() => {
  return `${props.baseUrl}/get/${props.emoji.name}`
})

const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0zMiAyMEM0Mi40IDIwIDQ0IDMwIDQ0IDMwQzQ0IDMwIDQyLjQgNDAgMzIgNDBDMjEuNiA0MCAyMCAzMCAyMCAzMEMyMCAzMCAyMS42IDIwIDMyIDIwWiIgZmlsbD0iI0NDQ0NDQyIvPgo8L3N2Zz4K'
}
</script>

<style scoped>
.emoji-card {
  background: var(--k-color-surface);
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid var(--k-border-color);
  position: relative;
  transition: all 0.3s ease;
}

.emoji-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.emoji-image-container {
  position: relative;
  width: 100%;
  height: 150px;
  overflow: hidden;
}

.emoji-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.emoji-card:hover .emoji-image {
  transform: scale(1.05);
}

.emoji-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.emoji-card:hover .emoji-overlay {
  opacity: 1;
}

.emoji-info {
  padding: 12px;
}

.emoji-name {
  font-weight: 600;
  font-size: 0.9em;
  margin-bottom: 4px;
  color: var(--k-color-text-1);
  word-break: break-word;
}

.emoji-category {
  font-size: 0.8em;
  color: var(--k-color-text-2);
  margin-bottom: 8px;
}

.emoji-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.emoji-tags .el-tag {
  font-size: 0.7em;
}

@media (max-width: 768px) {
  .emoji-image-container {
    height: 120px;
  }

  .emoji-info {
    padding: 10px;
  }

  .emoji-name {
    font-size: 0.85em;
  }

  .emoji-category {
    font-size: 0.75em;
  }
}
</style>
