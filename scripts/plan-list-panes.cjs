/*
 * /plan-list 의 폭별 레이아웃과 채팅 pane 을 확인한다.
 *
 * 실제 백엔드 없이 목 응답으로 구동한다. 확인하는 것:
 *   1. 375 / 768 / 1024 / 1280 / 1440 캡처 (375 는 변경 전과 같아야 한다)
 *   2. ≥1024 에서 채팅방 칩을 누르면 라우트 이동 없이 우측 pane 이 열리는지
 *   3. 보고 있는 방의 SSE 알림은 토스트가 뜨지 않고,
 *      다른 방의 알림은 토스트가 뜨는지 (NotificationContext.setActiveRoomId)
 *
 * 준비:  npm run dev / npm install --no-save puppeteer-core
 * 실행:  node scripts/plan-list-panes.cjs
 *
 * 목 응답에는 CORS 헤더와 OPTIONS 프리플라이트 응답이 반드시 필요하다.
 * 없으면 전부 CORS 로 막혀 화면까지 가지 못한다.
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

const ROOMS = [
  // 실제 API 는 방장+배우자 둘만 있는 방 하나에만 isCouple 을 붙인다
  { id: 101, name: "스드메", isCouple: true },
  { id: 102, name: "본식 준비" },
  { id: 103, name: "예물 · 예단" },
];

const PLANS = [
  {
    roomId: 1,
    onwerName: "김지수",
    // 실제 /plan/room/list 는 weddingDate 를 함께 준다 (카드 머리글의 D-day)
    weddingDate: "2026-12-31",
    budget: 4200,
    remainingBudget: 2860,
    // remainingBudget = budget - (예정 + 사용) 이므로 예정은 1,340 이하여야
    // 앞뒤가 맞는다. 실제 API 와 같은 관계를 지킨다.
    plannedUseAmount: 900,
    members: [
      { planUserId: "me-1", name: "김지수", image: null, permission: "OWNER" },
      { planUserId: "u-2", name: "박현우", image: null, permission: "WRITE" },
      { planUserId: "u-3", name: "엄마", image: null, permission: "WRITE" },
    ],
    chatRooms: ROOMS.map((r) => ({
      id: r.id,
      name: r.name,
      isCouple: r.isCouple === true,
      memberList: [
        { planUserId: "me-1", name: "김지수", image: null },
        { planUserId: "u-2", name: "박현우", image: null },
      ],
    })),
  },
  {
    roomId: 2,
    onwerName: "박현우",
    weddingDate: "2027-03-20",
    budget: 900,
    remainingBudget: 410,
    plannedUseAmount: 180,
    members: [
      { planUserId: "u-2", name: "박현우", image: null, permission: "OWNER" },
      { planUserId: "me-1", name: "김지수", image: null, permission: "WRITE" },
    ],
    chatRooms: [
      {
        id: 201,
        name: "항공 · 숙소",
        memberList: [{ planUserId: "u-2", name: "박현우", image: null }],
      },
    ],
  },
];

const HISTORY = [
  {
    id: "m5",
    planUserId: "u-2",
    planUserName: "박현우",
    messageType: "text",
    text: "드레스 투어 23일 일요일 11시로 잡았어",
    createDate: "2026-08-20T09:41:00+09:00",
    unreadCount: 0,
  },
  {
    id: "m4",
    planUserId: "me-1",
    planUserName: "김지수",
    messageType: "text",
    text: "그럼 일단 원본만으로 잡자",
    createDate: "2026-08-18T14:19:00+09:00",
    unreadCount: 0,
  },
  {
    id: "m3",
    planUserId: "u-2",
    planUserName: "박현우",
    messageType: "text",
    text: "40만원. 근데 앨범은 나중에 따로 해도 된대",
    createDate: "2026-08-18T14:17:00+09:00",
    unreadCount: 0,
  },
  {
    id: "m2",
    planUserId: "me-1",
    planUserName: "김지수",
    messageType: "text",
    text: "앨범 추가하면 얼마나 더 붙어?",
    createDate: "2026-08-18T14:16:00+09:00",
    unreadCount: 0,
  },
  {
    id: "m1",
    planUserId: "u-2",
    planUserName: "박현우",
    messageType: "text",
    text: "스튜디오 세 곳 견적 다 받았어. 아모레 스튜디오가 제일 마음에 들더라",
    createDate: "2026-08-18T14:14:00+09:00",
    unreadCount: 0,
  },
];

/** null 이면 SSE 는 빈 keep-alive 만 보낸다. 숫자면 그 방에 새 메시지를 흘린다 */
let armedRoom = null;

