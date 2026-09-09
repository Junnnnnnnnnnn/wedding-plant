/* eslint-disable no-console */
/**
 * 모바일(375) 화면 전수 캡처 — C안 리디자인 대조용.
 *
 * 다른 하네스가 이미 375 를 찍는 화면(`/main`·`/calendar`·`/plan-list`·
 * `/feed`·`/budget-detail`·`/user`·`/add-plen`·`/setting`·`/`)은 그쪽에
 * 맡기고, **아무도 안 찍던 다섯 화면**을 여기서 찍는다.
 *
 *   /login · /privacy · /share/{code} · /schedule-detail?id= · /chat/{id}
 *
 * 대조 문서(`docs/concepts/c-*.html`)의 "지금" 쪽은 전부 이 캡처들이다.
 * 지금 화면을 손으로 다시 그리면 사실과 어긋나므로 실제 캡처만 쓴다.
 *
 * 실행: npm run dev 를 띄운 뒤 `node scripts/mobile-screens.cjs`
 *   SHOT_DIR 로 저장 위치를 바꿀 수 있고, HEADED=1 로 띄워 볼 수 있다.
 */
const fs = require("fs");
const path = require("path");
const p = require("puppeteer-core");

const ORIGIN = process.env.BASE || "http://localhost:3000";
const API = process.env.API || "https://api.seoulmoment.com.tw";
const OUT = process.env.SHOT_DIR || path.join(__dirname, "..", "__shots", "cur");
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

/** planUserId 만 있으면 되는 가짜 JWT (서명 검증은 프론트가 하지 않는다) */
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

const USER = {
  id: "me-1",
  name: "지수 · 현우",
  weddingDate: "2026-11-14",
  weddingVenue: "그랜드하얏트 서울",
  budget: 4200,
  roomId: null,
  profileImageUrl: null,
  hasSeenMainGuideDate: "2026-01-01",
  hasSeenBudgetGuideDate: "2026-01-01",
  hasSeenChatGuideDate: "2026-01-01",
  requiredAgreementDate: "2026-01-01",
  members: [],
  chatRooms: [{ id: 101, name: "지수 · 현우", isCouple: true }],
};

/**
 * 필드 이름을 화면이 쓰는 것과 맞춘다.
 *  - amount 는 **만원 단위** (화면이 `${amount}만 원` 으로 찍는다)
 *  - payType 은 CASH/CREDIT/OTHER 만 라벨로 바뀐다 (그 밖은 원문 그대로 노출)
 *  - 좌표는 locationLat/locationLng — lat/lng 로 주면 지도가 안 뜬다
 */
const SCHEDULE = {
  id: 4,
  categoryName: "스드메",
  title: "본식 촬영",
  amount: 185,
  payType: "CREDIT",
  startDate: "2026-09-12",
  startTime: "09:00",
  status: "NORMAL",
  location: "아모레 스튜디오",
  address: "서울 강남구 논현로 132",
  locationLat: 37.5172,
  locationLng: 127.0286,
  memo: "드레스 2벌 포함. 원본 파일 별도 문의.",
};

/**
 * 채팅 히스토리 목.
 *
 * 필드 이름을 앱이 읽는 것과 정확히 맞춰야 한다 —
 * `text`(`message` 아님) · `planUserName`(`name` 아님) ·
 * `planUserProfileImageUrl`. 예전에는 `message`/`name` 으로 줘서 말풍선이
 * 전부 **빈 알약**으로 찍혔고, 그걸 앱 문제로 시안 문서에 적었다.
 * `messageType` 이 없으면 "삭제된 일정입니다" 로 떨어진다 (ChatRoomView L318·340).
 */
