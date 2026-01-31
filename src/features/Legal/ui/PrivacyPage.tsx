const PrivacyPage: React.FC = () => (
  <div className="mx-auto w-full max-w-3xl rounded-xl border border-slate-800 bg-slate-950/70 p-6 text-slate-200">
    <h2 className="text-2xl font-semibold text-slate-100">隱私權政策</h2>
    <p className="mt-3 text-sm text-slate-400">
      本服務尊重並保護您的個人資料。本政策說明我們如何蒐集、使用與保護資訊。
    </p>

    <div className="mt-6 space-y-4 text-sm">
      <section>
        <h3 className="text-base font-semibold text-slate-100">蒐集的資訊</h3>
        <p className="mt-1 text-slate-300">
          我們將蒐集您提供的暱稱、Google 帳號基本資訊（如 email、
          顯示名稱、頭像），YouTube
          播放清單，以及使用服務時的必要紀錄（例如房間與收藏庫資料）。
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-slate-100">使用目的</h3>
        <p className="mt-1 text-slate-300">
          用於登入識別、同步與保存收藏庫、改善服務品質與支援必要的功能運作。
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-slate-100">資訊分享</h3>
        <p className="mt-1 text-slate-300">
          除法律要求或服務運作需要外，我們不會對外出售或分享您的個人資訊。
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-slate-100">資料保存</h3>
        <p className="mt-1 text-slate-300">
          我們會在提供服務所需期間保存資料。您可透過聯絡方式提出刪除或更正請求。
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-slate-100">聯絡方式</h3>
        <p className="mt-1 text-slate-300">
          如有任何疑問，請聯繫：funcreveal@gmail.com
        </p>
      </section>
    </div>
  </div>
);

export default PrivacyPage;
