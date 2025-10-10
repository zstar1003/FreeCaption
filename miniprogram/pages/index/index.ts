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
    processing: false, // 是否正在处理
    canvasWidth: 750, // Canvas 宽度
    canvasHeight: 3000 // Canvas 高度
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
        cropPosition: e.detail.value
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

    // 创建长图 - 使用旧版稳定的 Canvas API
    createLongImage(imageInfos: ImageInfo[]): Promise<string> {
      return new Promise((resolve, reject) => {
        const firstImage = imageInfos[0]
        const subtitleHeightPx = this.data.subtitleHeight
        const cropPosition = this.data.cropPosition

        // 计算总高度
        let totalHeight = firstImage.height
        for (let i = 1; i < imageInfos.length; i++) {
          totalHeight += subtitleHeightPx
        }

        console.log('开始绘制长图', {
          width: firstImage.width,
          height: totalHeight,
          imageCount: imageInfos.length
        })

        // 设置 Canvas 尺寸
        this.setData({
          canvasWidth: firstImage.width,
          canvasHeight: totalHeight
        }, () => {
          // Canvas 尺寸设置完成后开始绘制
          const ctx = wx.createCanvasContext('myCanvas', this)

          let currentY = 0

          // 绘制第一张完整图片
          ctx.drawImage(firstImage.path, 0, 0, firstImage.width, firstImage.height)
          currentY += firstImage.height

          // 绘制后续图片的字幕部分
          for (let i = 1; i < imageInfos.length; i++) {
            const imageInfo = imageInfos[i]
            const sy = cropPosition === 'bottom'
              ? imageInfo.height - subtitleHeightPx
              : 0

            ctx.drawImage(
              imageInfo.path,
              0, sy, imageInfo.width, subtitleHeightPx,  // 源图裁剪
              0, currentY, imageInfo.width, subtitleHeightPx  // 目标位置
            )

            currentY += subtitleHeightPx
          }

          // 绘制完成，导出图片
          ctx.draw(false, () => {
            setTimeout(() => {
              wx.canvasToTempFilePath({
                x: 0,
                y: 0,
                width: firstImage.width,
                height: totalHeight,
                destWidth: firstImage.width,
                destHeight: totalHeight,
                canvasId: 'myCanvas',
                fileType: 'jpg',
                quality: 1,
                success: (res) => {
                  console.log('导出成功', res.tempFilePath)
                  resolve(res.tempFilePath)
                },
                fail: (err) => {
                  console.error('导出失败', err)
                  reject(err)
                }
              }, this)
            }, 1000)
          })
        })
      })
    }
  }
})

