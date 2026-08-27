/*
 * 온보딩(/setting)의 폭별 레이아웃을 확인한다.
 *
 * 넓은 화면(≥1024)에서는 왼쪽 진행 패널 + 오른쪽 질문 2열이고,
 * 그보다 좁으면 예전 그대로 한 화면에 하나씩이다.
 * 단계를 실제로 눌러 넘기며 찍는다.
 *
 * **단계 수가 로그인 여부에 따라 다르다.**
 *   게스트  날짜 → 예산 → 이름 → 약관               (4단계)
 *   회원    날짜 → 예산 → 이름 → 약관 → 함께할 사람  (5단계)
 * 게스트는 방이 없어 공유 코드가 안 나오므로 초대 단계를 내지 않는다.
 *
 * **초대는 반드시 저장 뒤에 온다.** `POST /plan/setting` 이 먼저 나가지 않으면
 * 초대받은 사람이 날짜·예산·이름이 빈 플랜에 들어오고, 필수·제3자 제공 동의
 * 전에 접근 권한을 주는 링크가 나간다. 요청 순서(`seen`)로 확인한다.
 * 두 모드를 모두 돈다 (회원 모드는 기본 375·1280 두 폭만 — 초대 단계
 * 마크업은 폭과 무관하고, 좌우 분할은 게스트 모드에서 이미 다 본다).
 *
 * 준비:  npm run dev / npm install --no-save puppeteer-core
 * 실행:  node scripts/onboarding.cjs
 *        PORT=3010 node scripts/onboarding.cjs   (다른 포트의 dev 서버)
 *        HEADED=1 을 붙이면 브라우저를 띄워 직접 눌러볼 수 있다
 */
const path = require("path");
// 워크트리에서 돌릴 때는 레포 루트의 node_modules 로 올라가 찾는다
let p;
try {
  p = require(path.join(__dirname, "..", "node_modules", "puppeteer-core"));
} catch {
  p = require("puppeteer-core");
}

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const API = "https://api.seoulmoment.com.tw";
const ORIGIN = `http://localhost:${process.env.PORT || 3000}`;
const OUT = process.env.SHOT_DIR || __dirname;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const CORS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
};
const ok = (d) => ({
  status: 200,
  headers: CORS,
  contentType: "application/json",
  body: JSON.stringify({ result: true, data: d }),
});

/**
 * 게스트는 백엔드가 전부 빈 응답이면 된다. 회원 모드는 세 가지를 진짜처럼
 * 준다 — `/plan/user`, `/plan/room/share-code`(초대 단계가 링크를 받아 오는
 * 곳), `POST /plan/setting`(약관 단계의 저장).
 *
 * **`/plan/user` 는 상태를 갖는다.** 저장 전에는 날짜·예산·이름이 비어 있어야
 * 온보딩이 계속 진행되고, 저장 뒤에는 채워져 있어야 재진입 시 `/main` 으로
 * 튕기는 실제 동작(`isPlanDataComplete`)을 재현할 수 있다. 늘 비어 있게 두면
 * "나갔다 들어오면 대시보드" 를 확인할 방법이 없다.
 */
function installMocks(page, member, seen) {
  /** POST /plan/setting 으로 저장된 값. null 이면 아직 저장 전 */
  let saved = null;

  page.on("request", (req) => {
    const url = req.url();
    if (!url.startsWith(API)) {
      req.continue().catch(() => {});
      return;
    }
    if (req.method() === "OPTIONS") {
      req.respond({ status: 204, headers: CORS, body: "" }).catch(() => {});
      return;
    }
    const path = url.slice(API.length);
    seen.push(`${req.method()} ${path}`);
    if (member && req.method() === "POST" && path.startsWith("/plan/setting")) {
      try {
        saved = JSON.parse(req.postData() || "{}");
      } catch {
        saved = {};
      }
      req.respond(ok({ ok: true })).catch(() => {});
      return;
    }
    if (member && path.startsWith("/plan/room/share-code")) {
      req.respond(ok({ shareCode: "HARNESS1" })).catch(() => {});
      return;
    }
    if (member && path.startsWith("/plan/user")) {
      req
        .respond(
          ok({
            id: "u1",
            weddingDate: saved?.weddingDate ?? null,
            budget: saved?.budget ?? null,
            name: saved?.name ?? null,
            requiredAgreementDate: saved?.requiredAgreementDate ?? null,
            adAgreementDate: saved?.adAgreementDate ?? null,
            members: [
              {
                planUserId: "u1",
                name: "나",
                image: null,
                permission: "OWNER",
              },
            ],
          }),
        )
        .catch(() => {});
      return;
    }
    req.respond(ok({ list: [], total: 0 })).catch(() => {});
  });
}

