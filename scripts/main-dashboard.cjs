/*
 * /main 의 폭별 레이아웃을 확인한다.
 *
 * 확인하는 것:
 *   1. 375 / 768 / 1024 / 1280 / 1440 캡처
 *      - 375 는 변경 전과 같아야 한다 (스냅 두 섹션 그대로)
 *      - ≥768 은 스냅이 풀리고, ≥1024 는 좌(헤더+예산)·우(리스트) 2열
 *   2. ≥768 에서 플랜 리스트가 실제로 스크롤되는지
 *      (모바일의 allowPlanListScroll 게이트가 데스크톱까지 걸리면 안 된다)
 *
 * 준비:  npm run dev / npm install --no-save puppeteer-core
 * 실행:  node scripts/main-dashboard.cjs
 *
 * 목 응답에는 CORS 헤더와 OPTIONS 프리플라이트 응답이 반드시 필요하다.
 * API 호스트로 가는 WebSocket 도 막는다 (plan-list-panes.cjs 주석 참고).
 */
const path = require("path");
const p = require(path.join(__dirname, "..", "node_modules", "puppeteer-core"));

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const API = "https://api.seoulmoment.com.tw";
const ORIGIN = "http://localhost:3000";
const OUT = process.env.SHOT_DIR || __dirname;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const JWT = `${b64u({ alg: "HS256", typ: "JWT" })}.${b64u({
  planUserId: "me-1",
  sub: "me-1",
  exp: 9999999999,
})}.sig`;

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

const CATEGORIES = [
  "스드메",
  "예식장",
  "예물",
  "신혼여행",
  "청첩장",
  "한복",
  "신혼집",
];

