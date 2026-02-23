self.onmessage = async (e) => {
    const { files, concurrency = 4 } = e.data
    let idx = 0

    // Compute SHA-256 hash using full file content (no sampling)
    const computeHash = async (file: File): Promise<string> => {
        try {
            const buffer = await file.arrayBuffer()
            const digest = await crypto.subtle.digest('SHA-256', buffer)
            const hex = Array.from(new Uint8Array(digest))
                .map((b) => b.toString(16).padStart(2, '0'))
                .join('')
            return hex
        } catch (err) {
            throw new Error(
                `Failed to compute hash: ${err?.message || String(err)}`
            )
        }
    }

    const workerLoop = async () => {
        while (true) {
            const i = idx++
            if (i >= files.length) break
            const item = files[i]
            try {
                const hash = await computeHash(item.file)
                self.postMessage({ type: 'hash', index: i, hash })
            } catch (err) {
                self.postMessage({
                    type: 'error',
                    index: i,
                    error: err?.message || String(err)
                })
            }
        }
    }

    const workers = []
    for (let w = 0; w < Math.min(concurrency, files.length); w++) {
        workers.push(workerLoop())
    }
    await Promise.all(workers)
    self.postMessage({ type: 'done' })
}
