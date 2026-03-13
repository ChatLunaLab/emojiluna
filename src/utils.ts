import { h, Session } from 'koishi'
import crypto from 'crypto'
import { detectImageFormat } from './image'

export type ParseResult<T> = T | null

export const tryParse = <T>(text: string): ParseResult<T> => {
    try {
        return JSON.parse(text.trim())
    } catch {
        return null
    }
}

export const extractors = [
    (text: string) => text.trim(),
    (text: string) =>
        text.replace(/```(?:json|JSON)?\s*/g, '').replace(/```\s*$/g, ''),
    (text: string) => {
        const start = text.indexOf('{'),
            end = text.lastIndexOf('}')
        return start !== -1 && end !== -1 && start < end
            ? text.substring(start, end + 1)
            : text
    },
    (text: string) => {
        const start = text.indexOf('{')
        if (start === -1) return text
        let count = 0,
            end = -1
        for (let i = start; i < text.length; i++) {
            if (text[i] === '{') count++
            else if (text[i] === '}' && --count === 0) {
                end = i
                break
            }
        }
        return end !== -1 ? text.substring(start, end + 1) : text
    }
]

export async function handleImageUpload<T>(
    session: Session,
    content: string,
    handler: (imageData: Buffer[]) => Promise<T>
) {
    let elements = h.select(session.elements, 'img')

    if (elements.length === 0) {
        elements = h.select(h.parse(content), 'img')
    }

    if (elements.length === 0) {
        elements = h.select(session.quote?.elements ?? [], 'img')
    }

    if (elements.length === 0) {
        throw new Error('没有找到图片')
    }

    const images: Buffer[] = []

    const readImage = async (url: string) => {
        const response = await session.app.http(url, {
            responseType: 'arraybuffer',
            method: 'get',
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
            }
        })

        const buffer = response.data
        images.push(Buffer.from(buffer))
    }

    for (const element of elements) {
        const url = (element.attrs.url ?? element.attrs.src) as string

        if (url.startsWith('data:image') && url.includes('base64')) {
            const base64 = url.split(',')[1]
            images.push(Buffer.from(base64, 'base64'))
        } else {
            try {
                await readImage(url)
            } catch (error) {
                session.app.logger.warn(
                    `读取图片 ${url} 失败，请检查聊天适配器`,
                    error
                )
            }
        }
    }

    return await handler(images)
}

export function getImageType(buffer: Buffer, pure: boolean = false): string {
    const format = detectImageFormat(buffer)
    const type = format === 'unknown' ? 'jpeg' : format
    return pure ? type : `image/${type}`
}

export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function hashBuffer(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex')
}
