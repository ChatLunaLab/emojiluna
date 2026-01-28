import { Context, h, Session } from 'koishi'
import { Config } from './config'
import { ImageContentType } from './types'
import {
    extractFrameRgba,
    getImageMetadata,
    ImageMetadata,
    resizeFrameToGrayscale,
    sampleFrameIndices
} from './imageProcessor'
import fs from 'fs/promises'
import { hashBuffer } from './utils'

export interface AutoCollectOptions {
    minSize: number
    maxSize: number
    similarityThreshold: number
    whitelistGroups: string[]
    emojiFrequencyThreshold: number
    groupAutoCollectLimit: Record<
        string,
        { hourLimit: number; dayLimit: number }
    >
    enableImageTypeFilter: boolean
    acceptedImageTypes: ImageContentType[]
}

export interface ImageInfo {
    buffer: Buffer
    size: number
    hash: string
    metadata: ImageMetadata
}

export interface FrameFeatures {
    hash: string
    histogram: number[]
}

export interface ImageFeatures {
    frames: FrameFeatures[]
    aspectRatio: number
    dimensions: { width: number; height: number }
    frameCount: number
}

export interface FrequencyRecord {
    hash: string
    timestamps: number[]
    groupId: string
}

export class AutoCollector {
    private ctx: Context
    private config: Config
    private options: AutoCollectOptions
    private emojiHashes = new Set<string>()
    private imageFeatures = new Map<string, ImageFeatures>()
    private frequencyTracker = new Map<string, FrequencyRecord>()
    private static readonly MAX_HASHES = 10000
    private static readonly FREQUENCY_WINDOW = 10 * 60 * 1000 // 10 minutes in milliseconds
    private static readonly SIMILARITY_FRAME_SAMPLES = 5
    private static readonly HASH_WIDTH = 9
    private static readonly HASH_HEIGHT = 8
    private static readonly HISTOGRAM_WIDTH = 32
    private static readonly HISTOGRAM_HEIGHT = 32
    private static readonly HISTOGRAM_BINS = 64
    private groupAutoCollectLimit: Record<
        string,
        {
            hourLimit: number
            dayLimit: number
            lastDayTimestamp: number
            lastHourTimestamp: number
        }
    > = {}

    constructor(ctx: Context, config: Config) {
        this.ctx = ctx
        this.config = config
        this.options = {
            minSize: config.minEmojiSize,
            maxSize: config.maxEmojiSize,
            similarityThreshold: config.similarityThreshold,
            whitelistGroups: config.whitelistGroups,
            emojiFrequencyThreshold: config.emojiFrequencyThreshold,
            groupAutoCollectLimit: config.groupAutoCollectLimit,
            enableImageTypeFilter: config.enableImageTypeFilter,
            acceptedImageTypes: config.acceptedImageTypes
        }
        this.loadExistingHashes()
        this.registerCommands()

        ctx.setTimeout(() => this.cleanupFrequencyTracker(), 30 * 60 * 1000)
    }

    private async loadExistingHashes() {
        try {
            const emojis = await this.ctx.emojiluna.getEmojiList({
                limit: 10000
            })
            for (const emoji of emojis) {
                try {
                    const buffer = await fs.readFile(emoji.path)
                    const hash = this.calculateImageHash(buffer)
                    this.emojiHashes.add(hash)

                    const metadata = await getImageMetadata(buffer)
                    const features = await this.extractImageFeatures(
                        buffer,
                        metadata
                    )
                    this.imageFeatures.set(hash, features)
                } catch (error) {
                    this.ctx.logger.warn(
                        `Failed to load hash for emoji ${emoji.id}: ${error.message}`
                    )
                }
            }
        } catch (error) {
            this.ctx.logger.warn(
                `Failed to load existing emoji hashes: ${error.message}`
            )
        }
    }

