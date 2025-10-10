// preview.ts
import { saveImageToAlbum } from '../../utils/imageUtils'

Page({
  data: {
    resultImage: ''
  },

  onLoad(options: any) {
    // 从全局数据或页面参数中获取拼接后的图片
    const app = getApp<IAppOption>()
    if (app.globalData.resultImage) {
      this.setData({
        resultImage: app.globalData.resultImage
      })
    }
  },

  // 返回编辑
  goBack() {
    wx.navigateBack()
  },

  // 保存图片到相册
  async saveImage() {
    if (!this.data.resultImage) {
      wx.showToast({
        title: '没有可保存的图片',
        icon: 'none'
      })
      return
    }

    wx.showLoading({
      title: '保存中...',
      mask: true
    })

    try {
      await saveImageToAlbum(this.data.resultImage)
      wx.hideLoading()
      wx.showToast({
        title: '保存成功',
        icon: 'success',
        duration: 2000
      })
    } catch (error) {
      console.error('保存失败:', error)
      wx.hideLoading()
      wx.showToast({
        title: '保存失败',
        icon: 'none',
        duration: 2000
      })
    }
  }
})