/** 지금 화면의 좌측 패널 상태를 읽는다 */
const readAside = () =>
  document.querySelector("aside[class*='w-[340px]']") === null
    ? { present: false }
    : (() => {
        const aside = document.querySelector("aside[class*='w-[340px]']");
        const box = aside.getBoundingClientRect();
        const current = aside.querySelector("[aria-current='step']");
        return {
          present: true,
          visible: box.width > 0 && box.height > 0,
          width: Math.round(box.width),
          step: current ? current.textContent.trim() : null,
          progress: aside.querySelector("p.mt-2\\.5")?.textContent.trim(),
        };
      })();

/** 화면에 보이는 "다음"류 버튼을 누른다 */
const clickNext = (label) => {
  const btn = [...document.querySelectorAll("button")].find(
    (b) => b.textContent.trim() === label && b.offsetParent !== null,
  );
  if (!btn) return false;
  btn.click();
  return true;
};

(async () => {
  const browser = await p.launch({
    executablePath: CHROME,
    headless: process.env.HEADED ? false : "new",
    args: [
      "--font-render-hinting=none",
      // Lanyard(3D 출입증)가 헤드리스에서도 그려지도록
      "--enable-unsafe-swiftshader",
    ],
  });

  const problems = [];
  // WIDTHS=2327 HEIGHT=1249 로 특정 폭·높이만 빠르게 볼 수 있다
  const WIDTHS = process.env.WIDTHS
    ? process.env.WIDTHS.split(",").map(Number)
    : [375, 768, 1280, 1686, 2327];
  const HEIGHT = Number(process.env.HEIGHT || 900);

  // 회원 모드는 폭을 좁혀 돈다 — 초대 단계 마크업은 폭과 무관하고,
  // 좌우 분할 자체는 게스트 모드에서 다섯 폭 전부 확인한다.
  const MEMBER_WIDTHS = process.env.WIDTHS ? WIDTHS : [375, 1280];

  for (const member of [false, true]) {
    const widths = member ? MEMBER_WIDTHS : WIDTHS;
    const tagOf = (t) => (member ? `회원-${t}` : t);
    // 회원은 이름 다음에 초대 단계가 끼어 약관이 5단계가 된다
    const totalSteps = member ? 5 : 4;
    for (const w of widths) {
      const page = await browser.newPage();
      const seen = [];
      await page.setViewport({
        width: w,
        height: HEIGHT,
        deviceScaleFactor: 1.5,
      });
      await page.evaluateOnNewDocument((host) => {
        const Native = window.WebSocket;
        function Blocked(url, protocols) {
          if (String(url).includes(host))
            throw new Error("harness: ws blocked");
          return new Native(url, protocols);
        }
        Blocked.prototype = Native.prototype;
        window.WebSocket = Blocked;
      }, "api.seoulmoment.com.tw");
      await page.setRequestInterception(true);
      installMocks(page, member, seen);
      /*
        공유 시트를 결정적으로 만든다. 헤드리스 크롬에도 navigator.share 가
        있는데 실제로 부르면 취소(AbortError)로 떨어져 무엇을 보냈는지
        확인할 수 없다. 여기서는 보낸 URL 만 받아 적고 성공으로 돌려준다 —
        "링크에 역할이 실렸는가"(`?as=spouse`) 가 이 단계의 핵심이다.
      */
      await page.evaluateOnNewDocument(() => {
        window.__shared = [];
        navigator.share = (d) => {
          window.__shared.push(d.url);
          return Promise.resolve();
        };
        navigator.canShare = () => true;
      });

      await page.goto(`${ORIGIN}/setting`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.evaluate((isMember) => {
        localStorage.clear();
        sessionStorage.clear();
        if (isMember) {
          // 하네스용 가짜 JWT. payload 는 안 읽히지만 형태는 맞춰 둔다
          const body = btoa(JSON.stringify({ planUserId: "u1", sub: "u1" }));
          localStorage.setItem("plan_auth_token", `x.${body}.y`);
          sessionStorage.setItem("plan_auth_token", `x.${body}.y`);
        }
      }, member);
      await page.goto(`${ORIGIN}/setting`, {
        waitUntil: "networkidle2",
        timeout: 60000,
      });

      // 축하 3초 + 페이드 0.5초 뒤에 날짜 단계가 뜬다
      await wait(1500);
      await page.screenshot({
        path: path.join(OUT, `onboarding-${tagOf("0축하")}-${w}.png`),
      });
      const first = await page.evaluate(readAside);
      if (first.present)
        problems.push(`${tagOf(w)}: 축하 화면에 좌측 패널이 붙었다`);

      await wait(3200);

      const steps = [
        ["1날짜", "다음"],
        ["2예산", "다음"],
        ["3이름", "다음"],
      ];
      for (const [tag, label] of steps) {
        // 단계 전환은 fade-out 500ms 뒤에 일어난다. 예산은 카운트업 3초를 더 기다린다
        await wait(tag === "2예산" ? 3800 : 1400);
        if (tag === "3이름") {
          const typed = await page.evaluate(() => {
            const input = document.querySelector(
              'input[placeholder="이름 또는 닉네임"]',
            );
            if (!input) return false;
            const setter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype,
              "value",
            ).set;
            setter.call(input, "예신");
            input.dispatchEvent(new Event("input", { bubbles: true }));
            return true;
          });
          if (!typed) problems.push(`${tagOf(w)}: 이름 입력칸을 못 찾았다`);
          await wait(400);
        }
        await page.screenshot({
          path: path.join(OUT, `onboarding-${tagOf(tag)}-${w}.png`),
        });
        const a = await page.evaluate(readAside);
        console.log(`${tagOf(w)} ${tag}`, JSON.stringify(a));
        if (w >= 1024) {
          if (!a.present || !a.visible)
            problems.push(`${tagOf(w)}: ${tag} 좌측 패널이 안 보인다`);
          else if (a.width !== 340)
            problems.push(`${tagOf(w)}: ${tag} 좌측 패널 폭 ${a.width}`);
        } else if (a.present && a.visible) {
          problems.push(`${tagOf(w)}: ${tag} 좁은 폭인데 좌측 패널이 보인다`);
        }
        const moved = await page.evaluate(clickNext, label);
        if (!moved)
          problems.push(`${tagOf(w)}: ${tag} "${label}" 버튼을 못 찾았다`);
      }

      // 환영(2초) → 출입증(Lanyard) → 다음 → 약관
      await wait(6000);

      // Lanyard 는 dynamic import 라 "출입증 준비 중..." 이 먼저 뜬다.
      // 고정 대기로 찍으면 캔버스가 붙기 전을 찍는다 — 실제로 붙을 때까지 기다린다.
      await page
        .waitForFunction(
          () => {
            const c = document.querySelector(".lanyard-wrapper canvas");
            return !!c && c.getBoundingClientRect().width > 0;
          },
          { timeout: 60000 },
        )
        .catch(() =>
          problems.push(`${tagOf(w)}: 출입증 캔버스가 끝내 안 떴다`),
        );
      await wait(1200);

      // 출입증은 "전체 화면 연출" 이다. 캔버스가 뷰포트 폭을 다 쓰는지 본다 —
      // 예전에는 main 이 lg:max-w-[600px] 라 넓은 모니터에서 600px 띠였다.
      await page.screenshot({
        path: path.join(OUT, `onboarding-${tagOf("3-출입증")}-${w}.png`),
      });
      const stage = await page.evaluate(() => {
        const c = document.querySelector(".lanyard-wrapper canvas");
        return {
          canvas: c ? Math.round(c.getBoundingClientRect().width) : null,
          viewport: window.innerWidth,
          aside: document.querySelector("aside[class*='w-[340px]']") !== null,
        };
      });
      console.log(`${tagOf(w)} 출입증`, JSON.stringify(stage));
      // ≥1024 는 뷰포트를 다 쓰고, 그 아래는 예전 그대로 폰 프레임(max-w-500)이다.
      const wantCanvas = w >= 1024 ? w : Math.min(w, 500);
      if (stage.canvas === null)
        problems.push(`${tagOf(w)}: 출입증 캔버스를 못 찾았다`);
      else if (Math.abs(stage.canvas - wantCanvas) > 2)
        problems.push(
          `${tagOf(w)}: 출입증 캔버스가 ${stage.canvas}px (기대 ${wantCanvas}px)`,
        );
      if (stage.aside)
        problems.push(`${tagOf(w)}: 출입증 화면에 좌측 패널이 붙었다`);

      const passed = await page.evaluate(clickNext, "다음");
      if (!passed)
        problems.push(`${tagOf(w)}: 출입증 화면의 "다음" 을 못 찾았다`);
      await wait(1500);
      await page.screenshot({
        path: path.join(OUT, `onboarding-${tagOf("4약관")}-${w}.png`),
      });
      const terms = await page.evaluate(readAside);
      console.log(`${tagOf(w)} 약관`, JSON.stringify(terms));

      // 약관 단계 안의 작은 출입증 미리보기.
      // .lanyard-wrapper 가 min-height:100dvh 라 캔버스가 상자보다 훨씬 커져
      // 위아래가 overflow-hidden 으로 잘려 나가던 자리다.
      const preview = await page.evaluate(() => {
        const box = document.querySelector(".lanyard-preview");
        const c = box?.querySelector("canvas");
        if (!box || !c) return null;
        const b = box.getBoundingClientRect();
        const r = c.getBoundingClientRect();
        return {
          box: [Math.round(b.width), Math.round(b.height)],
          canvas: [Math.round(r.width), Math.round(r.height)],
          clipTop: Math.round(b.top - r.top),
          clipBottom: Math.round(r.bottom - b.bottom),
        };
      });
      console.log(`${tagOf(w)} 약관-미리보기`, JSON.stringify(preview));
      if (!preview)
        problems.push(`${tagOf(w)}: 약관 출입증 미리보기를 못 찾았다`);
      else if (preview.clipTop > 2 || preview.clipBottom > 2)
        problems.push(
          `${tagOf(w)}: 약관 출입증 미리보기가 잘린다 (위 ${preview.clipTop}px · 아래 ${preview.clipBottom}px)`,
        );
      if (w >= 1024 && (!terms.present || !terms.visible))
        problems.push(`${tagOf(w)}: 약관 단계에 좌측 패널이 없다`);
      if (w < 1024 && terms.present && terms.visible)
        problems.push(`${tagOf(w)}: 좁은 폭 약관 단계에 좌측 패널이 보인다`);
      // 약관은 항상 4단계다. 회원은 그 뒤에 초대(5)가 하나 더 붙는다.
      if (w >= 1024 && terms.progress !== `4 / ${totalSteps} 단계`)
        problems.push(
          `${tagOf(w)}: 약관 진행도가 "${terms.progress}" (기대 4 / ${totalSteps})`,
        );

      /*
        회원은 약관 다음에 초대 단계가 하나 더 있다. 전체 동의 후 넘어간다.
        약관 버튼 문구도 갈린다 — 게스트는 "계획 짜러 가기"(끝), 회원은
        "다음"(초대 단계가 남았다).
      */
      if (member) {
        const termsLabel = await page.evaluate(() => {
          const b = [...document.querySelectorAll("button")].find((x) =>
            ["다음", "계획 짜러 가기"].includes(x.textContent.trim()),
          );
          return b?.textContent.trim() ?? null;
        });
        if (termsLabel !== "다음")
          problems.push(
            `${tagOf(w)}: 약관 버튼이 "${termsLabel}" (기대 "다음")`,
          );

        const agreed = await page.evaluate(() => {
          const label = [...document.querySelectorAll("label")].find((x) =>
            x.textContent.includes("전체 동의합니다"),
          );
          const box = label?.querySelector('input[type="checkbox"]');
          if (!box) return false;
          box.click();
          return true;
        });
        if (!agreed)
          problems.push(`${tagOf(w)}: 전체 동의 체크박스를 못 찾았다`);
        await wait(400);
        const passedTerms = await page.evaluate(clickNext, "다음");
        if (!passedTerms)
          problems.push(`${tagOf(w)}: 약관 단계의 "다음" 을 못 눌렀다`);
        await wait(900);
      }

      /*
      회원 모드에만 있는 초대 단계. 두 카드 중 하나를 고르기 전에는 기본
      버튼이 잠겨 있어야 하고, "신랑 · 신부를 부를게요" 를 고르면 버튼이
      "초대장 보내기" 로 바뀐다. 헤드리스에는 navigator.share 가 없어
      클립보드 경로를 탄다 — 그쪽이 데스크톱에서 실제로 도는 길이다.
    */
      if (member) {
        await wait(1400);
        await page.screenshot({
          path: path.join(OUT, `onboarding-${tagOf("5초대")}-${w}.png`),
        });
        const inv = await page.evaluate(readAside);
        console.log(`${tagOf(w)} 5초대`, JSON.stringify(inv));
        if (w >= 1024 && inv.step !== "5함께할 사람")
          problems.push(`${tagOf(w)}: 초대 단계인데 패널이 "${inv.step}"`);

        const before = await page.evaluate(() => {
          const cards = [...document.querySelectorAll("[role='radio']")].map(
            (b) => b.textContent.trim().slice(0, 12),
          );
          const primary = [...document.querySelectorAll("button")].find((b) =>
            ["계획 짜러 가기", "초대장 보내기", "준비 중..."].includes(
              b.textContent.trim(),
            ),
          );
          return {
            cards,
            label: primary?.textContent.trim() ?? null,
            disabled: primary?.disabled ?? null,
          };
        });
        console.log(`${tagOf(w)} 5초대-초기`, JSON.stringify(before));
        if (before.cards.length !== 2)
          problems.push(
            `${tagOf(w)}: 초대 단계 선택 카드가 ${before.cards.length}개`,
          );
        if (before.disabled !== true)
          problems.push(`${tagOf(w)}: 아무것도 안 골랐는데 기본 버튼이 눌린다`);

        const picked = await page.evaluate(() => {
          const card = [...document.querySelectorAll("[role='radio']")].find(
            (b) => b.textContent.includes("부를게요"),
          );
          if (!card) return false;
          card.click();
          return true;
        });
        if (!picked) problems.push(`${tagOf(w)}: "부를게요" 카드를 못 찾았다`);
        await wait(300);

        const afterPick = await page.evaluate(() => {
          const b = [...document.querySelectorAll("button")].find((x) =>
            ["초대장 보내기", "준비 중..."].includes(x.textContent.trim()),
          );
          return {
            label: b?.textContent.trim() ?? null,
            disabled: b?.disabled,
          };
        });
        console.log(`${tagOf(w)} 5초대-선택후`, JSON.stringify(afterPick));
        if (afterPick.label !== "초대장 보내기")
          problems.push(
            `${tagOf(w)}: 부를게요를 골랐는데 버튼이 "${afterPick.label}"`,
          );

        const sent = await page.evaluate(() => {
          const b = [...document.querySelectorAll("button")].find(
            (x) => x.textContent.trim() === "초대장 보내기",
          );
          if (!b) return false;
          b.click();
          return true;
        });
        if (!sent) problems.push(`${tagOf(w)}: "초대장 보내기" 를 못 눌렀다`);
        await wait(700);

        const result = await page.evaluate(() => {
          const status = document.querySelector("[role='status']");
          const b = [...document.querySelectorAll("button")].find((x) =>
            ["계획 짜러 가기", "초대장 보내기"].includes(x.textContent.trim()),
          );
          return {
            status: status?.textContent.trim() ?? "",
            label: b?.textContent.trim() ?? null,
            shared: window.__shared ?? [],
          };
        });
        await page.screenshot({
          path: path.join(OUT, `onboarding-${tagOf("5초대-보냄")}-${w}.png`),
        });
        console.log(`${tagOf(w)} 5초대-보냄`, JSON.stringify(result));
        const iSave = seen.findIndex((r) => r.startsWith("POST /plan/setting"));
        const iShare = seen.findIndex((r) =>
          r.includes("/plan/room/share-code"),
        );
        console.log(`${tagOf(w)} 요청순서`, JSON.stringify({ iSave, iShare }));
        if (iShare < 0)
          problems.push(`${tagOf(w)}: share-code 를 부르지 않았다`);
        if (iSave < 0)
          problems.push(`${tagOf(w)}: POST /plan/setting 이 나가지 않았다`);
        // 저장이 초대보다 먼저여야 한다. 뒤집히면 초대받은 사람이 날짜·예산·
        // 이름이 빈 플랜에 들어오고, 필수 동의 전에 접근 링크가 나간다.
        else if (iShare >= 0 && iShare < iSave)
          problems.push(
            `${tagOf(w)}: 저장(${iSave})보다 공유 코드(${iShare})가 먼저 나갔다`,
          );
        // 초대 링크가 역할을 지닌다. `?as=spouse` 가 빠지면 배우자로 부르고도
        // 상대가 "함께 보는 사람"(READ)으로 들어온다.
        if (result.shared.length !== 1)
          problems.push(
            `${tagOf(w)}: 공유가 ${result.shared.length}번 일어났다`,
          );
        else if (!result.shared[0].endsWith("/share/HARNESS1?as=spouse"))
          problems.push(`${tagOf(w)}: 보낸 링크가 "${result.shared[0]}"`);
        if (!result.status)
          problems.push(`${tagOf(w)}: 초대장을 보냈는데 안내 문구가 없다`);
        if (result.label !== "계획 짜러 가기")
          problems.push(
            `${tagOf(w)}: 보낸 뒤 버튼이 "${result.label}" (기대 "계획 짜러 가기")`,
          );

        const moved = await page.evaluate(clickNext, "계획 짜러 가기");
        if (!moved)
          problems.push(
            `${tagOf(w)}: 초대 단계의 "계획 짜러 가기" 를 못 찾았다`,
          );
        // 초대가 마지막 단계다. 여기서 나가면 /main 이어야 한다.
        await wait(1500);
        const landed = page.url();
        if (!landed.endsWith("/main"))
          problems.push(`${tagOf(w)}: 초대 뒤에 "${landed}" 로 갔다`);

        /*
          약관에서 저장이 끝났으므로 온보딩은 이미 완료다. 초대 단계에서
          나가 버렸다가 `/setting` 으로 다시 들어와도 질문을 되풀이하지 않고
          `/main` 으로 보내야 한다 (`isPlanDataComplete` → `router.replace`).
          **그래서 초대 단계는 한 번 나가면 다시 볼 수 없다** — 홈의 초대 띠가
          유일한 재진입점인 이유다.
        */
        await page.goto(`${ORIGIN}/setting`, {
          waitUntil: "networkidle2",
          timeout: 60000,
        });
        await wait(2500);
        const reentry = page.url();
        console.log(`${tagOf(w)} 재진입`, reentry);
        if (!reentry.endsWith("/main"))
          problems.push(
            `${tagOf(w)}: 저장 뒤 /setting 재진입이 "${reentry}" 로 머물렀다`,
          );
      }

      await page.close();
    }
  }

  await browser.close();
  if (problems.length) {
    console.log("\n문제:");
    problems.forEach((x) => console.log(" -", x));
    process.exitCode = 1;
  } else {
    console.log("\n이상 없음");
  }
})();