    private async checkHitLimit(session: Session): Promise<boolean> {
        const groupId = session.guildId || session.channelId
        const currentTime = Date.now()

        if (!this.groupAutoCollectLimit[groupId]) {
            this.groupAutoCollectLimit[groupId] = {
                hourLimit:
                    this.options.groupAutoCollectLimit[groupId]?.hourLimit ||
                    20,
                dayLimit:
                    this.options.groupAutoCollectLimit[groupId]?.dayLimit ||
                    100,
                lastDayTimestamp: currentTime,
                lastHourTimestamp: currentTime
            }
        }

        const limit = this.groupAutoCollectLimit[groupId]
        const hourPassed = currentTime - limit.lastHourTimestamp >= 3600000
        const dayPassed = currentTime - limit.lastDayTimestamp >= 86400000

        if (hourPassed) {
            limit.lastHourTimestamp = currentTime
            limit.hourLimit =
                this.options.groupAutoCollectLimit[groupId]?.hourLimit || 20
        }

        if (dayPassed) {
            limit.lastDayTimestamp = currentTime
            limit.dayLimit =
                this.options.groupAutoCollectLimit[groupId]?.dayLimit || 100
        }

        if (limit.hourLimit <= 0 || limit.dayLimit <= 0) {
            return false
        }

        limit.hourLimit--
        limit.dayLimit--

        return true
    }

    private registerCommands() {
        this.ctx
            .command('emojiluna.auto.status', '查看自动获取状态')
            .action(async ({ session }) => {
                if (!this.config.autoCollect) {
                    return '自动获取功能未启用'
                }

                const stats = this.getStats()
                let status = `自动获取状态:\n`
                status += `状态: ${stats.isEnabled ? '运行中' : '已停止'}\n`
                status += `最小大小: ${stats.options.minSize}KB\n`
                status += `最大大小: ${stats.options.maxSize}MB\n`
                status += `相似度阈值: ${stats.options.similarityThreshold}\n`
                status += `频次阈值: ${stats.options.emojiFrequencyThreshold}次/10分钟\n`
                status += `白名单群数: ${stats.options.whitelistGroups.length}\n`
                status += `已记录哈希数: ${stats.totalHashes}\n`
                status += `频率记录数: ${stats.frequencyRecords}\n`
                status += `\n图片类型过滤: ${stats.imageTypeFilterEnabled ? '启用' : '禁用'}`

                if (stats.imageTypeFilterEnabled) {
                    status += `\n接受的图片类型: ${stats.acceptedImageTypes.join(', ')}`
                }

                if (stats.options.whitelistGroups.length > 0) {
                    status += `\n\n白名单群:\n${stats.options.whitelistGroups.join('\n')}`
                }

                return status
            })
    }

    public start() {
        if (!this.config.autoCollect) {
            this.ctx.logger.info('Auto collect is disabled')
            return
        }

        this.ctx.on('message', async (session: Session) => {
            if (!this.shouldProcessMessage(session)) return

            const images = h.select(session.elements, 'img')
            if (images.length === 0) return

            if (!(await this.checkHitLimit(session))) {
                this.ctx.logger.info(
                    `Hit auto collect limit for group ${session.guildId || session.channelId}`
                )
                return
            }

            for (const image of images) {
                await this.processImage(image, session)
            }
        })

        this.ctx.logger.info('Auto collector started')
    }

    private shouldProcessMessage(session: Session): boolean {
        if (session.isDirect) return false

        return this.options.whitelistGroups.includes(session.guildId)
    }

    private trackImageFrequency(hash: string, groupId: string): number {
        const currentTime = Date.now()
        const key = `${hash}_${groupId}`

        if (!this.frequencyTracker.has(key)) {
            this.frequencyTracker.set(key, {
                hash,
                timestamps: [],
                groupId
            })
        }

        const record = this.frequencyTracker.get(key)!

        // Clean old timestamps outside the 10-minute window
        record.timestamps = record.timestamps.filter(
            (timestamp) =>
                currentTime - timestamp <= AutoCollector.FREQUENCY_WINDOW
        )

        // Add current timestamp
        record.timestamps.push(currentTime)

        return record.timestamps.length
    }

