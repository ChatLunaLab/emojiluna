const UPLOAD_TIMEOUT_MS = 30000 // 30 second timeout per file

self.onmessage = async (e) => {
    const { files, url, concurrency } = e.data
    let active = 0
    let index = 0
    let completed = 0
    const errors: [] = []
    let done = false

    const uploadWithTimeout = (
        file: File,
        name: string,
        category: string,
        tags: string,
        aiAnalysis: string
    ): Promise<void> => {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Upload timeout after ${UPLOAD_TIMEOUT_MS}ms`))
            }, UPLOAD_TIMEOUT_MS)

            const performUpload = async () => {
                try {
                    const formData = new FormData()
                    formData.append('file', file)
                    formData.append('name', name)
                    formData.append('category', category)
                    formData.append('tags', tags)
                    formData.append('aiAnalysis', aiAnalysis)

                    const response = await fetch(url, {
                        method: 'POST',
                        body: formData
                    })

                    if (!response.ok) {
                        const text = await response.text()
                        throw new Error(
                            `Upload failed: ${response.status} ${text}`
                        )
                    }

                    clearTimeout(timeout)
                    resolve()
                } catch (err) {
                    clearTimeout(timeout)
                    reject(err)
                }
            }

            performUpload()
        })
    }

    const processNext = async () => {
        if (index >= files.length) return
        const currentIndex = index++
        const item = files[currentIndex]
        active++

        try {
            await uploadWithTimeout(
                item.file,
                item.name,
                item.category,
                item.tags,
                String(item.aiAnalysis)
            )
            self.postMessage({
                type: 'progress',
                current: ++completed,
                total: files.length
            })
        } catch (err) {
            errors.push({ file: item.name, error: err?.message || String(err) })
        } finally {
            active--
            if (index < files.length && !done) {
                processNext()
            } else if (active === 0 && !done) {
                done = true
                self.postMessage({ type: 'done', errors })
            }
        }
    }

    for (let i = 0; i < Math.min(concurrency, files.length); i++) {
        processNext()
    }
}
