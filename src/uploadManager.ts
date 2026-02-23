import { Context } from 'koishi'
import { Config } from './config'
import fs from 'fs/promises'
import path from 'path'
import { createHash, randomUUID } from 'crypto'
import { getImageType } from './utils'

interface AIAnalysisResult {
    name: string
    category: string
    tags: string[]
    description?: string
    newCategory?: string
}

interface CachedAIResult {
    hash: string
    result: AIAnalysisResult
    timestamp: number
}

export interface AITask {
    id: string
    emojiId: string
    imagePath: string
    imageHash: string
    attempts: number
    nextRetryAt?: number
}

/**
 * Callback interface for AI task processing.
 * The service implements this to handle actual AI analysis and emoji updates.
 */
export interface AITaskProcessor {
    /** Run AI analysis on a base64-encoded image, returning the result. */
    analyzeEmoji(imageBase64: string): Promise<AIAnalysisResult | null>
    /** Update emoji metadata after successful AI analysis. */
    updateEmojiInfo(
        id: string,
        updates: Partial<{ name: string; category: string; tags: string[] }>
    ): Promise<boolean>
    /** Get emoji data by ID (returns null if not found). */
    getEmojiById(id: string): Promise<{
        id: string
        name: string
        category: string
        tags: string[]
        path: string
    } | null>
}

/**
 * UploadManager handles emoji upload orchestration, deduplication,
 * file management, and AI task queue management. Maintains in-memory caches
 * to avoid repeated database queries during bulk uploads.
 */
export class UploadManager {
    private ctx: Context
    private config: Config
    private emojiHashes: Set<string> = new Set()
    private emojiHashMap: Map<string, string> = new Map() // hash -> emoji id
    private aiResultCache: Map<string, CachedAIResult> = new Map() // hash -> cached result
    private readonly MAX_CACHE_SIZE = 1000
    private readonly CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

    // AI task queue state
    private _aiPaused = false
    private _aiTaskQueue: AITask[] = []
    private _processingSet: Set<string> = new Set()
    private _localActiveCount = 0
    private _aiSucceededCount = 0
    private _aiFailedIds: Set<string> = new Set()
    private _isDisposed = false
    private _taskProcessor: AITaskProcessor | null = null

    constructor(ctx: Context, config: Config) {
        this.ctx = ctx
        this.config = config

        ctx.on('dispose', () => {
            this._isDisposed = true
        })
    }

    /**
     * Set the AI task processor callback.
     * Must be called before starting the task processor loop.
     */
    setTaskProcessor(processor: AITaskProcessor): void {
        this._taskProcessor = processor
    }

    // ─── Hash & Deduplication ───────────────────────────────────────────

    /**
     * Load existing emoji hashes into memory cache.
     * Called during initialization to populate the hash set.
     */
    async loadExistingHashes(): Promise<void> {
        try {
            const emojis = await this.ctx.database.get(
                'emojiluna_emojis',
                {},
                {
                    limit: 10000,
                    fields: ['id', 'image_hash']
                }
            )
            if (emojis && emojis.length > 0) {
                for (const emoji of emojis) {
                    if (emoji.image_hash) {
                        this.emojiHashes.add(emoji.image_hash)
                        this.emojiHashMap.set(emoji.image_hash, emoji.id)
                    }
                }
            }
            this.ctx.logger.info(
                `UploadManager: Loaded ${this.emojiHashes.size} existing emoji hashes`
            )
        } catch (err) {
            this.ctx.logger.warn(
                `UploadManager: Failed to load existing hashes: ${err?.message || err}`
            )
        }
    }

    /**
     * Calculate SHA256 hash of buffer content.
     */
    calculateHash(buffer: Buffer): string {
        return createHash('sha256').update(buffer).digest('hex')
    }

    /**
     * Validate a new emoji before upload.
     * Returns: null if valid, error message if invalid
     */
    async validateNewEmoji(
        imageData: Buffer,
        imageHash: string
    ): Promise<string | null> {
        if (this.emojiHashes.has(imageHash)) {
            const existingId = this.emojiHashMap.get(imageHash)
            return `Emoji with this content already exists (ID: ${existingId})`
        }

        try {
            const existing = await this.ctx.database.get('emojiluna_emojis', {
                image_hash: imageHash
            })
            if (existing && existing.length > 0) {
                this.emojiHashes.add(imageHash)
                this.emojiHashMap.set(imageHash, existing[0].id)
                return `Emoji with this content already exists (ID: ${existing[0].id})`
            }
        } catch (err) {
            this.ctx.logger.warn(
                `UploadManager: Database validation failed: ${err?.message || err}`
            )
        }

        const mimeType = getImageType(imageData)
        if (!mimeType) {
            return 'Invalid image format'
        }

        return null
    }

    /**
     * Register an emoji after successful upload.
     */
    registerEmoji(id: string, imageHash: string): void {
        this.emojiHashes.add(imageHash)
        this.emojiHashMap.set(imageHash, id)
    }

    // ─── File Management ────────────────────────────────────────────────

