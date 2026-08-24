/*
 * 온보딩(/setting)의 폭별 레이아웃을 확인한다.
 *
 * 넓은 화면(≥1024)에서는 왼쪽 진행 패널 + 오른쪽 질문 2열이고,
 * 그보다 좁으면 예전 그대로 한 화면에 하나씩이다.
 * 단계(날짜 → 예산 → 이름 → 약관)를 실제로 눌러 넘기며 찍는다.
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

/** 온보딩은 비회원으로도 끝까지 가므로 백엔드는 전부 빈 응답이면 된다 */
function installMocks(page) {
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

  for (const w of WIDTHS) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: HEIGHT, deviceScaleFactor: 1.5 });
    await page.evaluateOnNewDocument((host) => {
      const Native = window.WebSocket;
      function Blocked(url, protocols) {
        if (String(url).includes(host)) throw new Error("harness: ws blocked");
        return new Native(url, protocols);
      }
      Blocked.prototype = Native.prototype;
      window.WebSocket = Blocked;
    }, "api.seoulmoment.com.tw");
    await page.setRequestInterception(true);
    installMocks(page);

    await page.goto(`${ORIGIN}/setting`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(`${ORIGIN}/setting`, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    // 축하 3초 + 페이드 0.5초 뒤에 날짜 단계가 뜬다
    await wait(1500);
    await page.screenshot({
      path: path.join(OUT, `onboarding-0축하-${w}.png`),
    });
    const first = await page.evaluate(readAside);
    if (first.present) problems.push(`${w}: 축하 화면에 좌측 패널이 붙었다`);

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
        if (!typed) problems.push(`${w}: 이름 입력칸을 못 찾았다`);
        await wait(400);
      }
      await page.screenshot({
        path: path.join(OUT, `onboarding-${tag}-${w}.png`),
      });
      const a = await page.evaluate(readAside);
      console.log(`${w} ${tag}`, JSON.stringify(a));
      if (w >= 1024) {
        if (!a.present || !a.visible)
          problems.push(`${w}: ${tag} 좌측 패널이 안 보인다`);
        else if (a.width !== 340)
          problems.push(`${w}: ${tag} 좌측 패널 폭 ${a.width}`);
      } else if (a.present && a.visible) {
        problems.push(`${w}: ${tag} 좁은 폭인데 좌측 패널이 보인다`);
      }
      const moved = await page.evaluate(clickNext, label);
      if (!moved) problems.push(`${w}: ${tag} "${label}" 버튼을 못 찾았다`);
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
      .catch(() => problems.push(`${w}: 출입증 캔버스가 끝내 안 떴다`));
    await wait(1200);

    // 출입증은 "전체 화면 연출" 이다. 캔버스가 뷰포트 폭을 다 쓰는지 본다 —
    // 예전에는 main 이 lg:max-w-[600px] 라 넓은 모니터에서 600px 띠였다.
    await page.screenshot({
      path: path.join(OUT, `onboarding-5출입증-${w}.png`),
    });
    const stage = await page.evaluate(() => {
      const c = document.querySelector(".lanyard-wrapper canvas");
      return {
        canvas: c ? Math.round(c.getBoundingClientRect().width) : null,
        viewport: window.innerWidth,
        aside: document.querySelector("aside[class*='w-[340px]']") !== null,
      };
    });
    console.log(`${w} 5출입증`, JSON.stringify(stage));
    // ≥1024 는 뷰포트를 다 쓰고, 그 아래는 예전 그대로 폰 프레임(max-w-500)이다.
    const wantCanvas = w >= 1024 ? w : Math.min(w, 500);
    if (stage.canvas === null) problems.push(`${w}: 출입증 캔버스를 못 찾았다`);
    else if (Math.abs(stage.canvas - wantCanvas) > 2)
      problems.push(
        `${w}: 출입증 캔버스가 ${stage.canvas}px (기대 ${wantCanvas}px)`,
      );
    if (stage.aside) problems.push(`${w}: 출입증 화면에 좌측 패널이 붙었다`);

    const passed = await page.evaluate(clickNext, "다음");
    if (!passed) problems.push(`${w}: 출입증 화면의 "다음" 을 못 찾았다`);
    await wait(1500);
    await page.screenshot({
      path: path.join(OUT, `onboarding-4약관-${w}.png`),
    });
    const terms = await page.evaluate(readAside);
    console.log(`${w} 4약관`, JSON.stringify(terms));

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
    console.log(`${w} 4약관-미리보기`, JSON.stringify(preview));
    if (!preview) problems.push(`${w}: 약관 출입증 미리보기를 못 찾았다`);
    else if (preview.clipTop > 2 || preview.clipBottom > 2)
      problems.push(
        `${w}: 약관 출입증 미리보기가 잘린다 (위 ${preview.clipTop}px · 아래 ${preview.clipBottom}px)`,
      );
    if (w >= 1024 && (!terms.present || !terms.visible))
      problems.push(`${w}: 약관 단계에 좌측 패널이 없다`);
    if (w < 1024 && terms.present && terms.visible)
      problems.push(`${w}: 좁은 폭 약관 단계에 좌측 패널이 보인다`);

    await page.close();
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
