// index.ts
const app = getApp<IAppOption>()

interface ImageInfo {
  path: string
  width: number
  height: number
}

Component({
  data: {
    images: [] as string[], // 已选择的图片路径数组
    subtitleHeight: 150, // 字幕高度（像素）
    cropPosition: 'bottom', // 裁剪位置：top / bottom
    cropPositions: [
      { label: '底部', value: 'bottom' },
      { label: '顶部', value: 'top' }
    ],
    processing: false // 是否正在处理
  },

  methods: {
    // 选择图片
    chooseImages() {
      const currentCount = this.data.images.length
      const maxCount = 9 - currentCount

      wx.chooseImage({
        count: maxCount,
        sizeType: ['original', 'compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const tempFilePaths = res.tempFilePaths
          this.setData({
            images: [...this.data.images, ...tempFilePaths]
          })
        }
      })
    },

    // 删除图片
    deleteImage(e: any) {
      const index = e.currentTarget.dataset.index
      const images = [...this.data.images]
      images.splice(index, 1)
      this.setData({ images })
    },

    // 清空所有图片
    clearAll() {
      wx.showModal({
        title: '提示',
        content: '确定要清空所有图片吗？',
        success: (res) => {
          if (res.confirm) {
            this.setData({ images: [] })
          }
        }
      })
    },

    // 字幕高度改变
    onSubtitleHeightChange(e: any) {
      this.setData({
        subtitleHeight: e.detail.value
      })
    },

    // 裁剪位置改变
    onCropPositionChange(e: any) {
      this.setData({
        cropPosition: e.currentTarget.dataset.value
      })
    },

    // 生成长图
    async generateLongImage() {
      if (this.data.images.length < 2) {
        wx.showToast({
          title: '至少需要2张图片',
          icon: 'none'
        })
        return
      }

      this.setData({ processing: true })

      wx.showLoading({
        title: '生成中...',
        mask: true
      })

      try {
        // 获取所有图片的信息
        const imageInfos = await this.getAllImageInfo()

        // 生成长图
        const resultPath = await this.createLongImage(imageInfos)

        wx.hideLoading()

        // 保存到全局数据
        app.globalData.resultImage = resultPath

        // 跳转到预览页面
        wx.navigateTo({
          url: '/pages/preview/preview'
        })
      } catch (error) {
        console.error('生成长图失败:', error)
        wx.hideLoading()
        wx.showToast({
          title: '生成失败，请重试',
          icon: 'none'
        })
      } finally {
        this.setData({ processing: false })
      }
    },

    // 获取所有图片信息
    getAllImageInfo(): Promise<ImageInfo[]> {
      const promises = this.data.images.map(imagePath => {
        return new Promise<ImageInfo>((resolve, reject) => {
          wx.getImageInfo({
            src: imagePath,
            success: (res) => {
              resolve({
                path: imagePath,
                width: res.width,
                height: res.height
              })
            },
            fail: reject
          })
        })
      })

      return Promise.all(promises)
    },

    // 创建长图
    createLongImage(imageInfos: ImageInfo[]): Promise<string> {
      return new Promise((resolve, reject) => {
        const firstImage = imageInfos[0]
        const canvasWidth = firstImage.width
        const subtitleHeightPx = this.data.subtitleHeight
        const cropPosition = this.data.cropPosition

        // 计算总高度
        let totalHeight = firstImage.height // 第一张完整高度
        for (let i = 1; i < imageInfos.length; i++) {
          totalHeight += subtitleHeightPx
        }

        // 创建离屏 Canvas
        const query = wx.createSelectorQuery().in(this)
        query.select('#canvas')
          .fields({ node: true, size: true })
          .exec((res) => {
            if (!res || !res[0]) {
              // 如果没有 Canvas 节点，使用旧版 API
              this.createLongImageLegacy(imageInfos, canvasWidth, totalHeight, subtitleHeightPx, cropPosition)
                .then(resolve)
                .catch(reject)
              return
            }

            const canvas = res[0].node
            const ctx = canvas.getContext('2d')

            // 设置 Canvas 尺寸
            canvas.width = canvasWidth
            canvas.height = totalHeight

            let currentY = 0

            // 绘制第一张完整图片
            const img0 = canvas.createImage()
            img0.onload = () => {
              ctx.drawImage(img0, 0, 0, firstImage.width, firstImage.height)
              currentY += firstImage.height

              // 递归绘制后续图片的字幕部分
              this.drawSubtitles(ctx, canvas, imageInfos, 1, currentY, subtitleHeightPx, cropPosition)
                .then(() => {
                  // 导出图片
                  wx.canvasToTempFilePath({
                    canvas,
                    success: (res) => {
                      resolve(res.tempFilePath)
                    },
                    fail: reject
                  })
                })
                .catch(reject)
            }
            img0.onerror = reject
            img0.src = firstImage.path
          })
      })
    },

    // 递归绘制字幕部分（新版 Canvas）
    drawSubtitles(
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
          this.drawSubtitles(ctx, canvas, imageInfos, index + 1, currentY + subtitleHeight, subtitleHeight, cropPosition)
            .then(resolve)
            .catch(reject)
        }
        img.onerror = reject
        img.src = imageInfo.path
      })
    },

    // 旧版 Canvas API 实现（兼容）
    createLongImageLegacy(
      imageInfos: ImageInfo[],
      canvasWidth: number,
      totalHeight: number,
      subtitleHeight: number,
      cropPosition: string
    ): Promise<string> {
      return new Promise((resolve, reject) => {
        const ctx = wx.createCanvasContext('canvas', this)
        const firstImage = imageInfos[0]
        let currentY = 0

        // 绘制第一张完整图片
        ctx.drawImage(firstImage.path, 0, 0, firstImage.width, firstImage.height)
        currentY += firstImage.height

        // 绘制后续图片的字幕部分
        for (let i = 1; i < imageInfos.length; i++) {
          const imageInfo = imageInfos[i]
          const sy = cropPosition === 'bottom'
            ? imageInfo.height - subtitleHeight
            : 0

          ctx.drawImage(
            imageInfo.path,
            0, sy, imageInfo.width, subtitleHeight,
            0, currentY, imageInfo.width, subtitleHeight
          )

          currentY += subtitleHeight
        }

        ctx.draw(false, () => {
          setTimeout(() => {
            wx.canvasToTempFilePath({
              canvasId: 'canvas',
              success: (res) => {
                resolve(res.tempFilePath)
              },
              fail: reject
            }, this)
          }, 500)
        })
      })
    }
  }
})

