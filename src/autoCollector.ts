import { Context, h, Session } from 'koishi'
import { Config } from './config'
import fs from 'fs/promises'
import crypto from 'crypto'

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
}

export interface ImageInfo {
    buffer: Buffer
    size: number
    hash: string
    format: string
}

export interface ImageFeatures {
    phash: string
    histogram: number[]
    aspectRatio: number
    dimensions: { width: number; height: number }
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
            groupAutoCollectLimit: config.groupAutoCollectLimit
        }
        this.loadExistingHashes()
        this.registerCommands()
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

                    const features = await this.extractImageFeatures(buffer)
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
                status += `频率记录数: ${stats.frequencyRecords}`

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
                this.ctx.logger.debug(
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
            if (!imageInfo || !this.checkFileSize(imageInfo.size)) return

            // First check if we should collect based on frequency
            const groupId = session.guildId || session.channelId
            const frequency = this.trackImageFrequency(imageInfo.hash, groupId)

            if (frequency < this.options.emojiFrequencyThreshold) {
                this.ctx.logger.debug(
                    `Image frequency too low: ${frequency}/${this.options.emojiFrequencyThreshold}`
                )
                return
            }

            if (this.emojiHashes.has(imageInfo.hash)) {
                this.ctx.logger.debug('Duplicate image detected, skipping')
                return
            }

            if (await this.isSimilarToExisting(imageInfo)) {
                this.ctx.logger.debug('Similar image detected, skipping')
                return
            }

            await this.saveEmoji(imageInfo, session)

            // Clean up old frequency records periodically
            if (Math.random() < 0.1) {
                // 10% chance to cleanup
                this.cleanupFrequencyTracker()
            }
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

            return {
                buffer: imageBuffer,
                size: imageBuffer.length,
                hash: this.calculateImageHash(imageBuffer),
                format: this.detectImageFormat(imageBuffer)
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
            this.ctx.logger.debug(
                `Image too small: ${sizeKB.toFixed(2)}KB < ${this.options.minSize}KB`
            )
            return false
        }

        if (sizeMB > this.options.maxSize) {
            this.ctx.logger.debug(
                `Image too large: ${sizeMB.toFixed(2)}MB > ${this.options.maxSize}MB`
            )
            return false
        }

        return true
    }

    private calculateImageHash(buffer: Buffer): string {
        return crypto.createHash('md5').update(buffer).digest('hex')
    }

    private detectImageFormat(buffer: Buffer): string {
        const header = buffer.subarray(0, 12)

        if (header[0] === 0xff && header[1] === 0xd8) return 'jpeg'
        if (
            header[0] === 0x89 &&
            header[1] === 0x50 &&
            header[2] === 0x4e &&
            header[3] === 0x47
        )
            return 'png'
        if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46)
            return 'gif'
        if (
            header[0] === 0x52 &&
            header[1] === 0x49 &&
            header[2] === 0x46 &&
            header[8] === 0x57 &&
            header[9] === 0x45 &&
            header[10] === 0x42 &&
            header[11] === 0x50
        )
            return 'webp'

        return 'unknown'
    }

    private async extractImageFeatures(buffer: Buffer): Promise<ImageFeatures> {
        const dimensions = this.getImageDimensions(buffer)
        const phash = this.calculatePerceptualHash(buffer)
        const histogram = this.calculateHistogram(buffer)
        const aspectRatio = dimensions.width / dimensions.height

        return {
            phash,
            histogram,
            aspectRatio,
            dimensions
        }
    }

    private getImageDimensions(buffer: Buffer): {
        width: number
        height: number
    } {
        const header = buffer.subarray(0, 24)

        if (
            header[0] === 0x89 &&
            header[1] === 0x50 &&
            header[2] === 0x4e &&
            header[3] === 0x47
        ) {
            const width = header.readUInt32BE(16)
            const height = header.readUInt32BE(20)
            return { width, height }
        }

        if (header[0] === 0xff && header[1] === 0xd8) {
            for (let i = 2; i < buffer.length - 8; i++) {
                if (buffer[i] === 0xff && buffer[i + 1] === 0xc0) {
                    const height = buffer.readUInt16BE(i + 5)
                    const width = buffer.readUInt16BE(i + 7)
                    return { width, height }
                }
            }
        }

        return { width: 0, height: 0 }
    }

    private calculatePerceptualHash(buffer: Buffer): string {
        const grayscale = this.convertToGrayscale(buffer)
        const resized = this.resizeImage(grayscale, 8, 8)
        const dct = this.applyDCT(resized)
        const median = this.calculateMedian(dct)

        let hash = ''
        for (let i = 0; i < 64; i++) {
            hash += dct[i] > median ? '1' : '0'
        }

        return hash
    }

    private convertToGrayscale(buffer: Buffer): number[] {
        const grayscale: number[] = []
        const format = this.detectImageFormat(buffer)

        if (format === 'png') {
            let offset = 8
            while (offset < buffer.length) {
                const chunkLength = buffer.readUInt32BE(offset)
                const chunkType = buffer
                    .subarray(offset + 4, offset + 8)
                    .toString('ascii')

                if (chunkType === 'IDAT') {
                    const pixelData = buffer.subarray(
                        offset + 8,
                        offset + 8 + chunkLength
                    )
                    for (let i = 0; i < pixelData.length; i += 4) {
                        const r = pixelData[i]
                        const g = pixelData[i + 1]
                        const b = pixelData[i + 2]
                        const gray = Math.round(
                            0.299 * r + 0.587 * g + 0.114 * b
                        )
                        grayscale.push(gray)
                    }
                    break
                }

                offset += 12 + chunkLength
            }
        } else {
            for (let i = 0; i < Math.min(buffer.length, 64 * 64); i++) {
                grayscale.push(buffer[i])
            }
        }

        return grayscale.slice(0, 64)
    }

    private resizeImage(
        pixels: number[],
        width: number,
        height: number
    ): number[] {
        const resized: number[] = []
        const sourceSize = Math.sqrt(pixels.length)
        const scaleX = sourceSize / width
        const scaleY = sourceSize / height

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const sourceX = Math.floor(x * scaleX)
                const sourceY = Math.floor(y * scaleY)
                const index = sourceY * sourceSize + sourceX
                resized.push(pixels[index] || 0)
            }
        }

        return resized
    }

    private applyDCT(pixels: number[]): number[] {
        const N = 8
        const dct: number[] = new Array(N * N)

        for (let u = 0; u < N; u++) {
            for (let v = 0; v < N; v++) {
                let sum = 0
                for (let x = 0; x < N; x++) {
                    for (let y = 0; y < N; y++) {
                        sum +=
                            pixels[x * N + y] *
                            Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N)) *
                            Math.cos(((2 * y + 1) * v * Math.PI) / (2 * N))
                    }
                }

                const cu = u === 0 ? 1 / Math.sqrt(2) : 1
                const cv = v === 0 ? 1 / Math.sqrt(2) : 1
                dct[u * N + v] = ((cu * cv) / 4) * sum
            }
        }

        return dct
    }

    private calculateMedian(values: number[]): number {
        const sorted = [...values].sort((a, b) => a - b)
        const mid = Math.floor(sorted.length / 2)
        return sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid]
    }

    private calculateHistogram(buffer: Buffer): number[] {
        const histogram = new Array(256).fill(0)
        const grayscale = this.convertToGrayscale(buffer)

        for (const pixel of grayscale) {
            if (pixel >= 0 && pixel <= 255) {
                histogram[pixel]++
            }
        }

        const total = grayscale.length
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
        const phashDistance = this.hammingDistance(
            features1.phash,
            features2.phash
        )
        const phashSimilarity = 1 - phashDistance / 64

        const histogramSimilarity = this.histogramSimilarity(
            features1.histogram,
            features2.histogram
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
            phash: 0.4,
            histogram: 0.3,
            aspectRatio: 0.2,
            dimension: 0.1
        }

        return (
            phashSimilarity * weights.phash +
            histogramSimilarity * weights.histogram +
            aspectRatioSimilarity * weights.aspectRatio +
            dimensionSimilarity * weights.dimension
        )
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
                imageInfo.buffer
            )

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            for (const [_, existingFeatures] of this.imageFeatures) {
                const similarity = this.calculateSimilarityScore(
                    newFeatures,
                    existingFeatures
                )

                if (similarity >= this.options.similarityThreshold) {
                    this.ctx.logger.debug(
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
                this.ctx.logger.debug('Duplicate image detected, skipping')
                return
            }

            if (await this.isSimilarToExisting(imageInfo)) {
                this.ctx.logger.debug('Similar image detected, skipping')
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

            const features = await this.extractImageFeatures(imageInfo.buffer)
            this.imageFeatures.set(imageInfo.hash, features)
        } catch (error) {
            this.ctx.logger.error(`Failed to save emoji: ${error.message}`)
        }
    }

    public updateConfig(config: Config) {
        this.config = config
        this.options = {
            minSize: config.minEmojiSize,
            maxSize: config.maxEmojiSize,
            similarityThreshold: config.similarityThreshold,
            whitelistGroups: config.whitelistGroups,
            emojiFrequencyThreshold: config.emojiFrequencyThreshold,
            groupAutoCollectLimit: config.groupAutoCollectLimit
        }
    }

    public getStats() {
        return {
            totalHashes: this.emojiHashes.size,
            frequencyRecords: this.frequencyTracker.size,
            isEnabled: this.config.autoCollect,
            options: this.options
        }
    }
}
