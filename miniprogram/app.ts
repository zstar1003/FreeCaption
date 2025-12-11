// app.ts
App<IAppOption>({
  globalData: {
    resultImage: '' // 存储生成的长图路径
  },
  onLaunch() {
    // 初始化云开发环境
    if (wx.cloud) {
      wx.cloud.init({
        // env 参数说明：
        //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
        //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
        //   如不填则使用默认环境（第一个创建的环境）
        traceUser: true,
      })
      console.log('云开发环境初始化成功')
    } else {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    }

    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 登录
    wx.login({
      success: res => {
        console.log(res.code)
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
      },
    })
  },
})