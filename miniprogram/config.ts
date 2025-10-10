// config.ts
// 应用配置文件

export const APP_CONFIG = {
  // 应用基本信息
  APP_NAME: '拼字幕',
  VERSION: '1.0.0',

  // 图片相关配置
  IMAGE: {
    MAX_COUNT: 9, // 最多选择图片数量
    MAX_SIZE: 10 * 1024 * 1024, // 单张图片最大大小（10MB）
    COMPRESS_QUALITY: 80, // 压缩质量（0-100）
    ALLOWED_TYPES: ['jpg', 'jpeg', 'png'] // 允许的图片类型
  },

  // 字幕配置
  SUBTITLE: {
    MIN_HEIGHT: 50, // 最小字幕高度（像素）
    MAX_HEIGHT: 500, // 最大字幕高度（像素）
    DEFAULT_HEIGHT: 150, // 默认字幕高度（像素）
    CROP_POSITIONS: [
      { label: '底部', value: 'bottom' },
      { label: '顶部', value: 'top' }
    ],
    DEFAULT_POSITION: 'bottom' // 默认裁剪位置
  },

  // Canvas 配置
  CANVAS: {
    MAX_WIDTH: 2000, // Canvas 最大宽度
    MAX_HEIGHT: 10000, // Canvas 最大高度
    EXPORT_QUALITY: 1.0, // 导出质量（0-1）
    EXPORT_FORMAT: 'png' // 导出格式
  },

  // UI 配置
  UI: {
    PRIMARY_COLOR: '#667eea', // 主题色
    SECONDARY_COLOR: '#764ba2', // 辅助色
    LOADING_TEXT: '生成中...', // 加载提示文字
    SUCCESS_TEXT: '生成成功', // 成功提示文字
    ERROR_TEXT: '生成失败，请重试' // 错误提示文字
  },

  // 性能配置
  PERFORMANCE: {
    DRAW_DELAY: 500, // Canvas 绘制延迟（毫秒）
    BATCH_SIZE: 5 // 批量处理大小
  }
}

// 错误消息配置
export const ERROR_MESSAGES = {
  NO_IMAGE: '请至少选择一张图片',
  MIN_IMAGE_COUNT: '至少需要2张图片才能生成长图',
  MAX_IMAGE_COUNT: `最多只能选择${APP_CONFIG.IMAGE.MAX_COUNT}张图片`,
  IMAGE_TOO_LARGE: '图片太大，请选择小一点的图片',
  IMAGE_LOAD_FAIL: '图片加载失败',
  CANVAS_CREATE_FAIL: 'Canvas 创建失败',
  SAVE_FAIL: '保存失败',
  AUTH_DENIED: '需要授权才能保存图片'
}

// 成功消息配置
export const SUCCESS_MESSAGES = {
  SAVE_SUCCESS: '保存成功',
  GENERATE_SUCCESS: '生成成功'
}