    private cleanupFrequencyTracker() {
        const currentTime = Date.now()

        for (const [key, record] of this.frequencyTracker.entries()) {
            // Clean old timestamps
            record.timestamps = record.timestamps.filter(
                (timestamp) =>
                    currentTime - timestamp <= AutoCollector.FREQUENCY_WINDOW
            )

            // Remove records with no recent timestamps
            if (record.timestamps.length === 0) {
                this.frequencyTracker.delete(key)
            }
        }
    }

    private async processImage(imageElement: h, session: Session) {
        try {
            const imageInfo = await this.getImageInfo(imageElement)
            if (!imageInfo || !this.checkFileSize(imageInfo.size)) {
                return
            }

            // First check if we should collect based on frequency
            const groupId = session.guildId || session.channelId
            const frequency = this.trackImageFrequency(imageInfo.hash, groupId)

            if (frequency < this.options.emojiFrequencyThreshold) {
                this.ctx.logger.info(
                    `Skip auto-collect: frequency too low (${frequency}/${this.options.emojiFrequencyThreshold})`
                )
                return
            }

            const duplicateReason = await this.getDuplicateReason(imageInfo)
            if (duplicateReason) {
                this.ctx.logger.info(`Skip auto-collect: ${duplicateReason}`)
                return
            }

            // AI image type filter
            if (this.options.enableImageTypeFilter) {
                const imageBase64 = imageInfo.buffer.toString('base64')
                const filterResult =
                    await this.ctx.emojiluna.filterImageByType(imageBase64)

                if (filterResult) {
                    if (!filterResult.isAcceptable) {
                        this.ctx.logger.warn(
                            `Skip auto-collect: rejected by AI filter (type=${filterResult.imageType}, reason=${filterResult.reason})`
                        )
                        return
                    }
                    this.ctx.logger.warn(
                        `AI filter accepted image (type=${filterResult.imageType}, confidence=${filterResult.confidence})`
                    )
                }
            }

            await this.saveEmoji(imageInfo, session)
        } catch (error) {
            this.ctx.logger.warn(`Failed to process image: ${error.message}`)
        }
    }

    private async getImageInfo(imageElement: h): Promise<ImageInfo | null> {
        try {
            const buffer = await this.ctx.http.get(
                imageElement.attrs.url ?? imageElement.attrs.src,
                {
                    responseType: 'arraybuffer'
                }
            )
            const imageBuffer = Buffer.from(buffer)
            const metadata = await getImageMetadata(imageBuffer)

            return {
                buffer: imageBuffer,
                size: imageBuffer.length,
                hash: this.calculateImageHash(imageBuffer),
                metadata
            }
        } catch (error) {
            this.ctx.logger.warn(`Failed to get image info: ${error.message}`)
            return null
        }
    }

    private checkFileSize(size: number): boolean {
        const sizeKB = size / 1024
        const sizeMB = sizeKB / 1024

        if (sizeKB < this.options.minSize) {
            this.ctx.logger.info(
                `Skip auto-collect: image too small (${sizeKB.toFixed(2)}KB < ${this.options.minSize}KB)`
            )
            return false
        }

        if (sizeMB > this.options.maxSize) {
            this.ctx.logger.info(
                `Skip auto-collect: image too large (${sizeMB.toFixed(2)}MB > ${this.options.maxSize}MB)`
            )
            return false
        }

        return true
    }

    private calculateImageHash(buffer: Buffer): string {
        return hashBuffer(buffer)
    }

