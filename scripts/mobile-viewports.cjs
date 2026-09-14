/* eslint-disable no-console */
/**
 * 모바일 뷰포트 전수 검사.
 *
 * 폰에서 실제로 보이는 높이는 기기 스펙이 아니라 **브라우저 크롬을 뺀 값**
 * 이다. iOS 사파리는 위에 주소창, 아래에 도구 막대가 같이 뜨므로 아이폰
 * 12(390x844)에서 실제로 쓸 수 있는 세로는 664px 뿐이고, 스크롤해서 주소창이
 * 접히면 760px 로 늘어난다. 그래서 목록에는 **크롬이 다 나온 값과 접힌 값을
 * 둘 다** 넣는다.
 *
 * 재는 것:
 *   1. 가로 넘침            — 어떤 폭에서도 좌우로 밀리면 안 된다
 *   2. 셸 높이              — `h-[100dvh]` 가 실제 보이는 높이와 같은지
 *   3. 탭바에 가린 조작 요소 — `BottomTabBar` 는 `fixed` 라 내용 위에 덮인다
 *   4. 머리 면 스크롤       — 분홍 머리 면은 내용과 함께 위로 올라가야 한다
 *   5. 바닥 바의 틈         — `sticky bottom-0` 바와 탭바 사이로 내용이
 *                             비쳐 보이면 안 된다 (`.pb-dock` 참고)
 *
 * 표식은 마크업에 있다 — `data-mobile-head`, `data-dock-bar`.
 *
 * 실행: npm run dev 를 띄운 뒤 `node scripts/mobile-viewports.cjs`
 *   SHOT_DIR      캡처 위치 (기본 `__shots/vp`)
 *   ONLY=main,feed 화면 골라 돌리기
 *   SHOTS=all     모든 뷰포트 캡처 (기본은 세 폭만)
 *   HEADED=1      브라우저를 띄워 직접 보기
 */
const fs = require("fs");
const path = require("path");
const p = require("puppeteer-core");

const ORIGIN = process.env.BASE || "http://localhost:3000";
const API = process.env.API || "https://api.seoulmoment.com.tw";
const OUT = process.env.SHOT_DIR || path.join(__dirname, "..", "__shots", "vp");
const CHROME =
  process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
};
const ok = (data) => ({
  status: 200,
  headers: { ...CORS, "Content-Type": "application/json" },
  body: JSON.stringify({ result: true, data }),
});

const b64 = (o) =>
  Buffer.from(JSON.stringify(o))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const JWT = [
  b64({ alg: "HS256", typ: "JWT" }),
  b64({ planUserId: "me-1", jwtType: "ONE_TIME_TIME" }),
  "sig",
].join(".");

/**
 * `/plan/user` 응답.
 *
 * `members`·`chatRooms`·`hasSeen*` 가 빠지면 홈이 통째로 "화면을 불러오지
 * 못했어요" 로 떨어진다. 모양은 `scripts/main-dashboard.cjs` 와 맞춘다 —
 * 거기가 이 화면을 가장 오래 검사해 온 하네스다.
 */
const USER = {
  id: "me-1",
  name: "지수 · 현우",
  weddingDate: "2026-11-14",
  weddingVenue: "그랜드하얏트 서울",
  budget: 4200,
  roomId: null,
  profileImageUrl: null,
  hasSeenMainGuide: true,
  hasSeenBudgetGuide: true,
  members: [
    { planUserId: "me-1", name: "김지수", image: null, permission: "OWNER" },
    { planUserId: "u-2", name: "박현우", image: null, permission: "SPOUSE" },
    { planUserId: "u-3", name: "엄마", image: null, permission: "READ" },
  ],
  chatRooms: [
    {
      id: 101,
      name: "스드메",
      isCouple: true,
      lastMessage: "드레스 투어 23일",
    },
    { id: 102, name: "항공 · 숙소", lastMessage: "말레 직항이 40만원 더 비싸" },
    {
      id: 103,
      name: "예물 · 예단",
      lastMessage: "어머니가 종로 아는 곳 있으시대",
    },
  ],
};

