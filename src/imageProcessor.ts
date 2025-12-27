import { createJimp } from '@jimp/core'
import { defaultFormats, defaultPlugins } from 'jimp'
import { parseGIF, decompressFrames } from 'gifuct-js'

const Jimp = createJimp({
    formats: [...defaultFormats],
    plugins: defaultPlugins
})

export interface ImageMetadata {
    format: string
    width: number
    height: number
    frameCount: number
}

export interface DecodedFrame {
    width: number
    height: number
    data: Uint8Array
}

const clampFrameIndex = (index: number, frameCount: number) => {
    if (frameCount <= 1) return 0
    return Math.max(0, Math.min(frameCount - 1, index))
}

const toArrayBuffer = (buffer: Buffer): ArrayBuffer => {
    return buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
    ) as ArrayBuffer
}

const detectImageFormat = (buffer: Buffer): string => {
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
    if (header[0] === 0x42 && header[1] === 0x4d) return 'bmp'

    return 'unknown'
}

export async function getImageMetadata(buffer: Buffer): Promise<ImageMetadata> {
    const format = detectImageFormat(buffer)

    if (format === 'gif') {
        const gif = parseGIF(toArrayBuffer(buffer))
        const frames = decompressFrames(gif, false)
        return {
            format,
            width: gif.lsd?.width ?? 0,
            height: gif.lsd?.height ?? 0,
            frameCount: frames.length || 1
        }
    }

    if (format === 'webp') {
        const frame = await decodeWebpFrame(buffer)
        return {
            format,
            width: frame.width,
            height: frame.height,
            frameCount: 1
        }
    }

    const image = await Jimp.read(buffer)
    return {
        format,
        width: image.bitmap.width,
        height: image.bitmap.height,
        frameCount: 1
    }
}

export function sampleFrameIndices(
    frameCount: number,
    sampleCount: number
): number[] {
    const safeFrameCount = Math.max(1, frameCount)
    const safeSampleCount = Math.max(1, Math.min(sampleCount, safeFrameCount))

    if (safeFrameCount === 1) return [0]
    if (safeSampleCount === 1) return [Math.floor(safeFrameCount / 2)]

    const indices = new Set<number>()

    for (let i = 0; i < safeSampleCount; i++) {
        const ratio = i / (safeSampleCount - 1)
        const index = Math.round((safeFrameCount - 1) * ratio)
        indices.add(index)
    }

    return Array.from(indices).sort((a, b) => a - b)
}

export async function extractSampledFrames(
    buffer: Buffer,
    sampleCount: number,
    outputFormat: 'png' | 'jpeg' | 'webp' = 'png'
): Promise<{ frames: Buffer[]; metadata: ImageMetadata }> {
    const metadata = await getImageMetadata(buffer)
    const indices = sampleFrameIndices(metadata.frameCount, sampleCount)
    const decodedFrames = await decodeFrames(buffer, metadata, indices)
    const frames = await Promise.all(
        decodedFrames.map((frame) => encodeFrame(frame, outputFormat))
    )

    return { frames, metadata }
}

export async function extractFrameGrayscale(
    buffer: Buffer,
    metadata: ImageMetadata,
    frameIndex: number,
    targetWidth: number,
    targetHeight: number
): Promise<Uint8Array> {
    const frame = await extractFrameRgba(buffer, metadata, frameIndex)
    return resizeFrameToGrayscale(frame, targetWidth, targetHeight)
}

export async function extractFrameRgba(
    buffer: Buffer,
    metadata: ImageMetadata,
    frameIndex: number
): Promise<DecodedFrame> {
    const index = clampFrameIndex(frameIndex, metadata.frameCount)
    const [frame] = await decodeFrames(buffer, metadata, [index])

    if (!frame) {
        throw new Error('Unable to decode frame')
    }

    return frame
}

export async function resizeFrameToGrayscale(
    frame: DecodedFrame,
    targetWidth: number,
    targetHeight: number
): Promise<Uint8Array> {
    return resizeToGrayscale(
        frame.data,
        frame.width,
        frame.height,
        targetWidth,
        targetHeight
    )
}

async function decodeFrames(
    buffer: Buffer,
    metadata: ImageMetadata,
    frameIndices: number[]
): Promise<DecodedFrame[]> {
    if (metadata.frameCount <= 1 || frameIndices.length === 0) {
        const frame = await decodeStaticFrame(buffer)
        return [frame]
    }

    if (metadata.format === 'gif') {
        return decodeGifFrames(buffer, frameIndices)
    }

    if (metadata.format === 'webp') {
        const frame = await decodeWebpFrame(buffer)
        return [frame]
    }

    const frame = await decodeStaticFrame(buffer)
    return [frame]
}

