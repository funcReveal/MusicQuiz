# MusicQuiz

## YouTube 播放清單解析

房間建立頁面改用 YouTube Data API v3 解析播放清單，需在 `.env` 設定金鑰：

```
VITE_YOUTUBE_API_KEY=your_api_key
```

金鑰可在 [Google Cloud Console](https://console.cloud.google.com/) 建立專案後啟用 YouTube Data API v3 取得。前端會直接呼叫 `playlistItems` 及 `videos` API，無需額外後端代理，但請確保來源網域已在 API 金鑰的限制名單中。
