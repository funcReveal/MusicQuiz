const PrivacyPage: React.FC = () => (
  <div className="mx-auto w-full max-w-3xl rounded-2xl border border-[var(--mc-border)] bg-[var(--mc-surface)]/80 p-6 text-[var(--mc-text)] shadow-[0_20px_60px_-40px_rgba(2,6,23,0.8)]">
    <h2 className="text-2xl font-semibold text-[var(--mc-text)]">隱私權政策</h2>
    <p className="mt-2 text-xs uppercase tracking-[0.3em] text-[var(--mc-text-muted)]">
      最後更新：2026/02/02
    </p>
    <p className="mt-4 text-sm text-[var(--mc-text-muted)]">
      本服務（以下稱「本平台」）由個人/團隊於台灣提供與營運。目前未設立
      公司行號，若有隱私相關問題，請聯絡：funcreveal@gmail.com。
    </p>

    <div className="mt-6 space-y-5 text-sm">
      <section>
        <h3 className="text-base font-semibold text-[var(--mc-text)]">
          1. 我們蒐集的資料類型
        </h3>
        <ul className="mt-2 space-y-2 text-[var(--mc-text-muted)]">
          <li>
            帳號與識別資料：Google OAuth 登入時的名稱、電子郵件、頭像與 Google
            使用者 ID；使用者自訂暱稱。
          </li>
          <li>
            使用行為資料：建立/加入房間、播放清單匯入、收藏庫操作、遊戲
            使用紀錄等。
          </li>
          <li>
            技術與裝置資料：IP 位址、瀏覽器與作業系統類型、連線資訊（含
            WebSocket 連線事件）。
          </li>
          <li>
            本機儲存：為改善體驗，我們會在瀏覽器保存暱稱、房間 ID、題數
            設定、音量、密碼暫存與部分狀態（localStorage）。
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-semibold text-[var(--mc-text)]">
          2. 蒐集方式
        </h3>
        <p className="mt-2 text-[var(--mc-text-muted)]">
          我們透過使用者主動提供（例如登入、輸入暱稱、匯入播放清單）以及
          自動記錄（例如連線資訊與功能使用紀錄）取得資料。
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-[var(--mc-text)]">
          3. 使用目的
        </h3>
        <ul className="mt-2 space-y-2 text-[var(--mc-text-muted)]">
          <li>提供登入驗證、房間與遊戲功能。</li>
          <li>同步 YouTube 播放清單與收藏庫。</li>
          <li>維持服務安全、除錯、改善使用體驗。</li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-semibold text-[var(--mc-text)]">
          4. 第三方服務
        </h3>
        <p className="mt-2 text-[var(--mc-text-muted)]">
          我們使用 Google OAuth 與 YouTube API 提供登入與播放清單功能。
          前後端可能部署於雲端平台（例如 Vercel、Render）。必要時資料會在
          這些第三方服務之間傳輸或處理。
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-[var(--mc-text)]">
          5. Cookie 與本機儲存
        </h3>
        <p className="mt-2 text-[var(--mc-text-muted)]">
          我們使用 HttpOnly cookie 儲存 refresh token 以維持登入狀態，並使用
          localStorage 保存偏好設定與暫存資訊。你可透過清除瀏覽器資料移除
          相關資訊。
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-[var(--mc-text)]">
          6. 資料保存期間
        </h3>
        <p className="mt-2 text-[var(--mc-text-muted)]">
          我們在服務提供期間保存必要資料。日後若提供帳號/資料刪除功能，
          將依你的申請刪除或匿名化處理。
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-[var(--mc-text)]">
          7. 使用者權利
        </h3>
        <p className="mt-2 text-[var(--mc-text-muted)]">
          你可依台灣個資法請求查詢、補正、停止蒐集或刪除資料。請透過
          funcreveal@gmail.com 聯絡。
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-[var(--mc-text)]">
          8. 未成年人保護
        </h3>
        <p className="mt-2 text-[var(--mc-text-muted)]">
          若你未滿 18 歲，請在法定代理人同意下使用本服務。
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-[var(--mc-text)]">
          9. 政策更新
        </h3>
        <p className="mt-2 text-[var(--mc-text-muted)]">
          本政策可能依營運需求更新，更新後將公告於本頁。
        </p>
      </section>
    </div>
  </div>
);

export default PrivacyPage;