    /**
     * Prepare emoji file for upload.
     * Saves buffer to temporary location, returns path.
     */
    async prepareUploadFile(
        imageData: Buffer
    ): Promise<{ path: string; id: string; extension: string }> {
        const id = randomUUID()
        const extension = getImageType(imageData, true)
        const tempDir = path.join(this.ctx.baseDir, '.temp')

        try {
            await fs.mkdir(tempDir, { recursive: true })
        } catch (_) {}

        const tempPath = path.join(tempDir, `${id}-upload-temp`)
        await fs.writeFile(tempPath, imageData)

        return { path: tempPath, id, extension }
    }

    /**
     * Move file from temporary location to final storage.
     * Handles cross-device issues (EXDEV).
     */
    async finalizeFile(sourcePath: string, destPath: string): Promise<void> {
        try {
            await fs.rename(sourcePath, destPath)
        } catch (error) {
            if (error.code === 'EXDEV') {
                await fs.copyFile(sourcePath, destPath)
                try {
                    await fs.unlink(sourcePath)
                } catch (_) {}
            } else {
                throw error
            }
        }
    }

    /**
     * Clean up temporary upload file.
     */
    async cleanupTempFile(tempPath: string): Promise<void> {
        try {
            await fs.unlink(tempPath)
        } catch (_) {}
    }

    /**
     * Batch validate multiple emojis.
     */
    async validateBatch(
        emojis: { buffer: Buffer; hash: string }[]
    ): Promise<{ valid: boolean; error?: string }[]> {
        const results = []
        for (const emoji of emojis) {
            const error = await this.validateNewEmoji(emoji.buffer, emoji.hash)
            results.push({ valid: !error, error })
        }
        return results
    }

    // ─── AI Result Cache ────────────────────────────────────────────────

    /**
     * Cache AI analysis result in memory.
     */
    cacheAIResult(hash: string, result: AIAnalysisResult): void {
        if (this.aiResultCache.size >= this.MAX_CACHE_SIZE) {
            const oldestKey = Array.from(this.aiResultCache.entries()).sort(
                (a, b) => a[1].timestamp - b[1].timestamp
            )[0][0]
            this.aiResultCache.delete(oldestKey)
        }

        this.aiResultCache.set(hash, {
            hash,
            result,
            timestamp: Date.now()
        })
    }

    /**
     * Retrieve cached AI analysis result if available and not expired.
     */
    getCachedAIResult(hash: string): AIAnalysisResult | null {
        const cached = this.aiResultCache.get(hash)
        if (!cached) return null

        if (Date.now() - cached.timestamp > this.CACHE_TTL_MS) {
            this.aiResultCache.delete(hash)
            return null
        }

        return cached.result
    }

    /**
     * Clear all memory caches.
     */
    clearCache(): void {
        this.emojiHashes.clear()
        this.emojiHashMap.clear()
        this.aiResultCache.clear()
    }

    /**
     * Get cache statistics.
     */
    getCacheStats(): { hashCount: number; aiResultCacheCount: number } {
        return {
            hashCount: this.emojiHashes.size,
            aiResultCacheCount: this.aiResultCache.size
        }
    }

    // ─── AI Task Queue Management ───────────────────────────────────────

    /**
     * Queue an AI analysis task for background processing.
     */
    queueAIAnalysis(
        emojiId: string,
        imagePath: string,
        imageHash: string
    ): void {
        this._aiTaskQueue.push({
            id: randomUUID(),
            emojiId,
            imagePath,
            imageHash,
            attempts: 0
        })
    }

    /**
     * Get current AI task statistics.
     */
    getAITaskStats(): {
        pending: number
        processing: number
        succeeded: number
        failed: number
        paused: boolean
    } {
        return {
            pending: this._aiTaskQueue.length,
            processing: this._processingSet.size,
            succeeded: this._aiSucceededCount,
            failed: this._aiFailedIds.size,
            paused: this._aiPaused
        }
    }

    /**
     * Get list of emoji IDs that have failed AI analysis.
     */
    getFailedAIEmojiIds(): string[] {
        return Array.from(this._aiFailedIds)
    }

    /**
     * Pause or resume AI task processing.
     */
    setAIPaused(paused: boolean): void {
        this._aiPaused = paused
        this.ctx.logger.info(`AI analysis ${paused ? 'paused' : 'resumed'}`)
    }

    /**
     * Retry all previously failed AI tasks.
     * Returns the number of tasks re-queued.
     */
    async retryFailedTasks(): Promise<number> {
        if (!this._taskProcessor) return 0

        const failedIds = Array.from(this._aiFailedIds)
        if (failedIds.length === 0) return 0

        for (const emojiId of failedIds) {
            const emoji = await this._taskProcessor.getEmojiById(emojiId)
            if (!emoji) continue

            const buffer = await fs.readFile(emoji.path)
            const hash = this.calculateHash(buffer)
            this._aiTaskQueue.push({
                id: randomUUID(),
                emojiId,
                imagePath: emoji.path,
                imageHash: hash,
                attempts: 0
            })
        }
        this._aiFailedIds.clear()
        return failedIds.length
    }