    private async extractImageFeatures(
        buffer: Buffer,
        metadata?: ImageMetadata
    ): Promise<ImageFeatures> {
        const imageMetadata = metadata ?? (await getImageMetadata(buffer))
        const frameIndices = sampleFrameIndices(
            imageMetadata.frameCount,
            AutoCollector.SIMILARITY_FRAME_SAMPLES
        )
        const frames: FrameFeatures[] = []

        for (const index of frameIndices) {
            const frame = await extractFrameRgba(buffer, imageMetadata, index)
            const hashPixels = await resizeFrameToGrayscale(
                frame,
                AutoCollector.HASH_WIDTH,
                AutoCollector.HASH_HEIGHT
            )
            const histogramPixels = await resizeFrameToGrayscale(
                frame,
                AutoCollector.HISTOGRAM_WIDTH,
                AutoCollector.HISTOGRAM_HEIGHT
            )

            frames.push({
                hash: this.calculateDifferenceHash(
                    hashPixels,
                    AutoCollector.HASH_WIDTH,
                    AutoCollector.HASH_HEIGHT
                ),
                histogram: this.calculateHistogramFromPixels(histogramPixels)
            })
        }

        const aspectRatio =
            imageMetadata.height === 0
                ? 0
                : imageMetadata.width / imageMetadata.height

        return {
            frames,
            aspectRatio,
            dimensions: {
                width: imageMetadata.width,
                height: imageMetadata.height
            },
            frameCount: imageMetadata.frameCount
        }
    }

    private calculateDifferenceHash(
        pixels: Uint8Array,
        width: number,
        height: number
    ): string {
        let hash = ''

        for (let y = 0; y < height; y++) {
            const rowOffset = y * width
            for (let x = 0; x < width - 1; x++) {
                const left = pixels[rowOffset + x]
                const right = pixels[rowOffset + x + 1]
                hash += left > right ? '1' : '0'
            }
        }

        return hash
    }

    private calculateHistogramFromPixels(pixels: Uint8Array): number[] {
        const histogram = new Array(AutoCollector.HISTOGRAM_BINS).fill(0)
        const binSize = 256 / AutoCollector.HISTOGRAM_BINS

        for (const pixel of pixels) {
            const bin = Math.min(
                AutoCollector.HISTOGRAM_BINS - 1,
                Math.floor(pixel / binSize)
            )
            histogram[bin]++
        }

        const total = pixels.length || 1
        return histogram.map((count) => count / total)
    }

    private hammingDistance(hash1: string, hash2: string): number {
        let distance = 0
        for (let i = 0; i < Math.min(hash1.length, hash2.length); i++) {
            if (hash1[i] !== hash2[i]) {
                distance++
            }
        }
        return distance
    }

    private histogramSimilarity(hist1: number[], hist2: number[]): number {
        let intersection = 0
        let union = 0

        for (let i = 0; i < Math.min(hist1.length, hist2.length); i++) {
            intersection += Math.min(hist1[i], hist2[i])
            union += Math.max(hist1[i], hist2[i])
        }

        return union === 0 ? 0 : intersection / union
    }

    private calculateSimilarityScore(
        features1: ImageFeatures,
        features2: ImageFeatures
    ): number {
        const frameSimilarity = this.calculateFrameSetSimilarity(
            features1.frames,
            features2.frames
        )

        const aspectRatioDiff = Math.abs(
            features1.aspectRatio - features2.aspectRatio
        )
        const aspectRatioSimilarity = Math.max(0, 1 - aspectRatioDiff)

        const dimensionSimilarity = this.calculateDimensionSimilarity(
            features1.dimensions,
            features2.dimensions
        )

        const weights = {
            frames: 0.7,
            aspectRatio: 0.2,
            dimension: 0.1
        }

        return (
            frameSimilarity * weights.frames +
            aspectRatioSimilarity * weights.aspectRatio +
            dimensionSimilarity * weights.dimension
        )
    }

    private calculateFrameSetSimilarity(
        frames1: FrameFeatures[],
        frames2: FrameFeatures[]
    ): number {
        if (frames1.length === 0 || frames2.length === 0) return 0

        const scores = frames1.map((frame) =>
            Math.max(
                ...frames2.map((candidate) =>
                    this.calculateFrameSimilarity(frame, candidate)
                )
            )
        )

        const total = scores.reduce((sum, score) => sum + score, 0)
        return total / scores.length
    }

