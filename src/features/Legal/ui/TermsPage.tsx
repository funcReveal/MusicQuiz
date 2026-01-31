const TermsPage: React.FC = () => (
  <div className="mx-auto w-full max-w-3xl rounded-xl border border-slate-800 bg-slate-950/70 p-6 text-slate-200">
    <h2 className="text-2xl font-semibold text-slate-100">服務條款</h2>
    <p className="mt-3 text-sm text-slate-400">
      使用本服務即代表您同意以下條款。若您不同意，請停止使用本服務。
    </p>

    <div className="mt-6 space-y-4 text-sm">
      <section>
        <h3 className="text-base font-semibold text-slate-100">使用規範</h3>
        <p className="mt-1 text-slate-300">
          您不得以任何非法或未經授權的方式使用本服務，亦不得干擾或破壞服務運作。
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-slate-100">帳號與資料</h3>
        <p className="mt-1 text-slate-300">
          您須對自己的登入資訊與使用行為負責。請勿分享敏感資訊給他人。
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-slate-100">內容與權利</h3>
        <p className="mt-1 text-slate-300">
          您上傳或建立的內容須符合相關法律與平台規範。本服務保留移除不當內容的權利。
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-slate-100">責任限制</h3>
        <p className="mt-1 text-slate-300">
          本服務以現況提供，不保證永不中斷。對於任何直接或間接損害不承擔責任。
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-slate-100">條款更新</h3>
        <p className="mt-1 text-slate-300">
          本條款可能不定期更新，更新後將於本頁公告並立即生效。
        </p>
      </section>
    </div>
  </div>
);

export default TermsPage;
