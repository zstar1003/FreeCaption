// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  const { value } = event

  console.log('收到图片安全检测请求')
  console.log('图片数据大小:', (value.length * 0.75 / 1024 / 1024).toFixed(2), 'MB')

  try {
    // 检查参数
    if (!value) {
      return {
        success: false,
        errCode: -1,
        errMsg: '缺少图片数据'
      }
    }

    // 转换 base64 为 Buffer
    const imgBuffer = Buffer.from(value, 'base64')
    console.log('Buffer 大小:', (imgBuffer.length / 1024).toFixed(2), 'KB')

    // 调用内容安全检测接口
    const result = await cloud.openapi.security.imgSecCheck({
      media: {
        contentType: 'image/png',
        value: imgBuffer
      }
    })

    console.log('图片安全检测结果:', {
      errCode: result.errCode,
      errMsg: result.errMsg
    })

    // errCode 为 0 表示通过检测
    // errCode 为 87014 表示内容含有违法违规内容
    if (result.errCode === 0) {
      return {
        success: true,
        errCode: 0,
        errMsg: '检测通过'
      }
    } else if (result.errCode === 87014) {
      return {
        success: false,
        errCode: 87014,
        errMsg: '图片内容违规'
      }
    } else {
      // 其他错误码，放行
      console.warn('检测返回非标准错误码:', result.errCode)
      return {
        success: true,
        errCode: result.errCode,
        errMsg: result.errMsg || '检测异常，已放行'
      }
    }
  } catch (err) {
    console.error('图片安全检测失败:', {
      errCode: err.errCode,
      errMsg: err.errMsg,
      error: err
    })

    // 如果是明确的违规（errCode 87014），返回检测失败
    if (err.errCode === 87014) {
      return {
        success: false,
        errCode: 87014,
        errMsg: '图片内容违规'
      }
    }

    // 其他错误情况，选择放行，避免因网络等问题影响用户体验
    console.warn('检测异常，默认放行')
    return {
      success: true,
      errCode: err.errCode || -1,
      errMsg: err.errMsg || '检测异常，已放行'
    }
  }
}