function installMocks(page) {
  page.on("request", (req) => {
    const url = req.url();
    const method = req.method();

    if (!url.startsWith(API)) {
      req.continue().catch(() => {});
      return;
    }
    if (method === "OPTIONS") {
      req.respond({ status: 204, headers: CORS, body: "" }).catch(() => {});
      return;
    }

    const p0 = url.slice(API.length).split("?")[0];

    // socket.io 는 이 하네스에서 띄우지 않는다. 빨리 실패시켜 둔다.
    if (p0.startsWith("/socket.io")) {
      req.respond({ status: 404, headers: CORS, body: "" }).catch(() => {});
      return;
    }

    // SSE: 응답 하나를 흘리고 닫는다. EventSource 가 재연결하며 다시 들어온다.
    const sse = p0.match(/^\/plan\/notification\/chat\/(\d+)$/);
    if (sse) {
      const roomId = Number(sse[1]);
      const payload =
        armedRoom === roomId
          ? {
              type: "message",
              data: {
                planUserId: "u-2",
                planUserName: "박현우",
                planUserProfileImageUrl: null,
                text: "새 메시지가 도착했습니다",
              },
            }
          : { type: "keep-alive" };
      req
        .respond({
          status: 200,
          headers: { ...CORS, "Cache-Control": "no-cache" },
          contentType: "text/event-stream",
          body: `data: ${JSON.stringify(payload)}\n\n`,
        })
        .catch(() => {});
      return;
    }

    if (p0 === "/plan/user") {
      req
        .respond(
          ok({
            name: "김지수",
            budget: 4200,
            weddingDate: "2026-11-14",
            roomId: 1,
            hasSeenChatGuide: true,
            chatRooms: ROOMS.map((r) => ({ id: r.id })),
          }),
        )
        .catch(() => {});
      return;
    }
    if (p0 === "/plan/room/list") {
      req.respond(ok({ list: PLANS, total: PLANS.length })).catch(() => {});
      return;
    }
    if (/^\/plan\/chat\/message\/count\/\d+$/.test(p0)) {
      const rid = Number(p0.split("/").pop());
      req.respond(ok({ count: rid === 101 ? 2 : 0 })).catch(() => {});
      return;
    }
    if (/^\/plan\/chat\/info\/\d+$/.test(p0)) {
      const rid = Number(p0.split("/").pop());
      const room = [...ROOMS, { id: 201, name: "항공 · 숙소" }].find(
        (r) => r.id === rid,
      );
      req
        .respond(
          ok({
            id: rid,
            name: room ? room.name : "플랜톡",
            memberList: [
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
          }),
        )
        .catch(() => {});
      return;
    }
    if (/^\/plan\/chat\/\d+$/.test(p0)) {
      req.respond(ok({ list: HISTORY, total: HISTORY.length })).catch(() => {});
      return;
    }

    req.respond(ok({ list: [], total: 0 })).catch(() => {});
  });
}

const hasToast = (page) =>
  page.evaluate(() =>
    document.body.innerText.includes("새 메시지가 도착했습니다"),
  );

(async () => {
  const browser = await p.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--font-render-hinting=none"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });

  await page.goto(`${ORIGIN}/plan-list`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.evaluate((t) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("plan_auth_token", t);
    sessionStorage.setItem("plan_auth_token", t);
    localStorage.setItem("hasSeenChatGuide", "true");
  }, JWT);

  // socket.io 는 WebSocket 으로 붙어서 요청 가로채기를 우회한다. 가짜 토큰으로
  // 공유 백엔드를 건드리지 않도록 API 호스트로 가는 WS 만 막는다.
  // (막지 않으면 실제 서버가 "존재하지 않는 방" 오류 모달을 띄운다)
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

  // ── 1. 폭별 캡처 ─────────────────────────────────────────────
  for (const w of [375, 768, 1024, 1280, 1440, 2327]) {
    await page.setViewport({ width: w, height: 900, deviceScaleFactor: 1.5 });
    await page.goto(`${ORIGIN}/plan-list`, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    await wait(1500);
    await page.screenshot({ path: path.join(OUT, `planlist-${w}.png`) });
    console.log(`캡처 planlist-${w}.png`);
  }

  // ── 2. ≥1024 에서 채팅방 칩 클릭 → pane 이 열리는가 ──────────
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1.5 });
  await page.goto(`${ORIGIN}/plan-list`, {
    waitUntil: "networkidle2",
    timeout: 60000,
  });
  await wait(1500);

  await page.evaluate(() => {
    // 커플 방은 제목 옆에 "신랑 · 신부" 배지가 붙어 innerText 가 길어진다.
    // 정확히 일치로 찾으면 못 찾는다.
    const el = [...document.querySelectorAll("h4")].find((h) =>
      h.innerText.trim().startsWith("스드메"),
    );
    if (!el) throw new Error("스드메 채팅방을 찾지 못했다");
    el.closest("div[class*='rounded-2xl']").click();
  });
  await wait(2500);

  const afterClick = await page.evaluate(() => ({
    url: location.pathname + location.search,
    paneOpen: !!document.getElementById("chat-viewport-wrapper") === false,
    hasComposer: [...document.querySelectorAll("textarea, input")].some((n) =>
      (n.placeholder || "").includes("메시지"),
    ),
    showsHistory: document.body.innerText.includes("아모레 스튜디오"),
  }));
  await page.screenshot({ path: path.join(OUT, "planlist-1280-chat.png") });
  console.log("캡처 planlist-1280-chat.png");
  console.log(
    `  URL=${afterClick.url}  입력창=${afterClick.hasComposer ? "있음" : "없음"}  이전대화=${
      afterClick.showsHistory ? "보임" : "안보임"
    }  fixed래퍼=${afterClick.paneOpen ? "없음(pane)" : "있음(standalone)"}`,
  );

  // ── 3. 토스트 억제 ───────────────────────────────────────────
  // 보고 있는 방(101) 알림은 무시되어야 하고, 다른 방(102)은 떠야 한다.
  armedRoom = 101;
  await wait(9000);
  const toastForCurrent = await hasToast(page);

  armedRoom = 102;
  await wait(9000);
  const toastForOther = await hasToast(page);

  console.log(
    `  보고 있는 방(101) 알림 → 토스트 ${toastForCurrent ? "뜸 (문제)" : "안 뜸 (정상)"}`,
  );
  console.log(
    `  다른 방(102) 알림     → 토스트 ${toastForOther ? "뜸 (정상)" : "안 뜸 (문제)"}`,
  );

  // 가이드 말풍선은 타깃 rect 로 좌표를 잡는다. 레이아웃을 바꾸면
  // 앵커가 화면 밖으로 밀리기 쉬우므로 폭마다 보이는지 확인한다.
  for (const w of [375, 1024, 1440, 2327]) {
    await page.setViewport({ width: w, height: 900, deviceScaleFactor: 1 });
    await page.goto(`${ORIGIN}/plan-list`, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    await wait(1800);
    const anchors = await page.evaluate(() =>
      ["plan-list-header", "plan-card-0", "plan-channels-0"].map((id) => {
        const el = document.getElementById(id);
        if (!el) return `${id}=없음`;
        const r = el.getBoundingClientRect();
        const onScreen =
          r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= innerWidth;
        return `${id}=${onScreen ? "정상" : `벗어남(${Math.round(r.left)}~${Math.round(r.right)})`}`;
      }),
    );
    console.log(`  가이드 앵커 ${w}px  ${anchors.join("  ")}`);
  }

  /*
   * 비로그인으로 들어오면 "로그인이 필요합니다" 모달이 뜬다.
   * 닫기는 홈(/main)으로 가야 한다 — 예전에는 랜딩("/")으로 보내서
   * 셸에서 탭을 눌러 들어온 사람이 로그인 전 화면까지 튕겨 나갔다.
   */
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    // 온보딩을 끝낸 게스트. 이게 없으면 /main 이 자기 게이트로 다시 내보낸다
    sessionStorage.setItem("plan_has_completed_guest_setting", "1");
  });
  await page.goto(`${ORIGIN}/plan-list`, {
    waitUntil: "networkidle2",
    timeout: 60000,
  });
  await wait(1800);
  const closed = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('[role="dialog"] button')].find(
      (b) => b.textContent.trim() === "닫기",
    );
    if (!btn) return false;
    btn.click();
    return true;
  });
  await wait(1500);
  const afterClose = new URL(page.url()).pathname;
  console.log(
    `  비로그인 닫기  버튼=${closed ? "있음" : "없음"}  이동=${afterClose}`,
  );
  const closeOk = closed && afterClose === "/main";
  if (!closeOk) console.log("   - 닫기가 /main 으로 가지 않았다");

  await browser.close();

  if (toastForCurrent || !toastForOther || !closeOk) process.exit(1);
})().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