const CATS = ["스드메", "예식장", "예물 · 예단", "신혼여행", "청첩장", "혼수"];
/** 스크롤이 실제로 생겨야 검사가 뜻이 있다 — 넉넉히 만든다 */
const SCHEDULES = Array.from({ length: 14 }, (_, i) => ({
  id: i + 1,
  title: `${CATS[i % CATS.length]} 일정 ${i + 1}`,
  categoryName: CATS[i % CATS.length],
  addCategoryNameList: [],
  startDate: `2026-${String((i % 12) + 1).padStart(2, "0")}-1${i % 9}`,
  startTime: i % 3 === 0 ? "09:00" : "",
  amount: (i + 1) * 35,
  plannedAmount: (i + 1) * 35,
  payType: "CREDIT",
  status: i % 4 === 0 ? "COMPLETED" : "NORMAL",
  location: i % 2 ? "아모레 스튜디오" : "",
  locationLat: i % 2 ? 37.51 : null,
  locationLng: i % 2 ? 127.03 : null,
  memo: i % 3 ? "드레스 2벌 포함. 원본 파일 별도 문의." : "",
}));

const FEED = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  categoryName: CATS[i % CATS.length],
  placeName: `업체 ${i + 1}`,
  placeId: `p${i}`,
  address: "서울 강남구 테헤란로 152",
  region: "서울 강남구",
  amount: i === 2 ? undefined : (i + 1) * 120,
  rating: 4,
  comment: "친절하고 결과물도 좋았어요. 다만 대기 시간이 조금 길었습니다.",
  authorDDay: 131 - i,
  authorRole: i % 2 ? "신부" : "신랑",
  helpfulCount: 12 - i,
  myVote: null,
  createDate: "2026-08-0" + ((i % 9) + 1),
}));

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

    const send = (d) => void req.respond(ok(d)).catch(() => {});

    if (p0 === "/plan/user") return send(USER);
    // 단위는 **만원**이다 (원 아님)
    if (p0 === "/plan/user/total-amount")
      return send({
        totalAmount: 4200,
        usedAmount: 1340,
        remainingAmount: 2860,
      });
    if (p0 === "/plan/room/spouse") return send(null);
    if (p0 === "/plan/category/user/list" || p0 === "/plan/category/list")
      return send({
        list: CATS.map((name, i) => ({
          id: i + 1,
          name,
          color: "#ee2b8c",
          type: "SYSTEM",
        })),
        total: CATS.length,
      });
    if (p0 === "/plan/schedule/list")
      return send({ list: SCHEDULES, total: SCHEDULES.length });
    if (/^\/plan\/schedule\/\d+$/.test(p0)) return send(SCHEDULES[3]);
    if (p0 === "/plan/schedule/calendar") {
      const day = {};
      SCHEDULES.forEach((sc) => {
        (day[sc.startDate] ||= []).push({
          id: sc.id,
          title: sc.title,
          status: sc.status,
          categoryName: sc.categoryName,
          amount: sc.amount,
          startTime: sc.startTime,
        });
      });
      return send({ day });
    }
    if (p0 === "/plan/activity/list")
      return send({
        list: SCHEDULES.slice(0, 6).map((sc, i) => ({
          id: i + 1,
          type: "SCHEDULE_CREATED",
          actorPlanUserId: i % 2 ? "me-1" : "u-2",
          actorName: i % 2 ? "지수" : "현우",
          actorImage: null,
          targetType: "SCHEDULE",
          targetId: sc.id,
          targetTitle: sc.title,
          amount: sc.amount,
          createDate: "2026-09-0" + ((i % 9) + 1),
        })),
        total: 6,
      });
    if (p0.includes("/amount/category-chart"))
      return send(
        CATS.map((c, i) => ({
          categoryName: c,
          amount: (i + 1) * 220,
          plannedAmount: (i + 2) * 260,
        })),
      );
    if (p0.includes("/amount/detail"))
      return send({
        initialCapital: 4200,
        usedTotal: 1340,
        plannedTotal: 1850,
        list: SCHEDULES,
      });
    // `data.list` 로 감싸야 한다 — 배열을 그대로 주면 목록이 빈 채로 뜬다
    if (p0 === "/plan/room/list")
      return send({
        list: [
          ...Array.from({ length: 3 }, (_, i) => ({
            id: 20 + i,
            onwerName: `이웃 ${i + 1}`,
            weddingDate: "2027-05-1" + i,
            budget: 3000 + i * 100,
            remainingBudget: 1200 + i * 50,
            plannedUseAmount: 300,
            myPermission: "READ",
            members: [
              {
                planUserId: `n-${i}`,
                name: `이웃 ${i + 1}`,
                image: null,
                permission: "OWNER",
              },
            ],
            chatRooms: [
              { id: 300 + i, name: "스드메", isCouple: false, memberList: [] },
            ],
          })),
          {
            id: 8,
            onwerName: "박현우",
            weddingDate: "2027-03-20",
            budget: 900,
            remainingBudget: 410,
            plannedUseAmount: 130,
            myPermission: "SPOUSE",
            members: [
              {
                planUserId: "u-2",
                name: "박현우",
                image: null,
                permission: "OWNER",
              },
              {
                planUserId: "me-1",
                name: "김지수",
                image: null,
                permission: "SPOUSE",
              },
            ],
            chatRooms: [
              { id: 201, name: "항공 · 숙소", isCouple: false, memberList: [] },
            ],
          },
          {
            id: 7,
            onwerName: "김지수",
            weddingDate: "2026-12-31",
            budget: 4200,
            remainingBudget: 2860,
            plannedUseAmount: 620,
            myPermission: "OWNER",
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
                permission: "SPOUSE",
              },
            ],
            chatRooms: [
              { id: 101, name: "스드메", isCouple: true, memberList: [] },
              { id: 102, name: "본식 준비", isCouple: false, memberList: [] },
            ],
          },
        ],
      });
    if (/^\/plan\/chat\/info\/\d+$/.test(p0))
      return send({
        id: 101,
        name: "지수 · 현우",
        isCouple: true,
        memberList: [
          {
            planUserId: "me-1",
            name: "지수",
            image: null,
            permission: "OWNER",
          },
          {
            planUserId: "you-2",
            name: "현우",
            image: null,
            permission: "SPOUSE",
          },
        ],
      });
    if (/^\/plan\/chat\/\d+$/.test(p0))
      return send({
        list: Array.from({ length: 12 }, (_, i) => ({
          id: 100 - i,
          messageType: "text",
          planUserId: i % 2 ? "you-2" : "me-1",
          planUserName: i % 2 ? "현우" : "지수",
          planUserProfileImageUrl: null,
          text: "여기까지 확인했어요. 다음 주에 다시 봐요.",
          createDate: `2026-09-01T1${i % 10}:00:00`,
          unreadCount: 0,
        })),
        total: 12,
      });
    if (/^\/plan\/chat\/message\/count\/\d+$/.test(p0))
      return send({ count: 0 });
    if (p0 === "/plan/feed" || p0.startsWith("/plan/feed/list"))
      return send({ list: FEED, total: FEED.length });
    if (p0.startsWith("/plan/feed"))
      return send({ list: FEED, total: FEED.length });
    if (/^\/plan\/room\//.test(p0))
      return send({ id: 7, name: "지수 · 현우", permission: "OWNER" });
    // 자랑하기. 빈 목록으로 두면 벽돌 배치가 한 번도 안 그려진다
    if (p0 === "/plan/brag/my")
      return send({ published: true, bragId: 1, publishedAt: null, likeCount: 24 });
    if (p0.startsWith("/plan/brag"))
      return send({ list: BRAGS, total: BRAGS.length });

    // 모르는 경로는 **빈 목록**으로 답한다. `null` 로 주면 목록을 기대하는
    // 화면이 통째로 오류 상태로 떨어진다.
    return send({ list: [], total: 0 });
  });
}

