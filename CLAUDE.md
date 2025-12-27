# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **koishi-plugin-emojiluna**, a smart emoji management plugin for the Koishi chatbot framework. It provides AI-powered emoji categorization, storage management, and a Vue.js-based web interface.

## Development Commands

### Build and Development
```bash
# Build the project using Yakumo
yarn yakumo build
# or
yarn build

# Development workflow
yarn dep         # Upgrade dependencies
yarn bump        # Version management
yarn pub         # Publish to npm
```

### Code Quality
```bash
# Lint TypeScript files
yarn eslint src --ext=ts
# or
yarn lint

# Auto-fix linting issues
yarn eslint src --ext=ts --fix
# or
yarn lint-fix
```

## Architecture

### Core Components

1. **Service Layer** (`src/service.ts`): Main `EmojiLunaService` that handles:
   - Emoji storage and management
   - AI integration with ChatLuna
   - Database operations (emojiluna_emojis, emojiluna_categories tables)
   - File system operations for emoji storage

2. **Configuration** (`src/config.ts`): Comprehensive configuration schema including:
   - AI model settings and prompts
   - Storage and categorization options
   - Auto-collection and trigger settings
   - Backend API configuration

3. **Commands** (`src/commands.ts`): CLI commands for emoji management
   - Basic emoji retrieval and search
   - Image upload handling with AI analysis
   - Category and tag management

4. **Backend API** (`src/backend.ts`): HTTP endpoints for web interface integration

5. **Auto Collector** (`src/autoCollector.ts`): Automated emoji collection from group chats

### Frontend Architecture

- **Vue 3 + Element Plus** web interface in `client/` directory
- **TypeScript** throughout with strict configuration
- **Component structure**: Home, Tags, Categories views
- **Integration** with Koishi's client framework

### Key Dependencies

- **Koishi**: Core chatbot framework
- **ChatLuna**: AI integration for emoji analysis and categorization
- **@langchain/core**: AI model abstraction
- **Element Plus**: Vue UI components
- **Vue Router & i18n**: Frontend navigation and internationalization

### Database Schema

- `emojiluna_emojis`: Main emoji storage (id, name, category, path, size, tags, created_at)
- `emojiluna_categories`: Category management (id, name, description, emoji_count, created_at)

### AI Integration

The plugin integrates with ChatLuna for:
- **Automatic categorization**: AI analyzes images to suggest categories
- **Content analysis**: AI generates names, descriptions, and tags
- **Batch processing**: AI re-categorization of existing emojis

### File Structure

- `src/`: TypeScript source code
- `client/`: Vue.js frontend components
- `lib/`: Compiled TypeScript output
- `dist/`: Frontend build output

## Configuration Notes

- Uses **Yakumo** build system with esbuild
- **ESLint** with TypeScript, Standard, and Prettier rules
- **Node 18+** requirement
- Supports both **CommonJS** output and **ES modules**

## Testing

No specific test configuration found. Tests would likely use the Yakumo mocha integration mentioned in devDependencies.

## Important Implementation Details

- Emoji files are stored as PNG with UUID filenames
- AI prompts are highly customizable through configuration
- Supports automatic emoji collection from whitelisted groups
- Includes trigger word matching for automatic emoji responses
- Web interface provides comprehensive management capabilities

## Frontend Component Structure

### Main Pages
- **dashboard.vue**: Main control panel with three-tab navigation (Emoji Manager, Category Manager, Tag Manager)
- **EmojiManager.vue**: Main emoji management page with search, filter, batch operations, and preview
- **CategoriesManager.vue**: Category management page displaying category grid, click to enter category detail
- **TagsManager.vue**: Tag management page displaying tag grid, click to enter tag detail

### Detail Pages
- **CategoryDetail.vue**: Category detail page showing all emojis in the category, supports import/upload/batch move/delete
- **TagDetail.vue**: Tag detail page showing all emojis with the tag, supports add/remove tag/batch delete

### Common Components
- **EmojiCard.vue**: Emoji card component with selection mode and hover actions
- **EmojiDialog.vue**: Edit emoji dialog for modifying category and tags
- **AddEmojiDialog.vue**: Add emoji dialog supporting file upload and URL modes
- **ImageSelector.vue**: Image selector for importing from existing emojis

### Icons
- **emoji.vue**: Emoji icon component

## Backend API Endpoints

Called via `@koishijs/client`'s `send` function:

### Emoji Operations
- `emojiluna/getEmojiList(options)` - Get emoji list (supports pagination, category, tag filtering)
- `emojiluna/searchEmoji(keyword)` - Search emojis
- `emojiluna/addEmoji(emojiData)` - Add single emoji
- `emojiluna/addEmojis(emojisData[], aiAnalysis)` - Batch add emojis
- `emojiluna/deleteEmoji(id)` - Delete emoji
- `emojiluna/updateEmojiCategory(id, category)` - Update emoji category
- `emojiluna/updateEmojiTags(id, tags)` - Update emoji tags
- `emojiluna/analyzeEmoji(id)` - AI analyze emoji

### Category Operations
- `emojiluna/getCategories()` - Get all categories
- `emojiluna/createCategory(name, description?)` - Create category
- `emojiluna/deleteCategory(name)` - Delete category

### Tag Operations
- `emojiluna/getAllTags()` - Get all tags

### Other
- `emojiluna/getBaseUrl()` - Get base URL for emoji access

## Key Types

```typescript
interface EmojiItem {
  id: string
  name: string
  category: string
  tags: string[]
  size?: number
}

interface Category {
  name: string
  description?: string
  emojiCount: number
}

interface EmojiAddOptions {
  name: string
  category: string
  tags: string[]
  imageData: string  // base64 encoded image data
  mimeType?: string
}

interface EmojiSearchOptions {
  category?: string
  tags?: string[]
  limit?: number
  offset?: number
}
```

## UI Patterns

### Selection Mode
- Click selection button to enter selection mode, cards become selectable
- After selection, floating action bar appears at bottom for batch move and delete

### Dialogs
- Uses Element Plus `el-dialog` component
- Forms use `el-form` with validation rules
- Supports creatable dropdown selects (categories, tags)

### Grid Layout
- Uses CSS Grid with auto-fill layout
- Responsive breakpoints for mobile adaptation

### Navigation
- Right-side floating navigation bar, expands on hover to show text
- On mobile, becomes fixed bottom navigation bar