    /**
     * Queue a batch of emojis for re-analysis.
     * Skips emojis that are already queued or processing.
     * Returns the number of tasks queued.
     */
    async reanalyzeBatch(ids: string[]): Promise<number> {
        if (!this._taskProcessor) return 0

        let count = 0
        for (const id of ids) {
            const emoji = await this._taskProcessor.getEmojiById(id)
            if (!emoji) continue

            if (this._processingSet.has(id)) continue
            if (this._aiTaskQueue.some((t) => t.emojiId === id)) continue

            const buffer = await fs.readFile(emoji.path)
            const hash = this.calculateHash(buffer)

            this._aiTaskQueue.push({
                id: randomUUID(),
                emojiId: id,
                imagePath: emoji.path,
                imageHash: hash,
                attempts: 0
            })
            count++
        }
        return count
    }

    /**
     * Process a single AI task.
     */
    private async processAITask(task: AITask): Promise<void> {
        if (!task || !task.id || !this._taskProcessor) return
        if (this._processingSet.has(task.emojiId)) {
            this.ctx.logger.warn(
                `Task ${task.id} already processing locally, skip`
            )
            return
        }

        this._processingSet.add(task.emojiId)
        try {
            const buffer = await fs.readFile(task.imagePath)
            const base64 = buffer.toString('base64')

            const result = await this._taskProcessor.analyzeEmoji(base64)
            if (!result) throw new Error('AI Analysis returned null')

            if (task.emojiId) {
                const emoji = await this._taskProcessor.getEmojiById(
                    task.emojiId
                )
                if (emoji) {
                    const newTags = [
                        ...new Set([
                            ...(emoji.tags || []),
                            ...(result.tags || [])
                        ])
                    ]
                    await this._taskProcessor.updateEmojiInfo(task.emojiId, {
                        name: result.name || emoji.name,
                        category: result.category || emoji.category,
                        tags: newTags
                    })
                }
            }

            if (task.imageHash) {
                this.cacheAIResult(task.imageHash, result)
            }

            this._aiSucceededCount++
        } catch (err) {
            const attempts = (task.attempts || 0) + 1
            if (attempts >= this.config.AIMaxAttempts) {
                this._aiFailedIds.add(task.emojiId)
                this.ctx.logger.warn(
                    `AI Task ${task.id} permanently failed after ${attempts} attempts: ${err?.message || err}`
                )
            } else {
                const backoff =
                    this.config.AIBackoffBase * Math.pow(2, attempts - 1)
                task.attempts = attempts
                task.nextRetryAt = Date.now() + backoff
                this._aiTaskQueue.push(task)
            }
            this.ctx.logger.warn(
                `AI Task ${task.id} failed: ${err?.message || err}`
            )
        } finally {
            this._processingSet.delete(task.emojiId)
            this._localActiveCount = Math.max(0, this._localActiveCount - 1)
        }
    }

    /**
     * Start the background AI task processor loop.
     * Runs until the context is disposed.
     */
    async startAITaskProcessor(): Promise<void> {
        this.ctx.logger.info('AI Task Processor loop started')

        while (!this._isDisposed) {
            try {
                if (this._aiPaused) {
                    await new Promise((resolve) => setTimeout(resolve, 2000))
                    continue
                }

                const concurrency = this.config.aiConcurrency

                if (this._localActiveCount >= concurrency) {
                    await new Promise((resolve) => setTimeout(resolve, 1000))
                    continue
                }

                const now = Date.now()
                const readyTasks: AITask[] = []
                const remaining: AITask[] = []

                for (const task of this._aiTaskQueue) {
                    if (task.nextRetryAt && task.nextRetryAt > now) {
                        remaining.push(task)
                    } else {
                        readyTasks.push(task)
                    }
                }
                this._aiTaskQueue = remaining

                if (readyTasks.length === 0) {
                    await new Promise((resolve) => setTimeout(resolve, 2000))
                    continue
                }

                this.ctx.logger.info(
                    `AI Task Processor: Found ${readyTasks.length} pending tasks`
                )

                for (const task of readyTasks) {
                    if (this._aiPaused || this._isDisposed) {
                        this._aiTaskQueue.push(task)
                        continue
                    }

                    if (this._localActiveCount >= concurrency) {
                        this._aiTaskQueue.push(task)
                        continue
                    }

                    this._localActiveCount++
                    this.processAITask(task).catch((err) => {
                        this.ctx.logger.error(
                            `Task ${task.id} unexpected error: ${err.message}`
                        )
                    })

                    const delay = this.config.AIBatchDelay
                    if (delay > 0) {
                        await new Promise((resolve) =>
                            setTimeout(resolve, delay)
                        )
                    }
                }

                await new Promise((resolve) => setTimeout(resolve, 100))
            } catch (err) {
                this.ctx.logger.error(`AI Loop error: ${err.message}`)
                await new Promise((resolve) => setTimeout(resolve, 5000))
            }
        }

        this.ctx.logger.info('AI Task Processor loop stopped')
    }
}