/**
 * 재는 폭·높이. **CSS 픽셀로 실제 보이는 크기**다 (기기 해상도 아님).
 * 사파리는 위 주소창 + 아래 도구 막대가 같이 뜬 값과, 스크롤해서 주소창이
 * 접힌 값을 둘 다 본다.
 */
const VIEWPORTS = [
  { n: "320x568-아이폰SE1", w: 320, h: 568 },
  { n: "360x640-저가안드로이드", w: 360, h: 640 },
  { n: "375x553-아이폰SE-사파리", w: 375, h: 553 },
  { n: "375x667-아이폰SE-접힘", w: 375, h: 667 },
  { n: "390x664-아이폰12-사파리", w: 390, h: 664 },
  { n: "390x760-아이폰12-접힘", w: 390, h: 760 },
  { n: "393x727-픽셀-크롬", w: 393, h: 727 },
  { n: "414x715-아이폰11-사파리", w: 414, h: 715 },
  { n: "430x745-아이폰15ProMax-사파리", w: 430, h: 745 },
  { n: "430x871-아이폰15ProMax-접힘", w: 430, h: 871 },
  { n: "768x900-태블릿", w: 768, h: 900 },
];
const SHOT_VIEWPORTS = new Set([
  "375x553-아이폰SE-사파리",
  "390x664-아이폰12-사파리",
  "320x568-아이폰SE1",
]);

