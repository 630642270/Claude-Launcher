import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'

// 下拉面板相对触发按钮的间距与视口安全边距
const POP_GAP = 6
const VIEWPORT_MARGIN = 8
// 视口空间不足时面板的最低高度保证
const MIN_POP_HEIGHT = 180
// 翻转迟滞余量：滚动到上下空间接近的边界时防止方向来回抖动
const FLIP_HYSTERESIS = 32

export interface PopGeom {
  left: number
  width: number
  maxHeight: number
  up: boolean
  top?: number
  bottom?: number
}

interface UseComboPopoverOptions {
  triggerRef: RefObject<HTMLElement | null>
  popRef: RefObject<HTMLDivElement | null>
  listRef: RefObject<HTMLElement | null>
  open: boolean
}

interface UseComboPopoverResult {
  geom: PopGeom | null
  /** 打开面板时调用：先给出向下展开的初始坐标（不约束高度），同帧即可渲染入场动画 */
  beginOpen: () => void
  /** 内容变化后重新测量定位 */
  reposition: () => void
}

/**
 * 下拉面板定位。面板经 portal 挂在 body 上、position: fixed，
 * 依据触发按钮位置与视口剩余空间计算坐标，空间不足时向上翻转。
 *
 * 关键点：内容自然高度采用约束无关测量 —— 面板可能被 maxHeight 压缩，
 * 此时面板自身的 scrollHeight 返回的是压缩后的高度；而列表作为可收缩
 * flex 项，其 scrollHeight 始终等于完整内容高度，因此
 * 自然高度 = (面板高度 - 列表渲染高度) + 列表内容高度，
 * 避免每次滚动重算时以被压缩的高度为基线继续收缩。
 */
export function useComboPopover({
  triggerRef,
  popRef,
  listRef,
  open
}: UseComboPopoverOptions): UseComboPopoverResult {
  const [geom, setGeom] = useState<PopGeom | null>(null)
  const upRef = useRef(false)

  const measureContentHeight = useCallback((): number => {
    const pop = popRef.current
    if (!pop) return MIN_POP_HEIGHT
    const list = listRef.current
    if (!list) return pop.scrollHeight
    return pop.offsetHeight - list.offsetHeight + list.scrollHeight
  }, [popRef, listRef])

  const reposition = useCallback((): void => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom - POP_GAP - VIEWPORT_MARGIN
    const spaceAbove = rect.top - POP_GAP - VIEWPORT_MARGIN
    const contentH = measureContentHeight()

    const fitsBelow = contentH <= spaceBelow
    let up: boolean
    if (fitsBelow) {
      up = false
    } else if (upRef.current) {
      // 已向上展开：下方明显更宽敞才翻回，避免边界抖动
      up = spaceBelow <= spaceAbove + FLIP_HYSTERESIS
    } else {
      up = spaceAbove > spaceBelow + FLIP_HYSTERESIS
    }
    upRef.current = up

    const available = up ? spaceAbove : spaceBelow
    const maxHeight = Math.max(MIN_POP_HEIGHT, Math.min(contentH, available))

    setGeom(
      up
        ? { left: rect.left, width: rect.width, maxHeight, up: true, bottom: window.innerHeight - rect.top + POP_GAP }
        : { left: rect.left, width: rect.width, maxHeight, up: false, top: rect.bottom + POP_GAP }
    )
  }, [triggerRef, measureContentHeight])

  const beginOpen = useCallback((): void => {
    upRef.current = false
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    setGeom({
      left: rect.left,
      width: rect.width,
      // 初始不约束高度，layout effect 测得真实内容高度后再决定翻转与 maxHeight
      maxHeight: window.innerHeight,
      up: false,
      top: rect.bottom + POP_GAP
    })
  }, [triggerRef])

  // 打开后校准位置，并在滚动/缩放时保持贴合
  useLayoutEffect(() => {
    if (!open) {
      setGeom(null)
      return
    }
    reposition()
    window.addEventListener('resize', reposition)
    document.addEventListener('scroll', reposition, true)
    return () => {
      window.removeEventListener('resize', reposition)
      document.removeEventListener('scroll', reposition, true)
    }
  }, [open, reposition])

  return { geom, beginOpen, reposition }
}

export function popStyleFromGeom(geom: PopGeom | null): CSSProperties | undefined {
  if (!geom) return undefined
  return {
    left: geom.left,
    width: geom.width,
    maxHeight: geom.maxHeight,
    ...(geom.up ? { bottom: geom.bottom } : { top: geom.top })
  }
}