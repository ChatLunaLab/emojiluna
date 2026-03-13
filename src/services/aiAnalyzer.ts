import { Context } from 'koishi'
import { Config } from '../config'
import {
    AIAnalyzeResult,
    AICategorizeResult,
    AIImageFilterResult,
    ImageContentType
} from '../types'
import { extractors, ParseResult, tryParse } from '../utils'
import { extractSampledFrames, getImageMetadata } from '../image'
import { ChatLunaChatModel } from 'koishi-plugin-chatluna/llm-core/platform/model'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { getMessageContent } from 'koishi-plugin-chatluna/utils/string'
import { ComputedRef } from 'koishi-plugin-chatluna'
import { parseRawModelName } from 'koishi-plugin-chatluna/llm-core/utils/count_tokens'

export class AIAnalyzer {
    private static readonly AI_FRAME_SAMPLES = 3
    private _model: ComputedRef<ChatLunaChatModel> | null = null

    constructor(
        private ctx: Context,
        private config: Config
    ) {}

    get model() {
        return this._model
    }

    async initialize(): Promise<void> {
        if (!this.config.autoCategorize && !this.config.autoAnalyze) return

        try {
            const [platform] = parseRawModelName(this.config.model)
            await this.ctx.chatluna.awaitLoadPlatform(platform)
            this._model = await this.ctx.chatluna.createChatModel(
                this.config.model
            )
            this.ctx.logger.success('AI模型加载成功')
        } catch (error) {
            this.ctx.logger.error('AI模型加载失败:', error)
        }
    }

    private parseAIResult<T>(result: string): ParseResult<T> {
        for (const extractor of extractors) {
            const extracted = extractor(result)
            const parsed = tryParse<T>(extracted)
            if (parsed) return parsed
        }
        this.ctx.logger.error(`AI结果解析失败: ${result}`)
        return null
    }

    private async buildAIImages(
        imageBase64: string
    ): Promise<{ data: string; mimeType: string }[]> {
        try {
            const buffer = Buffer.from(imageBase64, 'base64')
            const metadata = await getImageMetadata(buffer)

            if (metadata.frameCount <= 1) {
                return [
                    { data: imageBase64, mimeType: `image/${metadata.format}` }
                ]
            }

            const { frames, metadata: framesMetadata } =
                await extractSampledFrames(
                    buffer,
                    AIAnalyzer.AI_FRAME_SAMPLES,
                    metadata.format as 'png' | 'jpeg' | 'webp'
                )

            if (frames.length === 0) {
                return [
                    { data: imageBase64, mimeType: `image/${metadata.format}` }
                ]
            }

            return frames.map((frame) => ({
                data: frame.toString('base64'),
                mimeType: `image/${framesMetadata.format}`
            }))
        } catch (error) {
            this.ctx.logger.warn(
                `AI image preparation failed: ${error.message}`
            )
            return [{ data: imageBase64, mimeType: 'image/png' }]
        }
    }

    private async invokeAI<T>(
        prompt: string,
        imageBase64: string
    ): Promise<T | null> {
        if (!this._model?.value) return null

        const images = await this.buildAIImages(imageBase64)
        const result = await this._model.value.invoke([
            new SystemMessage(prompt),
            new HumanMessage({
                content: [
                    { type: 'text', text: 'Please analyze this emoji' },
                    ...images.map((image) => ({
                        type: 'image_url',
                        image_url: {
                            url: `data:${image.mimeType};base64,${image.data}`,
                            detail: 'low'
                        }
                    }))
                ]
            })
        ])

        return this.parseAIResult<T>(getMessageContent(result.content))
    }

    async categorize(imageBase64: string): Promise<AICategorizeResult | null> {
        if (!this._model?.value || !this.config.autoCategorize) return null

        try {
            const prompt = this.config.categorizePrompt.replaceAll(
                '{categories}',
                this.config.categories.join(', ')
            )
            return await this.invokeAI<AICategorizeResult>(prompt, imageBase64)
        } catch (error) {
            this.ctx.logger.error('AI categorization failed:', error)
            return null
        }
    }

    async analyze(imageBase64: string): Promise<AIAnalyzeResult | null> {
        if (!this._model?.value || !this.config.autoAnalyze) return null

        try {
            const prompt = this.config.analyzePrompt.replaceAll(
                '{categories}',
                this.config.categories.join(', ')
            )
            return await this.invokeAI<AIAnalyzeResult>(prompt, imageBase64)
        } catch (error) {
            this.ctx.logger.error('AI analysis failed:', error)
            return null
        }
    }

    async filterImageType(
        imageBase64: string
    ): Promise<AIImageFilterResult | null> {
        if (!this._model?.value || !this.config.enableImageTypeFilter) {
            return null
        }

        try {
            const parsedResult = await this.invokeAI<{
                imageType: ImageContentType
                confidence: number
                reason: string
                isUseful: boolean
            }>(this.config.imageFilterPrompt, imageBase64)

            if (!parsedResult) return null

            const isAcceptable =
                parsedResult.isUseful &&
                this.config.acceptedImageTypes.includes(parsedResult.imageType)

            return {
                imageType: parsedResult.imageType,
                isAcceptable,
                confidence: parsedResult.confidence,
                reason: parsedResult.reason
            }
        } catch (error) {
            this.ctx.logger.error('AI图片类型过滤失败:', error)
            return null
        }
    }
}
