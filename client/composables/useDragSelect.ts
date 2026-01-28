import { ref, reactive, Ref, toValue } from 'vue'

interface Point {
    x: number
    y: number
}

interface Rect {
    left: number
    top: number
    width: number
    height: number
}

export function useDragSelect<T>(
    containerRef: Ref<HTMLElement | undefined>,
    items: Ref<T[]>,
    // Function to get the DOM element for an item
    getItemElement: (item: T) => HTMLElement | null | undefined,
    // ID key for the item (to compare uniqueness)
    itemIdKey: keyof T,
    // Current selected items ref (read/write)
    selectedItems: Ref<T[]>,
    // Callback to enable selection mode
    enableSelectionMode: () => void,
    // Callback to disable selection mode (optional)
    disableSelectionMode?: () => void
) {
    const isDragSelecting = ref(false)
    const selectionBox = reactive<Rect>({ left: 0, top: 0, width: 0, height: 0 })
    
    let startPoint: Point = { x: 0, y: 0 }
    let initialSelection: T[] = []
    
    const handleMouseDown = (event: MouseEvent) => {
        // Ignore right clicks
        if (event.button !== 0) return

        // Check if click is on a button or interactive element
        if ((event.target as HTMLElement).closest('button, .el-checkbox, .action-btn, .prevent-drag-select, .el-upload, .el-input, .el-select')) {
            return
        }
        
        // If target is an emoji card, we might let the card handle it.
        if ((event.target as HTMLElement).closest('.emoji-card, .album-card')) {
            return
        }

        if (!containerRef.value) return
        
        const containerRect = containerRef.value.getBoundingClientRect()
        const scrollLeft = containerRef.value.scrollLeft
        const scrollTop = containerRef.value.scrollTop
        
        // Capture initial selection state
        initialSelection = [...selectedItems.value]
        
        // If Ctrl/Shift is not held, clear selection
        if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
             selectedItems.value = []
             initialSelection = []
             disableSelectionMode?.()
        } else {
             // If modifiers, we assume we are selecting
             enableSelectionMode()
        }
        
        startPoint = {
            x: event.clientX - containerRect.left + scrollLeft,
            y: event.clientY - containerRect.top + scrollTop
        }
        
        selectionBox.left = startPoint.x
        selectionBox.top = startPoint.y
        selectionBox.width = 0
        selectionBox.height = 0
        
        isDragSelecting.value = true
        
        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
        
        // Prevent text selection
        event.preventDefault()
    }
    
    const handleMouseMove = (event: MouseEvent) => {
        if (!isDragSelecting.value || !containerRef.value) return
        
        const containerRect = containerRef.value.getBoundingClientRect()
        const scrollLeft = containerRef.value.scrollLeft
        const scrollTop = containerRef.value.scrollTop

        const currentX = event.clientX - containerRect.left + scrollLeft
        const currentY = event.clientY - containerRect.top + scrollTop
        
        // Calculate box geometry
        const nextLeft = Math.min(startPoint.x, currentX)
        const nextTop = Math.min(startPoint.y, currentY)
        const nextWidth = Math.abs(currentX - startPoint.x)
        const nextHeight = Math.abs(currentY - startPoint.y)
        
        selectionBox.left = nextLeft
        selectionBox.top = nextTop
        selectionBox.width = nextWidth
        selectionBox.height = nextHeight
        
        // Only run intersection check if box size is significant
        if (nextWidth < 2 && nextHeight < 2) return

        // If dragging significantly, enable selection mode
        enableSelectionMode()

        // For intersection check, we need to compare item position relative to container
        // OR compare absolute viewport coordinates.
        // boxRect is relative to container content.
        // itemRect (getBoundingClientRect) is relative to viewport.
        
        // It's easier to convert boxRect to viewport coordinates for comparison.
        // boxRect (content) -> viewport
        // left (viewport) = containerRect.left + boxRect.left (content) - scrollLeft
        
        const boxViewportRect = {
            left: containerRect.left + selectionBox.left - scrollLeft,
            top: containerRect.top + selectionBox.top - scrollTop,
            right: containerRect.left + selectionBox.left + selectionBox.width - scrollLeft,
            bottom: containerRect.top + selectionBox.top + selectionBox.height - scrollTop
        }
        
        const newSelectedItems = new Set<T>()
        
        items.value.forEach(item => {
            const el = getItemElement(item)
            if (!el) return
            
            const itemRect = el.getBoundingClientRect()
            
            const isIntersecting = !(
                itemRect.right < boxViewportRect.left ||
                itemRect.left > boxViewportRect.right ||
                itemRect.bottom < boxViewportRect.top ||
                itemRect.top > boxViewportRect.bottom
            )
            
            const wasSelected = initialSelection.some(i => i[itemIdKey] === item[itemIdKey])

            if (isIntersecting) {
                 if (event.ctrlKey || event.metaKey) {
                     // Toggle (XOR)
                     if (wasSelected) {
                         newSelectedItems.delete(item)
                     } else {
                         newSelectedItems.add(item)
                     }
                 } else if (event.shiftKey) {
                     // Add (Union)
                     newSelectedItems.add(item)
                 } else {
                     // Replace
                     newSelectedItems.add(item)
                 }
            } else {
                 // Not intersecting
                 if (event.ctrlKey || event.metaKey || event.shiftKey) {
                     // Keep initial
                     if (wasSelected) newSelectedItems.add(item)
                 }
                 // Else: clear (do nothing)
            }
        })
        
        selectedItems.value = Array.from(newSelectedItems)
    }
    
    const handleMouseUp = () => {
        isDragSelecting.value = false
        selectionBox.width = 0
        selectionBox.height = 0
        
        if (selectedItems.value.length === 0) {
            disableSelectionMode?.()
        }

        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
    }
    
    return {
        isDragSelecting,
        selectionBox,
        handleMouseDown
    }
}
