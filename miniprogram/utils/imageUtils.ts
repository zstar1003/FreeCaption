// utils/imageUtils.ts
// 图片处理相关工具函数

export interface ImageInfo {
  path: string
  width: number
  height: number
}

/**
 * 获取图片信息
 */
export function getImageInfo(imagePath: string): Promise<ImageInfo> {
  return new Promise((resolve, reject) => {
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
}

/**
 * 批量获取图片信息
 */
export function getAllImageInfo(imagePaths: string[]): Promise<ImageInfo[]> {
  const promises = imagePaths.map(path => getImageInfo(path))
  return Promise.all(promises)
}

/**
 * 计算拼接后的总高度
 */
export function calculateTotalHeight(
  imageInfos: ImageInfo[],
  subtitleHeight: number
): number {
  if (imageInfos.length === 0) return 0

  // 第一张完整高度 + 其他图片的字幕高度
  let totalHeight = imageInfos[0].height
  for (let i = 1; i < imageInfos.length; i++) {
    totalHeight += subtitleHeight
  }

  return totalHeight
}

/**
 * 保存图片到相册
 */
export function saveImageToAlbum(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 先检查授权状态
    wx.getSetting({
      success(res) {
        if (!res.authSetting['scope.writePhotosAlbum']) {
          // 请求授权
          wx.authorize({
            scope: 'scope.writePhotosAlbum',
            success() {
              doSave()
            },
            fail() {
              wx.showModal({
                title: '提示',
                content: '需要您授权保存图片到相册',
                confirmText: '去授权',
                success(modalRes) {
                  if (modalRes.confirm) {
                    wx.openSetting({
                      success(settingRes) {
                        if (settingRes.authSetting['scope.writePhotosAlbum']) {
                          doSave()
                        } else {
                          reject(new Error('用户拒绝授权'))
                        }
                      }
                    })
                  } else {
                    reject(new Error('用户取消授权'))
                  }
                }
              })
            }
          })
        } else {
          doSave()
        }
      },
      fail: reject
    })

    function doSave() {
      wx.saveImageToPhotosAlbum({
        filePath,
        success: () => resolve(),
        fail: reject
      })
    }
  })
}

/**
 * 压缩图片
 */
export function compressImage(src: string, quality: number = 80): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.compressImage({
      src,
      quality,
      success: (res) => resolve(res.tempFilePath),
      fail: reject
    })
  })
}