async function decodeStaticFrame(buffer: Buffer): Promise<DecodedFrame> {
    const image = await Jimp.read(buffer)
    return {
        width: image.bitmap.width,
        height: image.bitmap.height,
        data: new Uint8Array(image.bitmap.data)
    }
}

function decodeGifFrames(
    buffer: Buffer,
    frameIndices: number[]
): DecodedFrame[] {
    const gif = parseGIF(toArrayBuffer(buffer))
    const frames = decompressFrames(gif, true)
    const width = gif.lsd?.width ?? frames[0]?.dims?.width ?? 0
    const height = gif.lsd?.height ?? frames[0]?.dims?.height ?? 0
    const target = new Set(frameIndices)
    const output: DecodedFrame[] = []
    let canvas = new Uint8Array(width * height * 4)
    let restoreCanvas: Uint8Array | null = null
    let previousDisposal = 0
    let previousDims: {
        left: number
        top: number
        width: number
        height: number
    } | null = null

    frames.forEach((frame: any, index: number) => {
        if (index > 0) {
            if (previousDisposal === 2 && previousDims) {
                clearRect(canvas, width, previousDims)
            } else if (previousDisposal === 3 && restoreCanvas) {
                canvas = new Uint8Array(restoreCanvas)
            }
        }

        restoreCanvas = frame.disposalType === 3 ? new Uint8Array(canvas) : null

        drawPatch(canvas, width, frame.patch, frame.dims)

        if (target.has(index)) {
            output.push({
                width,
                height,
                data: new Uint8Array(canvas)
            })
        }

        previousDisposal = frame.disposalType ?? 0
        previousDims = frame.dims ?? null
    })

    return output
}

function clearRect(
    canvas: Uint8Array,
    width: number,
    dims: { left: number; top: number; width: number; height: number }
) {
    const { left, top, width: rectWidth, height: rectHeight } = dims
    for (let y = 0; y < rectHeight; y++) {
        const rowStart = (top + y) * width + left
        const rowEnd = rowStart + rectWidth
        for (let x = rowStart; x < rowEnd; x++) {
            const offset = x * 4
            canvas[offset] = 0
            canvas[offset + 1] = 0
            canvas[offset + 2] = 0
            canvas[offset + 3] = 0
        }
    }
}

function drawPatch(
    canvas: Uint8Array,
    width: number,
    patch: Uint8Array,
    dims: { left: number; top: number; width: number; height: number }
) {
    const { left, top, width: patchWidth, height: patchHeight } = dims
    for (let y = 0; y < patchHeight; y++) {
        for (let x = 0; x < patchWidth; x++) {
            const patchOffset = (y * patchWidth + x) * 4
            const alpha = patch[patchOffset + 3]
            if (alpha === 0) continue
            const destOffset = ((top + y) * width + (left + x)) * 4
            canvas[destOffset] = patch[patchOffset]
            canvas[destOffset + 1] = patch[patchOffset + 1]
            canvas[destOffset + 2] = patch[patchOffset + 2]
            canvas[destOffset + 3] = alpha
        }
    }
}

async function decodeWebpFrame(buffer: Buffer): Promise<DecodedFrame> {
    const image = await Jimp.read(buffer)
    return {
        width: image.bitmap.width,
        height: image.bitmap.height,
        data: new Uint8Array(image.bitmap.data)
    }
}

async function encodeFrame(
    frame: DecodedFrame,
    format: 'png' | 'jpeg' | 'webp'
): Promise<Buffer> {
    const image = new Jimp({
        data: Buffer.from(frame.data),
        width: frame.width,
        height: frame.height
    })

    if (format === 'jpeg') {
        return await image.getBuffer('image/jpeg', { quality: 70 })
    }

    return await image.getBuffer('image/png')
}

async function resizeToGrayscale(
    pixels: Uint8Array,
    width: number,
    height: number,
    targetWidth: number,
    targetHeight: number
): Promise<Uint8Array> {
    const base = new Jimp({
        data: Buffer.from(pixels),
        width,
        height
    })

    const image = base.resize({ w: targetWidth, h: targetHeight }).greyscale()

    const resized = image.bitmap.data
    const grayscale = new Uint8Array(targetWidth * targetHeight)
    for (let i = 0, j = 0; i < resized.length; i += 4, j++) {
        grayscale[j] = resized[i]
    }

    return grayscale
}
