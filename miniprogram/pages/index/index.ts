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
    coverBottom: 0, // 封面底部边界（像素，0表示不裁切）
    processing: false, // 是否正在处理
    canvasWidth: 750, // Canvas 宽度
    canvasHeight: 3000, // Canvas 高度
    previewImage: '', // 预览参考图（第二张图片）
    previewHeight: 0, // 预览图高度
    coverImage: '', // 封面预览图（第一张图片）
    coverHeight: 0 // 封面图高度
  },

  methods: {
    // 图片安全检测（带超时保护）
    async checkImageSecurity(imagePath: string): Promise<boolean> {
      try {
        // 创建一个超时 Promise
        const timeoutPromise = new Promise<boolean>((resolve) => {
          setTimeout(() => {
            console.warn('图片检测超时（30秒），自动放行')
            resolve(true)
          }, 30000) // 30 秒超时
        })

        // 创建检测 Promise
        const checkPromise = this.doImageSecurityCheck(imagePath)

        // 使用 Promise.race 实现超时控制
        return await Promise.race([checkPromise, timeoutPromise])
      } catch (error: any) {
        console.error('图片安全检测异常:', error)
        return true // 异常时默认放行
      }
    },

    // 实际的图片安全检测逻辑
    async doImageSecurityCheck(imagePath: string): Promise<boolean> {
      try {
        // 先获取图片信息，检查大小
        const imageInfo = await new Promise<any>((resolve, reject) => {
          wx.getImageInfo({
            src: imagePath,
            success: resolve,
            fail: reject
          })
        })

        console.log('图片信息:', {
          width: imageInfo.width,
          height: imageInfo.height,
          path: imagePath
        })

        // 如果图片较大，先压缩
        let checkPath = imagePath
        const fileSystemManager = wx.getFileSystemManager()
        const stats = fileSystemManager.statSync(imagePath)
        const fileSizeKB = stats.size / 1024

        console.log('图片大小:', fileSizeKB.toFixed(2), 'KB')

        // 如果图片超过 500KB，先压缩
        if (fileSizeKB > 500) {
          console.log('图片较大，开始压缩...')
          checkPath = await this.compressImage(imagePath)
        }

        // 读取图片文件为 base64
        const imageData = fileSystemManager.readFileSync(checkPath, 'base64')

        // 检查 base64 数据大小，微信限制为 5MB
        const base64Size = imageData.length * 0.75 / 1024 / 1024 // 转换为 MB
        console.log('Base64 数据大小:', base64Size.toFixed(2), 'MB')

        if (base64Size > 5) {
          console.warn('图片 base64 超过 5MB，跳过检测')
          return true // 图片太大，跳过检测
        }

        // 调用云函数进行安全检测
        const res = await wx.cloud.callFunction({
          name: 'imgSecCheck',
          data: {
            value: imageData
          },
          timeout: 60000 // 60 秒超时
        })

        const result: any = res.result
        console.log('图片安全检测结果:', result)

        return result.success
      } catch (error: any) {
        console.error('图片安全检测异常:', error)

        // 如果是超时错误，给出明确提示
        if (error.errCode === -404012 || (error.errMsg && error.errMsg.includes('timeout'))) {
          console.warn('检测超时，默认放行')
        }

        // 检测异常时默认放行，避免影响用户体验
        return true
      }
    },

    // 压缩图片
    compressImage(imagePath: string): Promise<string> {
      return new Promise((resolve, reject) => {
        wx.compressImage({
          src: imagePath,
          quality: 70, // 压缩质量 70%
          compressedWidth: 1080, // 压缩后宽度最大 1080px
          success: (res) => {
            console.log('图片压缩成功:', res.tempFilePath)
            resolve(res.tempFilePath)
          },
          fail: (err) => {
            console.warn('图片压缩失败，使用原图:', err)
            resolve(imagePath) // 压缩失败仍使用原图
          }
        })
      })
    },

    // 选择图片
    async chooseImages() {
      const currentCount = this.data.images.length
      const maxCount = 9 - currentCount

      wx.chooseImage({
        count: maxCount,
        sizeType: ['original', 'compressed'],
        sourceType: ['album', 'camera'],
        success: async (res) => {
          const tempFilePaths = res.tempFilePaths
          const totalCount = tempFilePaths.length

          // 显示检测提示
          wx.showLoading({
            title: `检测中 0/${totalCount}`,
            mask: true
          })

          try {
            // 对每张图片进行安全检测
            const validImages: string[] = []
            const invalidImages: string[] = []

            for (let i = 0; i < tempFilePaths.length; i++) {
              const imagePath = tempFilePaths[i]

              // 更新进度提示
              wx.showLoading({
                title: `检测中 ${i + 1}/${totalCount}`,
                mask: true
              })

              console.log(`开始检测第 ${i + 1}/${totalCount} 张图片`)
              const isValid = await this.checkImageSecurity(imagePath)
              console.log(`第 ${i + 1}/${totalCount} 张图片检测完成，结果:`, isValid)

              if (isValid) {
                validImages.push(imagePath)
              } else {
                invalidImages.push(imagePath)
              }
            }

            wx.hideLoading()

            // 如果有违规图片，提示用户
            if (invalidImages.length > 0) {
              wx.showModal({
                title: '内容安全提示',
                content: `检测到${invalidImages.length}张图片包含违规内容，已自动过滤。请上传合规图片。`,
                showCancel: false
              })
            }

            // 添加通过检测的图片
            if (validImages.length > 0) {
              const newImages = [...this.data.images, ...validImages]

              this.setData({
                images: newImages
              })

              // 如果有第一张图片，设置为封面预览图
              if (newImages.length >= 1 && !this.data.coverImage) {
                this.setCoverImage(newImages[0])
              }

              // 如果有第二张图片，设置为预览参考图
              if (newImages.length >= 2 && !this.data.previewImage) {
                this.setPreviewImage(newImages[1])
              }

              // 提示成功添加的图片数量
              if (validImages.length > 0) {
                wx.showToast({
                  title: `已添加${validImages.length}张图片`,
                  icon: 'success'
                })
              }
            } else if (invalidImages.length === 0) {
              // 没有选择任何图片
              wx.showToast({
                title: '未选择图片',
                icon: 'none'
              })
            }
          } catch (error) {
            console.error('图片检测处理失败:', error)
            wx.hideLoading()
            wx.showToast({
              title: '图片处理失败',
              icon: 'none'
            })
          }
        }
      })
    },

    // 设置封面预览图
    setCoverImage(imagePath: string) {
      wx.getImageInfo({
        src: imagePath,
        success: (res) => {
          // 默认封面底部边界为图片底部（不裁切）
          this.setData({
            coverImage: imagePath,
            coverHeight: res.height,
            coverBottom: res.height
          })
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

    // 封面底部边界改变
    onCoverBottomChange(e: any) {
      this.setData({
        coverBottom: e.detail.value
      })
    },

    // 封面底部边界拖动时实时更新
    onCoverBottomChanging(e: any) {
      this.setData({
        coverBottom: e.detail.value
      })
    },

    // 点击封面底部边界数字，弹窗输入
    onClickCoverBottom() {
      const that = this
      wx.showModal({
        title: '设置封面底部边界',
        editable: true,
        placeholderText: `当前值：${this.data.coverBottom}px`,
        content: String(this.data.coverBottom),
        success(res) {
          if (res.confirm && res.content) {
            const value = parseInt(res.content)
            if (!isNaN(value) && value > 0 && value <= that.data.coverHeight) {
              that.setData({
                coverBottom: value
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
        const coverBottom = this.data.coverBottom

        // 计算封面实际高度（如果设置了裁切）
        const coverHeight = coverBottom > 0 ? coverBottom : firstImage.height

        // 计算总高度
        let totalHeight = coverHeight
        for (let i = 1; i < imageInfos.length; i++) {
          totalHeight += subtitleHeight
        }

        console.log('开始绘制长图', {
          width: firstImage.width,
          height: totalHeight,
          coverHeight,
          coverBottom,
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

          // 绘制第一张图片（可能裁切底部）
          if (coverBottom > 0 && coverBottom < firstImage.height) {
            // 裁切封面底部
            ctx.drawImage(
              firstImage.path,
              0, 0, firstImage.width, coverBottom,  // 源图裁剪：从顶部到coverBottom
              0, 0, firstImage.width, coverBottom  // 目标位置
            )
            currentY += coverBottom
          } else {
            // 不裁切，绘制完整封面
            ctx.drawImage(firstImage.path, 0, 0, firstImage.width, firstImage.height)
            currentY += firstImage.height
          }

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

