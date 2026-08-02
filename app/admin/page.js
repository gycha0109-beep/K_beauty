const FOUNDATION_ITEMS = Object.freeze([
  {
    title: "관리자 멤버십",
    description: "일반 프로필과 분리된 전용 역할 저장소를 사용합니다.",
    status: "Active"
  },
  {
    title: "Capability 재검증",
    description: "페이지 진입과 향후 변경 작업을 서로 다른 권한 경계에서 확인합니다.",
    status: "Active"
  },
  {
    title: "감사 로그 계약",
    description: "변경 전·후 값, 사유, 요청 식별자를 구조화해 기록할 기반을 마련했습니다.",
    status: "Ready"
  }
]);

const NEXT_SCOPE = Object.freeze([
  "제품 후보 검토 목록과 상세 근거",
  "approve / defer / block 사전 검증",
  "dry-run 결과와 실제 반영 분리",
  "관리자 조치 감사 이력"
]);

export default function AdminPage() {
  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <section>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6f7784]">
          Admin foundation
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          운영 도구의 보안 기반
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#646c78] dark:text-[#aeb5c0] sm:text-base">
          이 화면은 가짜 지표를 보여주는 대시보드가 아닙니다. 현재는 관리자 접근과 감사
          계약만 활성화하고, 실제 운영 데이터는 각 업무 기능이 연결될 때 추가합니다.
        </p>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3" aria-label="관리자 기반 상태">
        {FOUNDATION_ITEMS.map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-[#dfe3e9] bg-white p-5 shadow-[0_12px_35px_rgba(18,24,33,0.05)] dark:border-[#2b3038] dark:bg-[#16191f]"
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-base font-semibold">{item.title}</h3>
              <span className="rounded-full bg-[#e9f7ef] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#247347] dark:bg-[#173226] dark:text-[#80d3a5]">
                {item.status}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#69717d] dark:text-[#aeb5c0]">
              {item.description}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <article className="rounded-2xl border border-[#dfe3e9] bg-white p-6 dark:border-[#2b3038] dark:bg-[#16191f]">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#737b87]">
            Access boundary
          </p>
          <div className="mt-5 grid gap-3">
            {[
              ["1", "Middleware", "로그인 세션 존재 여부만 빠르게 확인"],
              ["2", "Admin layout", "활성 관리자 멤버십과 dashboard capability 재검증"],
              ["3", "DB boundary", "RLS와 제한된 함수가 데이터 접근을 최종 차단"]
            ].map(([step, title, description]) => (
              <div
                key={step}
                className="grid grid-cols-[36px_minmax(0,1fr)] gap-3 rounded-xl bg-[#f5f6f8] p-4 dark:bg-[#20242b]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#171a20] text-sm font-bold text-white dark:bg-[#f2f4f7] dark:text-[#171a20]">
                  {step}
                </span>
                <div>
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[#69717d] dark:text-[#aeb5c0]">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-[#dfe3e9] bg-[#171a20] p-6 text-white dark:border-[#343a44] dark:bg-[#f2f4f7] dark:text-[#171a20]">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/60 dark:text-[#5d6571]">
            Next vertical slice
          </p>
          <h3 className="mt-3 text-xl font-semibold">Product Candidate Reviews</h3>
          <ul className="mt-5 grid gap-3">
            {NEXT_SCOPE.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-6">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/70 dark:bg-[#4b535f]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 border-t border-white/15 pt-5 text-sm leading-6 text-white/65 dark:border-[#cfd4dc] dark:text-[#5d6571]">
            제품 검수 기능이 연결되기 전에는 운영 수치나 처리 건수를 임의로 표시하지 않습니다.
          </p>
        </article>
      </section>
    </div>
  );
}
