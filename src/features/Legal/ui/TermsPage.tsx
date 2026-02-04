const TermsPage: React.FC = () => (
  <div className="mx-auto w-full max-w-3xl rounded-2xl border border-[var(--mc-border)] bg-[var(--mc-surface)]/80 p-6 text-[var(--mc-text)] shadow-[0_20px_60px_-40px_rgba(2,6,23,0.8)]">
    <h2 className="text-2xl font-semibold text-[var(--mc-text)]">服務條款</h2>
    <p className="mt-2 text-xs uppercase tracking-[0.3em] text-[var(--mc-text-muted)]">
      最後更新：2026/02/02
    </p>
    <p className="mt-4 text-sm text-[var(--mc-text-muted)]">
      本服務由個人/團隊於台灣提供與營運。使用本平台即表示你已閱讀並同意
      以下條款。
    </p>

    <div className="mt-6 space-y-5 text-sm">
      <section>
        <h3 className="text-base font-semibold text-[var(--mc-text)]">
          1. 服務內容
        </h3>
        <p className="mt-2 text-[var(--mc-text-muted)]">
          本平台提供音樂問答、房間建立、播放清單匯入與收藏庫管理等功能。
          我們可能依營運需求調整或新增功能。
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-[var(--mc-text)]">
          2. 帳號與登入
        </h3>
        <p className="mt-2 text-[var(--mc-text-muted)]">
          你可使用 Google OAuth 或暱稱登入。若使用第三方登入，須遵守其
          服務條款與政策。
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-[var(--mc-text)]">
          3. 使用規範
        </h3>
        <ul className="mt-2 space-y-2 text-[var(--mc-text-muted)]">
          <li>不得從事違法或侵權行為。</li>
          <li>不得干擾或破壞本平台運作。</li>
          <li>不得以自動化或惡意方式存取服務。</li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-semibold text-[var(--mc-text)]">
          4. 內容與權利
        </h3>
        <p className="mt-2 text-[var(--mc-text-muted)]">
          播放清單與歌曲內容由第三方平台（如 YouTube）提供，本平台不擁有
          其著作權或內容權利。使用者須自行確保內容使用的合法性。
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-[var(--mc-text)]">
          5. 付費、廣告與贊助
        </h3>
        <p className="mt-2 text-[var(--mc-text-muted)]">
          未來可能引入小量廣告、付費訂閱（例如去除廣告或解鎖功能）或贊助。
          若啟用付費功能，我們會提供清楚的價格與退款政策。
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-[var(--mc-text)]">
          6. 服務變更與終止
        </h3>
        <p className="mt-2 text-[var(--mc-text-muted)]">
          我們可能因技術或營運需求調整或終止部分服務。若有重大變更，將
          以適當方式公告。
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-[var(--mc-text)]">
          7. 免責與責任限制
        </h3>
        <p className="mt-2 text-[var(--mc-text-muted)]">
          本服務依「現狀」提供。因不可抗力或第三方服務中斷造成的損害，
          本平台不負賠償責任。在法律允許範圍內，本平台的賠償責任以實際
          可歸責範圍為限。
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-[var(--mc-text)]">
          8. 準據法與管轄
        </h3>
        <p className="mt-2 text-[var(--mc-text-muted)]">
          本條款適用台灣法律。若有爭議，以台灣法院為第一審管轄法院。
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-[var(--mc-text)]">
          9. 聯絡方式
        </h3>
        <p className="mt-2 text-[var(--mc-text-muted)]">
          如有問題請聯繫：funcreveal@gmail.com
        </p>
      </section>
    </div>
  </div>
);

export default TermsPage;