    private calculateFrameSimilarity(
        frame1: FrameFeatures,
        frame2: FrameFeatures
    ): number {
        const hashDistance = this.hammingDistance(frame1.hash, frame2.hash)
        const hashSimilarity =
            1 - hashDistance / Math.max(frame1.hash.length, 1)
        const histogramSimilarity = this.histogramSimilarity(
            frame1.histogram,
            frame2.histogram
        )

        return hashSimilarity * 0.7 + histogramSimilarity * 0.3
    }

    private calculateDimensionSimilarity(
        dim1: { width: number; height: number },
        dim2: { width: number; height: number }
    ): number {
        if (
            dim1.width === 0 ||
            dim1.height === 0 ||
            dim2.width === 0 ||
            dim2.height === 0
        ) {
            return 0
        }

        const area1 = dim1.width * dim1.height
        const area2 = dim2.width * dim2.height
        const areaSimilarity = Math.min(area1, area2) / Math.max(area1, area2)

        return areaSimilarity
    }

    private async isSimilarToExisting(imageInfo: ImageInfo): Promise<boolean> {
        try {
            const newFeatures = await this.extractImageFeatures(
                imageInfo.buffer,
                imageInfo.metadata
            )

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            for (const [_, existingFeatures] of this.imageFeatures) {
                const similarity = this.calculateSimilarityScore(
                    newFeatures,
                    existingFeatures
                )

                if (similarity >= this.options.similarityThreshold) {
                    this.ctx.logger.info(
                        `Similar image found: similarity=${similarity.toFixed(3)}, threshold=${this.options.similarityThreshold}`
                    )
                    return true
                }
            }

            return false
        } catch (error) {
            this.ctx.logger.warn(`Failed to check similarity: ${error.message}`)
            return false
        }
    }

    private async saveEmoji(imageInfo: ImageInfo, session: Session) {
        try {
            if (this.emojiHashes.has(imageInfo.hash)) {
                this.ctx.logger.info(
                    'Skip auto-collect: duplicate hash already collected'
                )
                return
            }

            const timestamp = Date.now()

            await fs.mkdir(this.config.storagePath, { recursive: true })

            const emojiName = `自动获取_${timestamp}`

            await this.ctx.emojiluna.addEmoji(
                {
                    name: emojiName,
                    category: '其他',
                    tags: ['自动获取', `来自群:${session.channelId}`]
                },
                imageInfo.buffer
            )

            this.emojiHashes.add(imageInfo.hash)

            const features = await this.extractImageFeatures(
                imageInfo.buffer,
                imageInfo.metadata
            )
            this.imageFeatures.set(imageInfo.hash, features)
        } catch (error) {
            this.ctx.logger.error(`Failed to save emoji: ${error.message}`)
        }
    }

    private async getDuplicateReason(
        imageInfo: ImageInfo
    ): Promise<string | null> {
        if (this.emojiHashes.has(imageInfo.hash)) {
            return 'duplicate hash already collected'
        }

        const isSimilar = await this.isSimilarToExisting(imageInfo)
        if (isSimilar) {
            return 'similar to an existing emoji'
        }

        return null
    }

    public updateConfig(config: Config) {
        this.config = config
        this.options = {
            minSize: config.minEmojiSize,
            maxSize: config.maxEmojiSize,
            similarityThreshold: config.similarityThreshold,
            whitelistGroups: config.whitelistGroups,
            emojiFrequencyThreshold: config.emojiFrequencyThreshold,
            groupAutoCollectLimit: config.groupAutoCollectLimit,
            enableImageTypeFilter: config.enableImageTypeFilter,
            acceptedImageTypes: config.acceptedImageTypes
        }
    }

    public getStats() {
        return {
            totalHashes: this.emojiHashes.size,
            frequencyRecords: this.frequencyTracker.size,
            isEnabled: this.config.autoCollect,
            options: this.options,
            imageTypeFilterEnabled: this.options.enableImageTypeFilter,
            acceptedImageTypes: this.options.acceptedImageTypes
        }
    }
}