const MESSAGES = [
  { id: 9, messageType: "text", planUserId: "me-1", planUserName: "지수", planUserProfileImageUrl: null, text: "스튜디오 시안 봤어?", createDate: "2026-09-01T10:02:00", unreadCount: 0 },
  { id: 8, messageType: "text", planUserId: "you-2", planUserName: "현우", planUserProfileImageUrl: null, text: "응 3번이 제일 나은 듯", createDate: "2026-09-01T10:01:00", unreadCount: 0 },
  { id: 7, messageType: "text", planUserId: "you-2", planUserName: "현우", planUserProfileImageUrl: null, text: "가격은 185 맞지?", createDate: "2026-09-01T10:00:00", unreadCount: 0 },
  { id: 6, messageType: "text", planUserId: "me-1", planUserName: "지수", planUserProfileImageUrl: null, text: "맞아. 드레스 2벌 포함이래", createDate: "2026-09-01T09:59:00", unreadCount: 0 },
  { id: 5, messageType: "schedule", planUserId: "me-1", planUserName: "지수", planUserProfileImageUrl: null, schedule: SCHEDULE, createDate: "2026-09-01T09:58:00", unreadCount: 0 },
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
    // SSE 는 끊기면 3초마다 재연결하므로 keep-alive 한 줄만 준다
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

    if (p0 === "/plan/user") return void req.respond(ok(USER)).catch(() => {});
    if (p0 === "/plan/user/total-amount")
      return void req
        .respond(ok({ totalAmount: 42000000, usedAmount: 6200000 }))
        .catch(() => {});
    if (/^\/plan\/schedule\/\d+$/.test(p0))
      return void req.respond(ok(SCHEDULE)).catch(() => {});
    if (p0 === "/plan/schedule/list")
      return void req.respond(ok({ list: [SCHEDULE], total: 1 })).catch(() => {});
    if (/^\/plan\/chat\/info\/\d+$/.test(p0))
      return void req
        .respond(
          ok({
            id: 101,
            name: "지수 · 현우",
            isCouple: true,
            // 앱이 읽는 이름은 `memberList` 다 (`members` 아님)
            memberList: [
              { planUserId: "me-1", name: "지수", image: null, permission: "OWNER" },
              { planUserId: "you-2", name: "현우", image: null, permission: "SPOUSE" },
            ],
          }),
        )
        .catch(() => {});
    if (/^\/plan\/chat\/\d+$/.test(p0))
      return void req
        .respond(ok({ list: MESSAGES, total: MESSAGES.length }))
        .catch(() => {});
    if (/^\/plan\/chat\/message\/count\/\d+$/.test(p0))
      return void req.respond(ok({ count: 0 })).catch(() => {});
    if (/^\/plan\/room\//.test(p0))
      return void req
        .respond(ok({ id: 7, name: "지수 · 현우", permission: "OWNER" }))
        .catch(() => {});

    req.respond(ok(null)).catch(() => {});
  });
}

const SCREENS = [
  { name: "login", url: "/login", auth: false, wait: 2200 },
  { name: "privacy", url: "/privacy", auth: false, wait: 2000 },
  { name: "share", url: "/share/testcode123", auth: false, wait: 2600 },
  { name: "schedule-detail", url: "/schedule-detail?id=4", auth: true, wait: 3200 },
  { name: "chat", url: "/chat/101", auth: true, wait: 3400 },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await p.launch({
    executablePath: CHROME,
    headless: process.env.HEADED ? false : "new",
    args: ["--font-render-hinting=none", "--no-sandbox"],
  });
  const page = await browser.newPage();

  // socket.io 는 WS 로 붙어 요청 가로채기를 우회한다. 그대로 두면 가짜
  // 토큰으로 공유 백엔드에 접속해 "존재하지 않는 방" 모달이 뜬다.
  await page.evaluateOnNewDocument((host) => {
    const Native = window.WebSocket;
    function Blocked(url, protocols) {
      if (String(url).includes(host)) throw new Error("harness: blocked");
      return new Native(url, protocols);
    }
    Blocked.prototype = Native.prototype;
    window.WebSocket = Blocked;
  }, new URL(API).host);

  // Next 개발 서버가 띄우는 좌하단 배지는 앱 UI 가 아니다. 대조 문서에
  // 그대로 실리면 앱 요소로 오해되므로 캡처에서만 가린다.
  await page.evaluateOnNewDocument(() => {
    const css = document.createElement("style");
    css.textContent =
      "nextjs-portal,#nextjs-dev-overlay,[data-nextjs-toast]{display:none!important}";
    document.addEventListener("DOMContentLoaded", () =>
      document.head.appendChild(css),
    );
  });

  await page.setViewport({ width: 375, height: 900, deviceScaleFactor: 2 });
  await page.goto(`${ORIGIN}/login`, { waitUntil: "domcontentloaded" });
  await page.setRequestInterception(true);
  installMocks(page);

  const problems = [];
  for (const s of SCREENS) {
    await page.evaluate(
      (t, useAuth) => {
        localStorage.clear();
        sessionStorage.clear();
        if (useAuth) {
          localStorage.setItem("plan_auth_token", t);
          sessionStorage.setItem("plan_auth_token", t);
        }
        // 온보딩 게이트에 막히지 않게 (게스트 화면도 그대로 보여야 한다)
        sessionStorage.setItem("plan_has_completed_guest_setting", "1");
      },
      JWT,
      s.auth,
    );

    await page.goto(`${ORIGIN}${s.url}`, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    await wait(s.wait);

    const landed = await page.evaluate(() => location.pathname);
    const expected = s.url.split("?")[0];
    if (landed !== expected) {
      problems.push(`${s.name}: ${expected} 로 갔는데 ${landed} 에 있다`);
    }

    await page.screenshot({ path: path.join(OUT, `${s.name}-375.png`) });
    console.log(`  · ${s.name} → ${landed}`);
  }

  await browser.close();
  console.log(problems.length ? "\n" + problems.join("\n") : "\n이상 없음");
  process.exit(problems.length ? 1 : 0);
})();
