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
/** true 면 목이 8월 일정을 빼서 "이번 달 할 일"이 빈 상태를 만든다 */
let emptyThisMonth = false;

/**
 * OVER=1 이면 자본을 넘긴 상태로 구동한다.
 * 도넛은 100% 를 넘길 수 없어 초과 표현이 가장 어려운 경우다 —
 * 자본 눈금과 빨간 초과 구간이 실제로 나오는지 여기서 본다.
 */
const OVER = !!process.env.OVER;

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

/** 시안(B/D)과 같은 데이터. 레이아웃을 눈으로 대조하려고 그대로 맞췄다 */
const SCHEDULES = [
  {
    id: 1,
    categoryName: "스드메",
    title: "드레스 투어",
    amount: null,
    startDate: "2026-08-23",
    startTime: "11:00",
    status: "NORMAL",
    location: "청담 브라이덜",
  },
  {
    id: 2,
    categoryName: "예식장",
    title: "예식장 2차 미팅",
    amount: null,
    startDate: "2026-08-29",
    startTime: "14:30",
    status: "NORMAL",
    location: "그랜드하얏트 서울",
  },
  {
    id: 3,
    categoryName: "예식장",
    title: "웨딩홀 계약금",
    amount: 620,
    startDate: "2026-08-02",
    status: "COMPLETED",
    location: null,
  },
  {
    id: 4,
    categoryName: "스드메",
    title: "본식 촬영",
    amount: 185,
    startDate: "2026-09-12",
    startTime: "09:00",
    status: "NORMAL",
    location: "아모레 스튜디오",
  },
  {
    id: 5,
    categoryName: "예물",
    title: "예물 상담",
    amount: null,
    startDate: "2026-09-27",
    status: "NORMAL",
    location: "종로 귀금속거리",
  },
  {
    id: 6,
    categoryName: "청첩장",
    title: "청첩장 발송",
    amount: null,
    startDate: "2026-10-10",
    status: "NORMAL",
    location: null,
  },
];

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

    if (/^\/plan\/chat\/message\/count\/\d+$/.test(p0)) {
      const rid = Number(p0.split("/").pop());
      req
        .respond(ok({ count: rid === 101 ? 2 : rid === 102 ? 5 : 0 }))
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
            weddingVenue: "그랜드하얏트 서울",
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
            chatRooms: [
              {
                id: 101,
                name: "스드메",
                lastMessage: "드레스 투어 23일 일요일 11시로 잡았어",
              },
              {
                id: 102,
                name: "항공 · 숙소",
                lastMessage: "말레 직항이 40만원 더 비싸긴 한데",
              },
              {
                id: 103,
                name: "예물 · 예단",
                lastMessage: "어머니가 종로 아는 곳 있으시대",
              },
            ],
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
    if (
      p0 === "/plan/user/amount/category-chart" ||
      p0.startsWith("/plan/room/amount/category-chart")
    ) {
      if (OVER) {
        req
          .respond(
            ok({
              list: [
                { categoryName: "웨딩홀", totalAmount: 1122, usedAmount: 1111 },
                { categoryName: "상견례", totalAmount: 125, usedAmount: 125 },
                { categoryName: "기차", totalAmount: 7, usedAmount: 7 },
                { categoryName: "스드메", totalAmount: 0, usedAmount: 0 },
              ],
            }),
          )
          .catch(() => {});
        return;
      }
      // 완료된 일정만 합산한다. 실제 API 와 같아야 토글 반영을 검증할 수 있다.
      const byCat = new Map();
      SCHEDULES.filter((x) => x.status === "COMPLETED").forEach((x) => {
        byCat.set(
          x.categoryName,
          (byCat.get(x.categoryName) ?? 0) + (x.amount ?? 0),
        );
      });
      if (byCat.size > 0) {
        req
          .respond(
            ok({
              list: [...byCat.entries()].map(([categoryName, amount]) => ({
                categoryName,
                totalAmount: amount,
                usedAmount: amount,
              })),
            }),
          )
          .catch(() => {});
        return;
      }
      req
        .respond(
          ok({
            list: [
              { categoryName: "예식장", totalAmount: 620, usedAmount: 620 },
              { categoryName: "스드메", totalAmount: 385, usedAmount: 385 },
              {
                categoryName: "예물 · 예단",
                totalAmount: 210,
                usedAmount: 210,
              },
              { categoryName: "신혼여행", totalAmount: 125, usedAmount: 125 },
            ],
          }),
        )
        .catch(() => {});
      return;
    }
    if (
      p0 === "/plan/user/amount/detail" ||
      p0.startsWith("/plan/room/amount/detail")
    ) {
      req
        .respond(
          ok(
            OVER
              ? {
                  initialCapital: 1000,
                  totalPlannedAndUsedAmount: 1254,
                  plannedUseAmount: 11,
                  usedAmount: 1243,
                }
              : {
                  initialCapital: 4200,
                  totalPlannedAndUsedAmount: 1340,
                  plannedUseAmount: 1850,
                  usedAmount: 1340,
                },
          ),
        )
        .catch(() => {});
      return;
    }
    if (p0 === "/plan/user/total-amount") {
      const used = SCHEDULES.filter((x) => x.status === "COMPLETED").reduce(
        (n, x) => n + (x.amount ?? 0),
        0,
      );
      req
        .respond(
          ok({
            totalAmount: 4200,
            usedAmount: used,
            remainingAmount: 4200 - used,
          }),
        )
        .catch(() => {});
      return;
    }
    const statusMatch = /^\/plan\/schedule\/status\/(\d+)$/.exec(p0);
    if (statusMatch) {
      const id = Number(statusMatch[1]);
      let next = null;
      try {
        next = JSON.parse(req.postData() || "{}").status;
      } catch {
        next = null;
      }
      const item = SCHEDULES.find((x) => x.id === id);
      if (item && next) item.status = next;
      req.respond(ok({ id, status: next })).catch(() => {});
      return;
    }
    if (p0 === "/plan/schedule/list") {
      // status 를 안 주면 지운 것 빼고 전부 — 실제 API 와 같게 맞춘다
      const status = new URL(url).searchParams.get("status");
      const list = SCHEDULES.filter(
        (s) => s.status !== "DELETE" && (!status || s.status === status),
      ).filter(
        (s) => !emptyThisMonth || !(s.startDate || "").startsWith("2026-08"),
      );
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
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.goto(`${ORIGIN}/`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
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
  await page.evaluate((t) => {
    localStorage.setItem("plan_auth_token", t);
    sessionStorage.setItem("plan_auth_token", t);
  }, JWT);

  for (const w of [375, 768, 1024, 1440, 2327]) {
    await page.setViewport({ width: w, height: 1000, deviceScaleFactor: 1 });
    await page.goto(`${ORIGIN}/budget-detail`, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    await wait(2400);
    await page.screenshot({
      path: path.join(OUT, `budget-${OVER ? "over-" : ""}${w}.png`),
    });
    const info = await page.evaluate(() => {
      const ids = [
        "budget-stat-grid",
        "budget-ai-insight",
        "budget-analysis",
        "budget-tab",
        "budget-list",
      ];
      const boxes = ids.map((id) => {
        const el = document.getElementById(id);
        if (!el) return `${id}=없음`;
        const r = el.getBoundingClientRect();
        const on = r.width > 0 && r.left >= 0 && r.right <= innerWidth + 1;
        return `${id}=${on ? Math.round(r.left) + "~" + Math.round(r.right) : "벗어남"}`;
      });
      // 2열은 [도넛 요약 | 카테고리 표] 가 나란한지로 본다.
      // 표와 항목 목록은 이제 같은 오른쪽 열에 세로로 쌓인다.
      const s = document
        .getElementById("budget-stat-grid")
        ?.getBoundingClientRect();
      const a = document
        .getElementById("budget-analysis")
        ?.getBoundingClientRect();
      const cols = s && a && Math.abs(s.top - a.top) < 40 ? 2 : 1;
      return { boxes, cols };
    });
    console.log(
      `캡처 budget-${OVER ? "over-" : ""}${w}.png   ${info.cols}열  ${info.boxes.join("  ")}`,
    );
  }
  await browser.close();
})().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