/** 자랑하기 목록 카드. 높이가 제각각이어야 벽돌 배치가 의미가 있다 */
const BRAGS = [
  {
    bragId: 1,
    nickname: "유진 · 태호",
    weddingDate: "2026-10-03",
    dday: 24,
    totalBudget: 3600,
    usedAmount: 2900,
    plannedAmount: 340,
    planCount: 13,
    doneCount: 9,
    categories: ["예식장", "스드메", "예물 · 예단", "신혼여행", "청첩장"],
    likeCount: 41,
    liked: false,
    publishedAt: "2026-09-08T00:00:00.000Z",
    isMine: false,
  },
  {
    bragId: 2,
    nickname: "지수 · 현우",
    weddingDate: "2026-11-14",
    dday: 66,
    totalBudget: 4200,
    usedAmount: 1340,
    plannedAmount: 1850,
    planCount: 18,
    doneCount: 11,
    categories: ["예식장", "스드메"],
    likeCount: 24,
    liked: false,
    publishedAt: "2026-09-05T00:00:00.000Z",
    isMine: true,
  },
  {
    bragId: 3,
    nickname: "민서 · 도현",
    weddingDate: "2027-03-20",
    dday: 190,
    totalBudget: 2800,
    usedAmount: 300,
    plannedAmount: 900,
    planCount: 7,
    doneCount: 2,
    categories: ["예식장"],
    likeCount: 3,
    liked: true,
    publishedAt: "2026-09-01T00:00:00.000Z",
    isMine: false,
  },
];

const SCREENS = [
  { name: "main", url: "/main", wait: 2600 },
  { name: "calendar", url: "/calendar", wait: 2600 },
  { name: "plan-list", url: "/plan-list", wait: 2400 },
  { name: "feed", url: "/feed", wait: 2400 },
  { name: "brag", url: "/brag", wait: 2400 },
  { name: "budget", url: "/budget-detail", wait: 2600 },
  { name: "user", url: "/user", wait: 2200 },
  { name: "add-plen", url: "/add-plen?id=4", wait: 3000 },
  { name: "schedule-detail", url: "/schedule-detail?id=4", wait: 2600 },
  { name: "chat", url: "/chat/101", wait: 3000 },
];

/** 페이지 안에서 도는 계측기 */
function measure() {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return (
      r.width > 0 &&
      r.height > 0 &&
      st.visibility !== "hidden" &&
      st.display !== "none" &&
      Number(st.opacity) > 0.05
    );
  };

  // 가장 큰 세로 스크롤 영역
  let scroller = null;
  document.querySelectorAll("*").forEach((el) => {
    const st = getComputedStyle(el);
    if (!/(auto|scroll)/.test(st.overflowY)) return;
    if (el.scrollHeight - el.clientHeight < 8) return;
    if (!scroller || el.clientHeight > scroller.clientHeight) scroller = el;
  });

  const tabbarEl = document.querySelector("#main-bottom-nav nav");
  const tabbar =
    tabbarEl && vis(tabbarEl) ? tabbarEl.getBoundingClientRect() : null;
  const headEl = document.querySelector("[data-mobile-head]");
  const dockEl = document.querySelector("[data-dock-bar]");

  const shellEl =
    document.querySelector(".flex.h-\\[100dvh\\]") ||
    document.body.firstElementChild;

  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      top: r.top,
      bottom: r.bottom,
      left: r.left,
      right: r.right,
      h: r.height,
    };
  };

  return {
    innerW: window.innerWidth,
    innerH: window.innerHeight,
    docW: document.documentElement.scrollWidth,
    docH: document.documentElement.scrollHeight,
    scroller: scroller
      ? {
          top: Math.round(scroller.scrollTop),
          max: Math.round(scroller.scrollHeight - scroller.clientHeight),
          clientH: scroller.clientHeight,
          rect: rect(scroller),
        }
      : null,
    tabbar: tabbar
      ? { top: tabbar.top, bottom: tabbar.bottom, h: tabbar.height }
      : null,
    head: headEl ? { ...rect(headEl), visible: vis(headEl) } : null,
    dock: dockEl ? { ...rect(dockEl), visible: vis(dockEl) } : null,
    // 탭바에 물린 조작 요소
    covered: (() => {
      if (!tabbar) return [];
      /*
        **잘려서 안 보이는 부분은 세지 않는다.** 홈의 플랜 목록처럼
        `overflow:hidden` 안에 든 카드는 실제 rect 가 탭바 아래까지 뻗지만
        화면에는 잘린 만큼만 보이고 그 아래는 만질 수도 없다. 조상들의
        잘림 상자와 교차시켜 **실제로 보이는 사각형**으로 판단한다.
      */
      const clipped = (el) => {
        let r = el.getBoundingClientRect();
        let top = r.top;
        let bottom = r.bottom;
        for (let a = el.parentElement; a; a = a.parentElement) {
          const st = getComputedStyle(a);
          if (!/(hidden|auto|scroll|clip)/.test(st.overflowY)) continue;
          const ar = a.getBoundingClientRect();
          top = Math.max(top, ar.top);
          bottom = Math.min(bottom, ar.bottom);
        }
        return { top, bottom, h: bottom - top };
      };
      const out = [];
      document
        .querySelectorAll(
          "button, a[href], input, textarea, select, [role='button']",
        )
        .forEach((el) => {
          if (!vis(el)) return;
          if (el.closest("#main-bottom-nav")) return;
          if (getComputedStyle(el).pointerEvents === "none") return;
          const r = clipped(el);
          if (r.h <= 2) return;
          // 보이는 부분의 세로 중심이 탭바 안이면 손가락이 탭바를 먼저 만난다
          const mid = (r.top + r.bottom) / 2;
          if (mid < tabbar.top || mid > tabbar.bottom) return;
          out.push(
            (el.textContent || el.getAttribute("placeholder") || el.tagName)
              .trim()
              .slice(0, 18) || el.tagName,
          );
        });
      return [...new Set(out)];
    })(),
  };
}

