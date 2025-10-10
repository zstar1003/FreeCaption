// utils/canvasUtils.ts
// Canvas 绘制相关工具函数

import { ImageInfo } from './imageUtils'

export interface CanvasDrawOptions {
  imageInfos: ImageInfo[]
  subtitleHeight: number
  cropPosition: 'top' | 'bottom'
}

/**
 * 使用新版 Canvas 2D API 创建长图
 */
export function createLongImageWithCanvas2D(
  canvas: any,
  options: CanvasDrawOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    const { imageInfos, subtitleHeight, cropPosition } = options
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      reject(new Error('无法获取 Canvas 上下文'))
      return
    }

    const firstImage = imageInfos[0]
    const canvasWidth = firstImage.width

    // 计算总高度
    let totalHeight = firstImage.height
    for (let i = 1; i < imageInfos.length; i++) {
      totalHeight += subtitleHeight
    }

    // 设置 Canvas 尺寸
    canvas.width = canvasWidth
    canvas.height = totalHeight

    let currentY = 0

    // 加载并绘制第一张完整图片
    const img0 = canvas.createImage()
    img0.onload = () => {
      ctx.drawImage(img0, 0, 0, firstImage.width, firstImage.height)
      currentY += firstImage.height

      // 递归绘制后续图片的字幕部分
      drawSubtitlesRecursive(ctx, canvas, imageInfos, 1, currentY, subtitleHeight, cropPosition)
        .then(() => {
          // 导出图片
          wx.canvasToTempFilePath({
            canvas,
            success: (res) => resolve(res.tempFilePath),
            fail: reject
          })
        })
        .catch(reject)
    }
    img0.onerror = () => reject(new Error('图片加载失败'))
    img0.src = firstImage.path
  })
}

/**
 * 递归绘制字幕部分（新版 Canvas 2D）
 */
function drawSubtitlesRecursive(
  ctx: any,
  canvas: any,
  imageInfos: ImageInfo[],
  index: number,
  currentY: number,
  subtitleHeight: number,
  cropPosition: string
): Promise<void> {
  if (index >= imageInfos.length) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const imageInfo = imageInfos[index]
    const img = canvas.createImage()

    img.onload = () => {
      // 计算裁剪位置
      const sy = cropPosition === 'bottom'
        ? imageInfo.height - subtitleHeight
        : 0

      // 绘制裁剪的字幕部分
      ctx.drawImage(
        img,
        0, sy, imageInfo.width, subtitleHeight, // 源图裁剪区域
        0, currentY, imageInfo.width, subtitleHeight // 目标绘制区域
      )

      // 继续绘制下一张
      drawSubtitlesRecursive(
        ctx,
        canvas,
        imageInfos,
        index + 1,
        currentY + subtitleHeight,
        subtitleHeight,
        cropPosition
      )
        .then(resolve)
        .catch(reject)
    }
    img.onerror = () => reject(new Error(`图片 ${index} 加载失败`))
    img.src = imageInfo.path
  })
}

/**
 * 使用旧版 Canvas API 创建长图（兼容模式）
 */
export function createLongImageLegacy(
  context: any,
  canvasId: string,
  options: CanvasDrawOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    const { imageInfos, subtitleHeight, cropPosition } = options
    const firstImage = imageInfos[0]
    let currentY = 0

    // 绘制第一张完整图片
    context.drawImage(firstImage.path, 0, 0, firstImage.width, firstImage.height)
    currentY += firstImage.height

    // 绘制后续图片的字幕部分
    for (let i = 1; i < imageInfos.length; i++) {
      const imageInfo = imageInfos[i]
      const sy = cropPosition === 'bottom'
        ? imageInfo.height - subtitleHeight
        : 0

      context.drawImage(
        imageInfo.path,
        0, sy, imageInfo.width, subtitleHeight,
        0, currentY, imageInfo.width, subtitleHeight
      )

      currentY += subtitleHeight
    }

    // 绘制到 Canvas
    context.draw(false, () => {
      // 延迟导出，确保绘制完成
      setTimeout(() => {
        wx.canvasToTempFilePath({
          canvasId,
          success: (res) => resolve(res.tempFilePath),
          fail: reject
        })
      }, 500)
    })
  })
}

/**
 * 获取 Canvas 节点
 */
export function getCanvasNode(selector: string, context: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const query = wx.createSelectorQuery().in(context)
    query
      .select(selector)
      .fields({ node: true, size: true })
      .exec((res) => {
        if (res && res[0] && res[0].node) {
          resolve(res[0].node)
        } else {
          reject(new Error('无法获取 Canvas 节点'))
        }
      })
  })
}
