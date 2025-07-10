import { h, Session } from 'koishi'

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
    const first10Bytes = new Uint8Array(buffer).slice(0, 10)
    const type = Buffer.from(first10Bytes).toString('base64', 0, 10)
    if (type.startsWith('iVBORw0KGgoAAAANSUhEUg')) {
        return pure ? 'png' : 'image/png'
    } else if (type.startsWith('/9j/4AAQSkZJRg')) {
        return pure ? 'jpeg' : 'image/jpeg'
    } else if (type.startsWith('R0lGOD')) {
        return pure ? 'gif' : 'image/gif'
    } else if (type.startsWith('UklGRg')) {
        return pure ? 'webp' : 'image/webp'
    }
    return pure ? 'jpeg' : 'image/jpeg'
}

export function generateId(): string {
    return (
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15)
    )
}

export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
