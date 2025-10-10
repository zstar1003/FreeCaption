# FreeCaption 开发指南

## 快速开始

### 1. 环境准备

1. 下载并安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 确保已安装 Node.js（推荐 v14 或更高版本）

### 2. 导入项目

1. 打开微信开发者工具
2. 选择"导入项目"
3. 选择项目目录 `E:\code\FreeCaption`
4. AppID 使用测试号或者自己申请的 AppID
5. 点击"导入"

### 3. 编译运行

项目使用 TypeScript，导入后会自动编译。如果需要手动编译：

```bash
npm run build
```

## 项目架构

### 目录结构

```
FreeCaption/
├── miniprogram/              # 小程序源码目录
│   ├── pages/               # 页面文件
│   │   ├── index/          # 主页（上传和设置）
│   │   ├── preview/        # 预览页
│   │   └── logs/           # 日志页（可删除）
│   ├── utils/              # 工具函数
│   │   ├── imageUtils.ts   # 图片处理工具
│   │   ├── canvasUtils.ts  # Canvas 绘图工具
│   │   └── util.ts         # 通用工具
│   ├── app.ts              # 小程序入口文件
│   ├── app.json            # 小程序全局配置
│   └── app.wxss            # 全局样式
├── typings/                 # TypeScript 类型定义
├── project.config.json      # 项目配置
├── tsconfig.json           # TypeScript 配置
├── package.json            # npm 配置
└── README.md               # 项目说明
```

### 核心模块

#### 1. 主页面 (pages/index)

**功能**:
- 图片选择和管理
- 参数配置（字幕高度、裁剪位置）
- 调用拼接逻辑

**关键代码**:
```typescript
// 选择图片
chooseImages() {
  wx.chooseImage({
    count: 9,
    success: (res) => {
      this.setData({ images: res.tempFilePaths })
    }
  })
}

// 生成长图
async generateLongImage() {
  const imageInfos = await getAllImageInfo(this.data.images)
  const resultPath = await this.createLongImage(imageInfos)
  // 跳转预览
}
```

#### 2. 预览页面 (pages/preview)

**功能**:
- 显示生成的长图
- 保存到相册
- 返回编辑

**关键代码**:
```typescript
async saveImage() {
  await saveImageToAlbum(this.data.resultImage)
  wx.showToast({ title: '保存成功' })
}
```

#### 3. 图片工具 (utils/imageUtils.ts)

**提供的功能**:
- `getImageInfo()` - 获取单张图片信息
- `getAllImageInfo()` - 批量获取图片信息
- `calculateTotalHeight()` - 计算拼接后总高度
- `saveImageToAlbum()` - 保存图片到相册
- `compressImage()` - 压缩图片

#### 4. Canvas 工具 (utils/canvasUtils.ts)

**提供的功能**:
- `createLongImageWithCanvas2D()` - 使用新版 Canvas 2D API 绘制
- `createLongImageLegacy()` - 使用旧版 Canvas API 绘制（兼容）
- `getCanvasNode()` - 获取 Canvas 节点

## 核心技术实现

### Canvas 图片拼接原理

```
┌─────────────────┐
│   第一张完整图片  │  ← 完整高度
│                 │
│                 │
├─────────────────┤
│   第二张字幕区   │  ← 只截取字幕高度
├─────────────────┤
│   第三张字幕区   │  ← 只截取字幕高度
├─────────────────┤
│       ...       │
└─────────────────┘
```

### 实现步骤

1. **获取图片信息**
   ```typescript
   const imageInfos = await getAllImageInfo(imagePaths)
   ```

2. **计算总高度**
   ```typescript
   totalHeight = firstImage.height + (count - 1) * subtitleHeight
   ```

3. **创建 Canvas**
   ```typescript
   canvas.width = imageWidth
   canvas.height = totalHeight
   ```

4. **绘制第一张完整图片**
   ```typescript
   ctx.drawImage(img, 0, 0, width, height)
   ```

5. **循环绘制后续字幕**
   ```typescript
   for (let i = 1; i < images.length; i++) {
     const sy = cropPosition === 'bottom'
       ? imageHeight - subtitleHeight
       : 0
     ctx.drawImage(img, 0, sy, width, subtitleHeight,
                   0, currentY, width, subtitleHeight)
     currentY += subtitleHeight
   }
   ```

6. **导出为图片**
   ```typescript
   wx.canvasToTempFilePath({
     canvas,
     success: (res) => {
       // 获得临时文件路径
     }
   })
   ```

## 常见问题与调试

### 1. Canvas 绘制失败

**问题**: Canvas 节点无法获取
**解决**:
- 确保 WXML 中有 `<canvas type="2d" id="canvas"></canvas>`
- 检查 Canvas 是否在页面加载完成后才调用

### 2. 图片模糊

**问题**: 生成的长图不清晰
**解决**:
- 使用 `sizeType: ['original']` 选择原图
- 检查 Canvas 尺寸是否正确设置
- 避免多次压缩

### 3. 内存不足

**问题**: 处理大图或多图时崩溃
**解决**:
- 限制图片数量（建议不超过 9 张）
- 在选择时使用 `compressed` 模式
- 绘制前先压缩图片

### 4. 授权问题

**问题**: 无法保存到相册
**解决**:
- 使用 `wx.getSetting()` 检查授权状态
- 首次使用 `wx.authorize()` 请求授权
- 被拒绝后引导用户到设置页面

## 性能优化建议

### 1. 图片压缩
```typescript
// 在选择图片后立即压缩
const compressed = await compressImage(originalPath, 80)
```

### 2. 懒加载
```typescript
// 大量图片时使用懒加载
<image lazy-load="true" src="{{item}}" />
```

### 3. 分批处理
```typescript
// 如果图片过多，分批处理
for (let i = 0; i < images.length; i += BATCH_SIZE) {
  const batch = images.slice(i, i + BATCH_SIZE)
  await processBatch(batch)
}
```

### 4. 使用 Web Worker
```typescript
// 对于复杂计算，使用 Worker
const worker = wx.createWorker('workers/imageProcessor.js')
```

## 扩展功能建议

### 1. 添加滤镜效果
- 在 Canvas 绘制时应用滤镜
- 提供预设滤镜选项

### 2. 支持文字水印
- 在生成长图时添加文字
- 可自定义位置、字体、颜色

### 3. 批量处理
- 支持一次处理多组图片
- 生成多张长图

### 4. 云端存储
- 将生成的长图上传到云存储
- 支持分享链接

### 5. 模板功能
- 保存常用的参数配置
- 快速应用预设模板

## 发布上线

### 1. 代码审查
- [ ] 检查所有功能是否正常
- [ ] 测试各种异常情况
- [ ] 确保授权流程完善

### 2. 性能优化
- [ ] 压缩图片资源
- [ ] 优化代码体积
- [ ] 测试低端设备表现

### 3. 提交审核
1. 在微信开发者工具中点击"上传"
2. 填写版本号和更新说明
3. 登录小程序后台提交审核
4. 等待审核通过后发布

## 参考资源

- [微信小程序官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [Canvas API 文档](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Canvas.html)
- [TypeScript 文档](https://www.typescriptlang.org/docs/)

## 许可证

MIT License

---

如有问题，欢迎提 Issue 或 PR！
