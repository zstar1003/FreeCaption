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
    subtitleTop: 0, // 字幕上边界（像素）
    subtitleBottom: 150, // 字幕下边界（像素）
    processing: false, // 是否正在处理
    canvasWidth: 750, // Canvas 宽度
    canvasHeight: 3000, // Canvas 高度
    previewImage: '', // 预览参考图（第二张图片）
    previewHeight: 0 // 预览图高度
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
          const newImages = [...this.data.images, ...tempFilePaths]

          this.setData({
            images: newImages
          })

          // 如果有第二张图片，设置为预览参考图
          if (newImages.length >= 2 && !this.data.previewImage) {
            this.setPreviewImage(newImages[1])
          }
        }
      })
    },

    // 设置预览参考图
    setPreviewImage(imagePath: string) {
      wx.getImageInfo({
        src: imagePath,
        success: (res) => {
          // 计算符合底部字幕的默认值
          // 一般字幕占图片高度的 15-20%，位于底部
          const defaultSubtitleHeight = Math.floor(res.height * 0.18) // 字幕高度约为图片的18%
          const defaultTop = res.height - defaultSubtitleHeight
          const defaultBottom = res.height

          this.setData({
            previewImage: imagePath,
            previewHeight: res.height,
            subtitleTop: defaultTop,
            subtitleBottom: defaultBottom
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

    // 字幕上边界改变
    onSubtitleTopChange(e: any) {
      const top = e.detail.value
      // 确保上边界不超过下边界
      if (top < this.data.subtitleBottom) {
        this.setData({
          subtitleTop: top
        })
      }
    },

    // 字幕下边界改变
    onSubtitleBottomChange(e: any) {
      const bottom = e.detail.value
      // 确保下边界不低于上边界
      if (bottom > this.data.subtitleTop) {
        this.setData({
          subtitleBottom: bottom
        })
      }
    },

    // 滑块拖动时实时更新（更灵敏）
    onSubtitleTopChanging(e: any) {
      const top = e.detail.value
      if (top < this.data.subtitleBottom) {
        this.setData({
          subtitleTop: top
        })
      }
    },

    onSubtitleBottomChanging(e: any) {
      const bottom = e.detail.value
      if (bottom > this.data.subtitleTop) {
        this.setData({
          subtitleBottom: bottom
        })
      }
    },

    // 点击上边界数字，弹窗输入
    onClickSubtitleTop() {
      const that = this
      wx.showModal({
        title: '设置上边界',
        editable: true,
        placeholderText: `当前值：${this.data.subtitleTop}px`,
        content: String(this.data.subtitleTop),
        success(res) {
          if (res.confirm && res.content) {
            const value = parseInt(res.content)
            if (!isNaN(value) && value >= 0 && value < that.data.subtitleBottom && value <= that.data.previewHeight) {
              that.setData({
                subtitleTop: value
              })
            } else {
              wx.showToast({
                title: '输入值无效',
                icon: 'none'
              })
            }
          }
        }
      })
    },

    // 点击下边界数字，弹窗输入
    onClickSubtitleBottom() {
      const that = this
      wx.showModal({
        title: '设置下边界',
        editable: true,
        placeholderText: `当前值：${this.data.subtitleBottom}px`,
        content: String(this.data.subtitleBottom),
        success(res) {
          if (res.confirm && res.content) {
            const value = parseInt(res.content)
            if (!isNaN(value) && value > that.data.subtitleTop && value <= that.data.previewHeight) {
              that.setData({
                subtitleBottom: value
              })
            } else {
              wx.showToast({
                title: '输入值无效',
                icon: 'none'
              })
            }
          }
        }
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
        const subtitleTop = this.data.subtitleTop
        const subtitleBottom = this.data.subtitleBottom
        const subtitleHeight = subtitleBottom - subtitleTop

        // 计算总高度
        let totalHeight = firstImage.height
        for (let i = 1; i < imageInfos.length; i++) {
          totalHeight += subtitleHeight
        }

        console.log('开始绘制长图', {
          width: firstImage.width,
          height: totalHeight,
          subtitleTop,
          subtitleBottom,
          subtitleHeight,
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

            // 裁剪字幕区域：从 subtitleTop 到 subtitleBottom
            ctx.drawImage(
              imageInfo.path,
              0, subtitleTop, imageInfo.width, subtitleHeight,  // 源图裁剪
              0, currentY, imageInfo.width, subtitleHeight  // 目标位置
            )

            currentY += subtitleHeight
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