/** 리스트가 스크롤되는지 보려면 화면보다 길어야 한다 */
const SCHEDULES = Array.from({ length: 18 }, (_, i) => {
  const day = ((i * 3) % 27) + 1;
  const month = 8 + Math.floor(i / 9);
  return {
    id: i + 1,
    categoryName: CATEGORIES[i % CATEGORIES.length],
    title: `${CATEGORIES[i % CATEGORIES.length]} 준비 ${i + 1}`,
    amount: (i % 5) * 35 + 20,
    startDate: `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    createDate: "2026-08-01T09:00:00+09:00",
    status: i % 6 === 0 ? "COMPLETED" : "NORMAL",
  };
});

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

    const p0 = url.slice(API.length).split("?")[0];

    if (p0.startsWith("/socket.io")) {
      req.respond({ status: 404, headers: CORS, body: "" }).catch(() => {});
      return;
    }
    if (/^\/plan\/notification\/chat\/\d+$/.test(p0)) {
      req
        .respond({
          status: 200,
          headers: { ...CORS, "Cache-Control": "no-cache" },
          contentType: "text/event-stream",
          body: `data: ${JSON.stringify({ type: "keep-alive" })}\n\n`,
        })
        .catch(() => {});
      return;
    }

    if (p0 === "/plan/user") {
      req
        .respond(
          ok({
            id: "me-1",
            name: "지수 · 현우",
            weddingDate: "2026-11-14",
            budget: 4200,
            roomId: null,
            hasSeenMainGuide: true,
            hasSeenBudgetGuide: true,
            members: [
              {
                planUserId: "me-1",
                name: "김지수",
                image: null,
                permission: "OWNER",
              },
              {
                planUserId: "u-2",
                name: "박현우",
                image: null,
                permission: "WRITE",
              },
            ],
            chatRooms: [{ id: 101, name: "스드메" }],
          }),
        )
        .catch(() => {});
      return;
    }
    if (p0 === "/plan/activity/list") {
      req
        .respond(
          ok({
            list: [
              {
                id: 3,
                type: "SCHEDULE_CREATED",
                actorPlanUserId: "me-1",
                actorName: "김지수",
                actorImage: null,
                targetType: "SCHEDULE",
                targetId: 18,
                targetTitle: "아모레 스튜디오 본식 촬영",
                amount: 185,
                createDate: new Date(
                  Date.now() - 2 * 3600 * 1000,
                ).toISOString(),
              },
              {
                id: 2,
                type: "BUDGET_UPDATED",
                actorPlanUserId: "u-2",
                actorName: "박현우",
                actorImage: null,
                targetType: "USER",
                targetId: null,
                targetTitle: null,
                amount: 4200,
                createDate: new Date(
                  Date.now() - 26 * 3600 * 1000,
                ).toISOString(),
              },
              {
                id: 1,
                type: "MEMBER_JOINED",
                actorPlanUserId: "u-3",
                actorName: "엄마",
                actorImage: null,
                targetType: "ROOM",
                targetId: 1,
                targetTitle: null,
                amount: null,
                createDate: new Date(
                  Date.now() - 96 * 3600 * 1000,
                ).toISOString(),
              },
            ],
            total: 3,
          }),
        )
        .catch(() => {});
      return;
    }
    if (p0 === "/plan/user/total-amount") {
      req
        .respond(
          ok({ totalAmount: 4200, usedAmount: 1340, remainingAmount: 2860 }),
        )
        .catch(() => {});
      return;
    }
    if (p0 === "/plan/schedule/list") {
      const status = new URL(url).searchParams.get("status");
      const list = status
        ? SCHEDULES.filter((s) => s.status === status)
        : SCHEDULES;
      req.respond(ok({ list, total: list.length })).catch(() => {});
      return;
    }
    if (p0 === "/plan/category/user/list" || p0 === "/plan/category/list") {
      req
        .respond(
          ok({
            list: CATEGORIES.map((name, i) => ({
              id: i + 1,
              name,
              color: "#ee2b8c",
              type: "SYSTEM",
            })),
            total: CATEGORIES.length,
          }),
        )
        .catch(() => {});
      return;
    }

    req.respond(ok({ list: [], total: 0 })).catch(() => {});
  });
}

(async () => {
  const browser = await p.launch({
    executablePath: CHROME,
    headless: process.env.HEADED ? false : "new",
    args: ["--font-render-hinting=none"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });

  await page.goto(`${ORIGIN}/main`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.evaluate((t) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("plan_auth_token", t);
    sessionStorage.setItem("plan_auth_token", t);
  }, JWT);

  await page.evaluateOnNewDocument((host) => {
    const Native = window.WebSocket;
    function Blocked(url, protocols) {
      if (String(url).includes(host)) {
        throw new Error("harness: API websocket blocked");
      }
      return new Native(url, protocols);
    }
    Blocked.prototype = Native.prototype;
    window.WebSocket = Blocked;
  }, "api.seoulmoment.com.tw");

  await page.setRequestInterception(true);
  installMocks(page);

  for (const w of [375, 768, 1024, 1280, 1440]) {
    await page.setViewport({ width: w, height: 900, deviceScaleFactor: 1.5 });
    await page.goto(`${ORIGIN}/main`, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    await wait(2000);
    await page.screenshot({ path: path.join(OUT, `main-${w}.png`) });

    // 플랜 리스트가 실제로 스크롤 가능한가
    const scrollable = await page.evaluate(() => {
      const ul = document.getElementById("main-plan-list");
      const box = ul && ul.parentElement;
      if (!box) return null;
      const cs = getComputedStyle(box);
      return {
        overflowY: cs.overflowY,
        canScroll: box.scrollHeight > box.clientHeight + 4,
      };
    });
    console.log(
      `캡처 main-${w}.png   리스트 overflowY=${scrollable ? scrollable.overflowY : "?"} 스크롤가능=${
        scrollable ? scrollable.canScroll : "?"
      }`,
    );
  }

  // 가이드 말풍선이 새 레이아웃에서도 대상 위에 붙는지 확인한다.
  // GuideOverlay 는 대상 엘리먼트의 rect 와 window.innerHeight 로 위치를
  // 계산하므로, 레일·2열 도입으로 좌표가 밀리면 여기서 드러난다.
  for (const w of [375, 1280]) {
    await page.setViewport({ width: w, height: 900, deviceScaleFactor: 1.5 });
    await page.goto(`${ORIGIN}/main`, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    await wait(1800);
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find(
        (b) =>
          b.querySelector("svg.lucide-circle-help") ||
          b.getAttribute("aria-label") === "가이드 보기",
      );
      if (btn) btn.click();
    });
    await wait(1200);

    const steps = [
      "main-header-info",
      "main-budget-card",
      "main-tabs",
      "main-plan-list",
    ];
    for (let i = 0; i < steps.length; i += 1) {
      const info = await page.evaluate((id) => {
        const el = document.getElementById(id);
        if (!el) return { missing: true };
        const r = el.getBoundingClientRect();
        return {
          visible:
            r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight,
          top: Math.round(r.top),
          left: Math.round(r.left),
        };
      }, steps[i]);
      console.log(`  가이드 ${w}px [${steps[i]}] ${JSON.stringify(info)}`);
      await page.screenshot({
        path: path.join(OUT, `main-guide-${w}-${i}.png`),
      });
      // 다음 스텝으로
      await page.evaluate(() => {
        const next = [...document.querySelectorAll("button")].find((b) =>
          /다음|시작하기|확인/.test(b.innerText.trim()),
        );
        if (next) next.click();
      });
      await wait(700);
    }
  }

  await browser.close();
})().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