function scrollBottom() {
  let scroller = null;
  document.querySelectorAll("*").forEach((el) => {
    const st = getComputedStyle(el);
    if (!/(auto|scroll)/.test(st.overflowY)) return;
    if (el.scrollHeight - el.clientHeight < 8) return;
    if (!scroller || el.clientHeight > scroller.clientHeight) scroller = el;
  });
  if (scroller) scroller.scrollTop = scroller.scrollHeight;
  else window.scrollTo(0, document.body.scrollHeight);
}

// 다른 하네스(`nav-skeleton.cjs`)가 같은 목을 쓴다. require 로 불리면 돌지 않는다
module.exports = { installMocks, JWT, API, CORS, ok };
if (require.main === module) (async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const only = process.env.ONLY
    ? new Set(process.env.ONLY.split(",").map((x) => x.trim()))
    : null;
  const screens = only ? SCREENS.filter((s) => only.has(s.name)) : SCREENS;
  const shotAll = process.env.SHOTS === "all";

  const browser = await p.launch({
    executablePath: CHROME,
    headless: process.env.HEADED ? false : "new",
    args: ["--font-render-hinting=none", "--no-sandbox"],
  });
  const page = await browser.newPage();
  if (process.env.LOG) {
    page.on("pageerror", (e) =>
      console.log("  [pageerror]", String(e).slice(0, 400)),
    );
    page.on("console", (m) => {
      if (m.type() === "error")
        console.log("  [console]", m.text().slice(0, 400));
    });
  }

  await page.evaluateOnNewDocument((host) => {
    const Native = window.WebSocket;
    function Blocked(url, protocols) {
      if (String(url).includes(host)) throw new Error("harness: blocked");
      return new Native(url, protocols);
    }
    Blocked.prototype = Native.prototype;
    window.WebSocket = Blocked;
  }, new URL(API).host);

  await page.evaluateOnNewDocument(() => {
    const css = document.createElement("style");
    css.textContent =
      "nextjs-portal,#nextjs-dev-overlay,[data-nextjs-toast],[data-next-badge-root]{display:none!important}";
    const put = () => document.head && document.head.appendChild(css);
    if (document.head) put();
    else document.addEventListener("DOMContentLoaded", put);
  });

  await page.setViewport({ width: 390, height: 664, deviceScaleFactor: 2 });
  await page.goto(`${ORIGIN}/login`, { waitUntil: "domcontentloaded" });
  await page.setRequestInterception(true);
  installMocks(page);

  const problems = [];
  const bad = (m) => {
    problems.push(m);
    console.log(`   ✗ ${m}`);
  };

  for (const vp of VIEWPORTS) {
    console.log(`\n== ${vp.n}`);
    await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 2 });

    for (const s of screens) {
      await page.evaluate((t) => {
        localStorage.setItem("plan_auth_token", t);
        sessionStorage.setItem("plan_auth_token", t);
        sessionStorage.setItem("plan_has_completed_guest_setting", "1");
      }, JWT);

      await page.goto(`${ORIGIN}${s.url}`, {
        waitUntil: "networkidle2",
        timeout: 60000,
      });
      await wait(s.wait);

      const top = await page.evaluate(measure);
      await page.evaluate(scrollBottom);
      await wait(500);
      const end = await page.evaluate(measure);

      const tag = `${s.name} ${vp.n}`;

      // 1. 가로 넘침
      if (top.docW > top.innerW + 1)
        bad(`${tag}: 가로로 ${top.docW - top.innerW}px 넘친다`);

      // 2. 문서 자체는 스크롤되지 않아야 한다 — 셸이 `h-[100dvh]` 로 화면을
      //    딱 채우고 안쪽 영역만 구른다. 문서가 넘치면 iOS 에서 주소창이
      //    접혔다 펴지며 화면이 출렁인다
      if (top.docH > vp.h + 2)
        bad(`${tag}: 문서가 ${top.docH - vp.h}px 넘쳐 화면째로 스크롤된다`);

      // 3. 탭바에 가린 조작 요소 (아래까지 내린 뒤)
      if (end.covered.length)
        bad(`${tag}: 탭바에 가림 → ${end.covered.join(" / ")}`);

      /*
        4. 머리 면이 함께 올라가는지.
           탭바가 없는 폭(≥768)은 `md:sticky` 로 **일부러 고정**이므로 건너뛴다.
           스크롤 여지가 머리 면 높이보다 작으면 끝까지 못 올라가는 게 정상이라
           그때도 건너뛴다.
      */
      if (end.head && end.scroller && top.tabbar && top.head) {
        // 처음 머리 면의 아랫변만큼 내려가야 완전히 사라진다. 스크롤 여지가
        // 그보다 적으면 끝까지 못 올라가는 게 맞다 (끝을 지나 구를 수는 없다)
        const need = Math.round(top.head.bottom);
        if (end.scroller.top > need + 8 && end.head.bottom > 1)
          bad(
            `${tag}: 머리 면이 고정돼 있다 (${need}px 만 내리면 사라져야 하는데 ${end.scroller.top}px 내리고도 bottom=${Math.round(end.head.bottom)})`,
          );
      }

      // 5. 바닥 바와 탭바 사이 틈
      if (top.dock && top.dock.visible && top.tabbar) {
        const gap = Math.round(top.tabbar.top - top.dock.bottom);
        if (gap > 1)
          bad(`${tag}: 바닥 바와 탭바 사이가 ${gap}px 비어 내용이 지나간다`);
      }

      const line =
        `  ${s.name.padEnd(16)}` +
        `스크롤=${top.scroller ? top.scroller.max : 0}px ` +
        `머리면=${top.head ? (end.head && end.head.bottom <= 1 ? "함께올라감" : "고정") : "-"} ` +
        `바닥바=${top.dock && top.dock.visible ? "있음" : "-"} ` +
        `가림=${end.covered.length || 0} ` +
        `탭바h=${top.tabbar ? Math.round(top.tabbar.h) : "-"} ` +
        `바닥바=${top.dock ? Math.round(top.dock.top) + ".." + Math.round(top.dock.bottom) : "-"} ` +
        `창h=${top.innerH}`;
      console.log(line);

      if (shotAll || SHOT_VIEWPORTS.has(vp.n)) {
        const dir = path.join(OUT, vp.n);
        fs.mkdirSync(dir, { recursive: true });
        await page.evaluate(() => {
          let sc = null;
          document.querySelectorAll("*").forEach((el) => {
            const st = getComputedStyle(el);
            if (!/(auto|scroll)/.test(st.overflowY)) return;
            if (el.scrollHeight - el.clientHeight < 8) return;
            if (!sc || el.clientHeight > sc.clientHeight) sc = el;
          });
          if (sc) sc.scrollTop = 0;
        });
        await wait(400);
        await page.screenshot({ path: path.join(dir, `${s.name}-top.png`) });
        await page.evaluate(scrollBottom);
        await wait(500);
        await page.screenshot({ path: path.join(dir, `${s.name}-end.png`) });
      }
    }
  }

  await browser.close();
  console.log(
    problems.length
      ? `\n문제 ${problems.length}건:\n - ` + problems.join("\n - ")
      : "\n모든 뷰포트 이상 없음",
  );
  process.exit(problems.length ? 1 : 0);
})();
