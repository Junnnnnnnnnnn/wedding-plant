/*
 * 자랑하기(`/brag`)와 홈의 자랑하기 토글을 확인한다.
 *
 * 확인하는 것:
 *   1. 375 / 768 / 1024 / 1440 캡처 — 벽돌 배치가 폭마다 몇 단인지
 *   2. 카드를 누르면 **페이지를 옮기지 않고** 모달이 뜨는지, 그 모달이
 *      시안의 크기 규칙(최대 1520x680, 한 변 여백 200px 상한)을 따르는지
 *   3. **묶음 머리의 색이 왼쪽 범례 색과 같은지** — C안의 전부가 이 연결이다.
 *      어긋나면 왼쪽 예산 패널이 장식이 된다
 *   4. 묶음 소계가 **지출과 예정을 함께** 센 값인지 (완료 185 + 예정 35 = 220)
 *   5. 플랜 카드의 체크가 **눌리지 않는지** (button 이 아니어야 한다)
 *   6. 좋아요가 낙관적으로 그려지고, 실패하면 되돌아오는지
 *   7. 홈의 토글 → 안내 모달 → 올리기 로 `PUT /plan/brag` 가 나가는지,
 *      안내 모달이 **공개되는 것을 글자 그대로** 적는지 (일정별 금액 포함)
 *   8. 내 카드에는 좋아요가 없고 "내려두기" 가 있는지
 *
 * 준비:  npm run dev / npm install --no-save puppeteer-core
 * 실행:  node scripts/brag.cjs
 *        LIKE_FAIL=1 node scripts/brag.cjs   (좋아요 요청이 실패하는 경우)
 *        HEADED=1 ...                        (브라우저를 띄워 직접 눌러보기)
 *
 * 목 응답에는 CORS 헤더와 OPTIONS 프리플라이트 응답이 반드시 필요하다.
 * API 호스트로 가는 WebSocket 도 막는다 (plan-list-panes.cjs 주석 참고).
 */
const path = require("path");
const p = require(path.join(__dirname, "..", "node_modules", "puppeteer-core"));

const CHROME =
  process.env.CHROME ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const API = "https://api.seoulmoment.com.tw";
/* 다른 작업 트리의 dev 서버가 3000 을 쓰고 있을 수 있다 */
const ORIGIN = process.env.BASE || process.env.ORIGIN || "http://localhost:3000";
const OUT = process.env.SHOT_DIR || __dirname;
const LIKE_FAIL = !!process.env.LIKE_FAIL;

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
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
};
const ok = (d) => ({
  status: 200,
  headers: CORS,
  contentType: "application/json",
  body: JSON.stringify({ result: true, data: d }),
});
const fail = () => ({
  status: 200,
  headers: CORS,
  contentType: "application/json",
  body: JSON.stringify({ result: false, data: null }),
});

/*
 * 시안(`docs/concepts/brag-modal-m5-4.html`)과 **같은 숫자**를 쓴다.
 * 예산 3,600 / 지출 2,900 / 사용 예상 340 / 남음 360 / 플랜 13장 중 9장 완료.
 * 캡처를 시안과 나란히 놓고 볼 수 있어야 어긋난 곳이 보인다.
 */
/** 카카오에서 고른 일정만. 나머지는 장소가 없다 */
const PLACES = {
  "예식장 잔금": { location: "SG 웨딩홀", lat: 37.5006, lng: 127.0364 },
  "예식장 계약금": { location: "SG 웨딩홀", lat: 37.5006, lng: 127.0364 },
  "예물 상담": { location: "종로 3가 귀금속", lat: 37.5714, lng: 126.9917 },
  /*
    **손으로 적은 장소.** 카카오에서 고르지 않아 좌표가 없다 — 이름은
    보이지만 지도는 못 그린다. 좌표까지 다 채워 두면 이 분기를 못 본다.
  */
  "드레스 피팅": { location: "신사동 드레스샵", lat: null, lng: null },
  /*
    **실제 데이터의 모양.** 장소 칸은 카카오에서 고르면 좌표가 붙고, 아니면
    `0.00000000` 이 들어간다 — 해외 장소가 그렇게 저장된다. null 만 걸러
    내면 기니 만(0, 0)에 마커가 찍힌 빈 지도가 그려진다(실제로 푸꾸옥
    호텔이 백지로 떴다).
  */
  "신혼여행 숙소": {
    location: "씨쉘 푸꾸옥 호텔 앤 스파",
    lat: 0,
    lng: 0,
  },
};

/** 일정 완료와 어긋나는 것만 적는다. 나머지는 완료 여부를 따라간다 */
const PAID = {
  "신혼여행 항공": true, // 예정인데 미리 결제 — 이미 쓴 돈이다
  "드레스 피팅": false, // 끝났는데 아직 정산 안 함 — 아직 안 쓴 돈이다
};

const ITEMS = [
  ["폐백 음식", "혼수", "2026-10-01", 45, false],
  ["본식 헤어", "스드메", "2026-09-28", 35, false],
  ["답례품", "혼수", "2026-09-24", 100, false],
  ["신혼여행 항공", "신혼여행", "2026-09-20", 160, false],
  ["예식장 잔금", "예식장", "2026-09-02", 620, true],
  ["청첩장 발송", "청첩장", "2026-09-01", 180, true],
  ["메이크업 리허설", "스드메", "2026-08-22", 185, true],
  ["본식 촬영", "스드메", "2026-08-12", 185, true],
  ["드레스 피팅", "스드메", "2026-08-05", 90, true],
  ["예물 상담", "예물 · 예단", "2026-07-28", 480, true],
  ["스튜디오 계약", "스드메", "2026-07-20", 300, true],
  ["신혼여행 숙소", "신혼여행", "2026-07-08", 240, true],
  ["예식장 계약금", "예식장", "2026-06-30", 620, true],
].map(([title, categoryName, startDate, amount, done], i) => ({
  id: i + 1,
  title,
  categoryName,
  startDate,
  amount,
  status: done ? "COMPLETED" : "PLANNED",
  /*
    **결제는 일정 완료와 다른 축이다.** 둘을 똑같이 채워 두면 "미리 낸
    계약금"(예정+결제)과 "끝났는데 아직 정산 안 함"(완료+미결제) 분기를
    영영 못 본다 — 그 둘이 이 기능이 생긴 이유다.
  */
  isPaid: PAID[title] ?? done,
  /*
    **장소를 전부 채우지 않는다.** 안 고른 일정이 훨씬 많고, 장소를 담기
    전에 올라간 스냅샷에는 아예 없다. 다 채워 두면 "지도 없는 시트" 분기를
    영영 못 본다 (피드 목이 장소를 섞어 두는 것과 같은 이유).
  */
  ...(PLACES[title] ?? { location: null, lat: null, lng: null }),
}));

/**
 * **일부러 5개를 준다.** `STACK_COLORS` 는 4색이라, 앱이 그냥 `i % 4` 로
 * 색을 돌리면 다섯 번째가 첫 번째와 같은 분홍이 된다 — 실제로 "청첩장" 이
 * "예식장" 과 같은 색으로 나왔다. 4개짜리 목만 두면 이 분기를 영영 못 본다.
 *
 * 혼수는 지출이 없어(전부 예정) 여기 없다 — 색 없는 묶음이 무채색으로
 * 떨어지는 분기도 같이 본다.
 */
const CATEGORY_CHART = [
  { categoryName: "예식장", usedAmount: 1240 },
  { categoryName: "스드메", usedAmount: 760 },
  { categoryName: "예물 · 예단", usedAmount: 480 },
  { categoryName: "신혼여행", usedAmount: 240 },
  { categoryName: "청첩장", usedAmount: 180 },
];

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
    publishedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    isMine: false,
  },
  {
    // 내 것. 좋아요가 아니라 "내려두기" 가 붙어야 한다
    bragId: 2,
    nickname: "김지수 · 현우",
    weddingDate: "2026-11-14",
    dday: 66,
    totalBudget: 4200,
    usedAmount: 1340,
    plannedAmount: 1850,
    planCount: 18,
    doneCount: 11,
    categories: ["예식장", "스드메", "신혼여행"],
    likeCount: 24,
    liked: false,
    publishedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    isMine: true,
  },
  {
    // 이미 좋아요를 누른 것. 취소가 되는지 본다
    bragId: 3,
    nickname: "민서 · 도현",
    weddingDate: "2027-03-20",
    dday: 190,
    totalBudget: 2800,
    usedAmount: 300,
    plannedAmount: 900,
    planCount: 7,
    doneCount: 2,
    categories: ["예식장", "청첩장"],
    likeCount: 3,
    liked: true,
    publishedAt: new Date(Date.now() - 9 * 86400000).toISOString(),
    isMine: false,
  },
];

/** 하네스가 잡아 둔 요청 기록 */
const seen = { list: [], like: [], publish: [], detail: [] };
let published = false;

function installMocks(page) {
  page.on("request", (req) => {
    const url = req.url();
    const method = req.method();
    /*
      카카오 지도 SDK 는 **등록된 도메인에서만** 내려온다. 하네스는 3000 이
      아닌 포트에서 돌 때가 많아(다른 작업 트리가 3000 을 쓰고 있으면 늘
      그렇다) 그대로 두면 `domain mismatched` 로 거절당하고, 지도가 회색
      상자로 남는다 — **우리 코드 문제가 아닌데 문제처럼 보인다.**
      그래서 이 요청에만 Referer 를 등록된 주소로 바꿔 보낸다.
    */
    if (url.startsWith("https://dapi.kakao.com/")) {
      req
        .continue({
          headers: { ...req.headers(), referer: "http://localhost:3000/" },
        })
        .catch(() => {});
      return;
    }
    if (!url.startsWith(API)) {
      req.continue().catch(() => {});
      return;
    }
    if (method === "OPTIONS") {
      req.respond({ status: 204, headers: CORS, body: "" }).catch(() => {});
      return;
    }
    const p0 = url.slice(API.length).split("?")[0];
    const query = url.slice(API.length).split("?")[1] ?? "";
    const send = (r) => req.respond(r).catch(() => {});

    if (p0.startsWith("/socket.io")) {
      send({ status: 404, headers: CORS, body: "" });
      return;
    }
    if (/^\/plan\/notification\//.test(p0)) {
      send({
        status: 200,
        headers: { ...CORS, "Cache-Control": "no-cache" },
        contentType: "text/event-stream",
        body: `data: ${JSON.stringify({ type: "keep-alive" })}\n\n`,
      });
      return;
    }

    if (p0 === "/plan/user") {
      send(
        ok({
          name: "김지수",
          budget: 4200,
          weddingDate: "2026-11-14",
          roomId: 1,
          hasSeenChatGuide: true,
          hasSeenGuide: true,
          chatRooms: [],
          /*
            **방장인 나를 반드시 넣는다.** 로그인하면 내 플랜에도 방이 생겨
            `isRoomView` 가 참이 되고, 그때 "내 플랜인가"는 `members` 안의 내
            권한(OWNER)으로 판단한다. 비워 두면 권한이 undefined 라
            자랑하기 토글도 초대 띠도 뜨지 않는다 — 앱 버그로 오해하기 쉽다.
          */
          members: [
            {
              planUserId: "me-1",
              name: "김지수",
              image: null,
              permission: "OWNER",
            },
          ],
        }),
      );
      return;
    }

    // ── 자랑하기 ─────────────────────────────────────────────
    if (p0 === "/plan/brag/list") {
      seen.list.push(query);
      const sort = new URLSearchParams(query).get("sort");
      const list =
        sort === "LIKED"
          ? [...BRAGS].sort((a, b) => b.likeCount - a.likeCount)
          : BRAGS;
      send(ok({ list, total: list.length }));
      return;
    }
    if (p0 === "/plan/brag/my") {
      send(
        ok({
          published,
          bragId: published ? 2 : null,
          publishedAt: published ? new Date().toISOString() : null,
          likeCount: published ? 24 : 0,
        }),
      );
      return;
    }
    if (p0 === "/plan/brag") {
      if (method === "PUT") {
        seen.publish.push("PUT");
        published = true;
        send(ok({ bragId: 2 }));
        return;
      }
      if (method === "DELETE") {
        seen.publish.push("DELETE");
        published = false;
        send(ok(null));
        return;
      }
    }
    const like = /^\/plan\/brag\/like\/(\d+)$/.exec(p0);
    if (like) {
      seen.like.push(`${method} ${like[1]}`);
      if (LIKE_FAIL) {
        send(fail());
        return;
      }
      const b = BRAGS.find((x) => x.bragId === Number(like[1]));
      const liked = method === "POST";
      const likeCount = (b ? b.likeCount : 0) + (liked ? 1 : -1);
      send(ok({ likeCount, liked }));
      return;
    }
    const detail = /^\/plan\/brag\/(\d+)$/.exec(p0);
    if (detail) {
      seen.detail.push(detail[1]);
      const b = BRAGS.find((x) => x.bragId === Number(detail[1]));
      if (!b) {
        send({ status: 404, headers: CORS, body: "" });
        return;
      }
      send(ok({ ...b, categoryChart: CATEGORY_CHART, items: ITEMS }));
      return;
    }

    // 홈이 부르는 것들
    if (p0 === "/plan/user/total-amount") {
      send(ok({ totalAmount: 4200, usedAmount: 3190, remainingAmount: 1010 }));
      return;
    }
    if (p0 === "/plan/user/amount/detail") {
      send(ok({ usedAmount: 1340, plannedUseAmount: 1850 }));
      return;
    }
    if (/^\/plan\/user\/amount\/category-chart/.test(p0)) {
      send(ok({ list: CATEGORY_CHART }));
      return;
    }
    if (/^\/plan\/schedule\/(list|calendar)/.test(p0)) {
      send(ok({ list: [], total: 0 }));
      return;
    }
    // 모르는 경로는 **빈 목록**으로 돌려준다. null 을 주면 화면이 터진다
    send(ok({ list: [], total: 0 }));
  });
}

(async () => {
  const browser = await p.launch({
    executablePath: CHROME,
    headless: process.env.HEADED ? false : "new",
    args: ["--font-render-hinting=none"],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  /*
    지도는 바깥 SDK(dapi.kakao.com)에 기댄다. 안 뜨는 이유가 우리 코드인지
    키·도메인인지 가르려면 응답을 봐야 한다 — `MAP_DEBUG=1` 로 켠다.
  */
  if (process.env.MAP_DEBUG) {
    page.on("response", (r) => {
      if (r.url().includes("kakao"))
        console.log(`  [map] ${r.status()} ${r.url().slice(0, 90)}`);
    });
    page.on("requestfailed", (r) => {
      if (r.url().includes("kakao"))
        console.log(`  [map] 실패 ${r.url().slice(0, 90)}`);
    });
  }

  await page.evaluateOnNewDocument(() => {
    const css = document.createElement("style");
    css.textContent =
      "nextjs-portal,#nextjs-dev-overlay,[data-nextjs-toast],[data-next-badge-root]{display:none!important}";
    const put = () => document.head && document.head.appendChild(css);
    if (document.head) put();
    else document.addEventListener("DOMContentLoaded", put);
  });
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
  /*
    `/main` 은 폰 트리와 대시보드를 **둘 다** 렌더한다(한쪽은 CSS 로 숨긴다).
    그냥 querySelector 하면 안 보이는 쪽을 눌러서, 안내 모달이 숨은 트리 안에
    떠 화면에는 아무 일도 안 일어난다. **보이는 것**만 고르는 헬퍼를 심는다.
    `evaluateOnNewDocument` 는 이미 열려 있는 문서에는 안 걸리므로 첫 goto
    **뒤, 나머지 goto 앞**에 등록한다.
  */
  await page.evaluateOnNewDocument(() => {
    window.visibleToggle = () =>
      [...document.querySelectorAll("[data-brag-toggle]")].find((n) => {
        const r = n.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }) || null;
  });
  await page.setRequestInterception(true);
  installMocks(page);
  await page.evaluate((t) => {
    localStorage.setItem("plan_auth_token", t);
    sessionStorage.setItem("plan_auth_token", t);
  }, JWT);

  let bad = 0;
  const check = (cond, msg) => {
    console.log(`${cond ? "  ok  " : "  !!  "} ${msg}`);
    if (!cond) bad += 1;
  };

  // ── 1. 폭별 캡처 ─────────────────────────────────────────────
  console.log("── 목록 ──────────────────────────────");
  for (const w of [375, 768, 1024, 1440]) {
    await page.setViewport({ width: w, height: 1000, deviceScaleFactor: 1 });
    await page.goto(`${ORIGIN}/brag`, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    await wait(1200);
    await page.screenshot({ path: path.join(OUT, `brag-${w}.png`) });

    /*
      단 수는 `columnCount` 로 읽지 않는다 — 다단은 `columns` 단축 속성이라
      계산값이 브라우저마다 다르게 나온다. **카드가 실제로 몇 개의 x 좌표에
      놓였는지**를 센다. 눈으로 보는 것과 같은 값이다.
    */
    const cols = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[class*="break-inside"]')];
      const xs = new Set(
        cards.map((n) => Math.round(n.getBoundingClientRect().x)),
      );
      return xs.size;
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    check(!overflow, `${w}px 가로 넘침 없음 (벽돌 ${cols}단)`);
  }

  // ── 2. 카드를 눌러 모달 ───────────────────────────────────────
  console.log("── 상세 모달 (M5-C) ──────────────────");
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.goto(`${ORIGIN}/brag`, {
    waitUntil: "networkidle2",
    timeout: 60000,
  });
  await wait(1200);

  const beforeUrl = page.url();
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((n) =>
      /유진 · 태호 의 플랜 보기/.test(n.getAttribute("aria-label") || ""),
    );
    btn?.click();
  });
  await wait(900);
  check(page.url() === beforeUrl, "페이지를 옮기지 않고 모달로 뜬다");
  check(seen.detail.includes("1"), "GET /plan/brag/1 을 불렀다");

  const box = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return null;
    const r = d.getBoundingClientRect();
    return {
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
    };
  });
  check(!!box, "모달이 떴다");
  if (box) {
    // 1440x1000 → 가로 여백은 clamp 하한 16, 세로는 (1000-680)/2 = 160
    check(box.x === 16 && box.w === 1440 - 32, `가로 여백 16px (w=${box.w})`);
    check(
      Math.abs(box.y - 160) <= 1 && Math.abs(box.h - 680) <= 2,
      `세로 680px, 위아래 160px 씩 (y=${box.y} h=${box.h})`,
    );
  }
  await page.screenshot({ path: path.join(OUT, "brag-modal-1440.png") });

  // ── 3. 묶음 머리 색 == 범례 색 ────────────────────────────────
  const colors = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return null;
    const bgOf = (el) => getComputedStyle(el).backgroundColor;
    /*
      모달은 예산 패널과 묶음 목록을 **웹용·폰용 두 벌** 들고 있다(한쪽은
      CSS 로 숨긴다). 그냥 세면 전부 두 배로 잡히므로 **보이는 것만** 본다.
    */
    const shown = (n) => n.offsetParent !== null;
    // 범례: 9x9 스와치가 붙은 줄
    const legend = [...dlg.querySelectorAll("span")]
      .filter((n) => /(^|\s)h-\[9px\]/.test(n.className) && shown(n))
      .map((n) => {
        const row = n.parentElement;
        return { name: row.children[1].textContent.trim(), color: bgOf(n) };
      });
    // 묶음 머리: 10x10 사각 + 이름
    const groups = [...dlg.querySelectorAll("i")]
      .filter((n) => /(^|\s)h-2\.5/.test(n.className) && shown(n))
      .map((n) => {
        /*
          **자리 순서로 읽지 않는다.** 예전에는 `children[2]`·`children[3]`
          으로 집었는데, 소계와 개수의 순서를 바꾸자 값이 서로 뒤바뀐 채로
          검사가 통과할 뻔했다. 글자 모양으로 고른다.
        */
        const head = n.parentElement;
        const texts = [...head.querySelectorAll("span")].map((v) =>
          v.textContent.trim(),
        );
        return {
          name: texts[0] ?? "",
          count: texts.find((t) => /^\d+장$/.test(t)) ?? "",
          subtotal: texts.find((t) => /만 원$/.test(t)) ?? "",
          color: bgOf(n),
        };
      });
    return { legend, groups };
  });

  if (colors) {
    const legendMap = new Map(colors.legend.map((l) => [l.name, l.color]));
    const mismatched = colors.groups.filter(
      (g) => legendMap.has(g.name) && legendMap.get(g.name) !== g.color,
    );
    check(
      colors.groups.length > 0 && mismatched.length === 0,
      `묶음 머리 색이 범례와 같다 (묶음 ${colors.groups.length}개)`,
    );
    const sdm = colors.groups.find((g) => g.name === "스드메");
    // 185 + 185 + 90 + 300 + 35(예정) = 795
    check(
      sdm && sdm.subtotal.replace(/[^0-9]/g, "") === "795",
      `소계가 지출+예정이다 (스드메 ${sdm ? sdm.subtotal : "없음"})`,
    );
    check(
      sdm && sdm.count === "5장",
      `묶음 개수 (스드메 ${sdm ? sdm.count : "?"})`,
    );
    const rest = colors.groups.find((g) => g.name === "청첩장");
    check(
      rest && !legendMap.has("청첩장"),
      "상위 4개 밖 카테고리는 범례에 없고 무채색으로 떨어진다",
    );
    check(
      legendMap.has("그 외"),
      "잘라 낸 나머지는 '그 외' 한 줄로 남는다 (막대가 짧아지지 않게)",
    );
    /*
      **색이 겹치면 이 화면의 전제가 무너진다.** 왼쪽 막대와 오른쪽 묶음을
      잇는 것이 C안의 전부인데, 다섯 번째 카테고리가 첫 번째와 같은 분홍이면
      "이 1,240만원이 이 두 장" 이 거짓말이 된다.
    */
    const legendColors = colors.legend.map((l) => l.color);
    check(
      new Set(legendColors).size === legendColors.length,
      `범례 색이 서로 겹치지 않는다 (${legendColors.length}줄)`,
    );
    console.log(
      `       ${colors.groups.map((g) => `${g.name} ${g.subtotal}`).join(" · ")}`,
    );
  } else {
    check(false, "모달 안의 색을 못 읽었다");
  }

  // ── 4. 체크는 눌리지 않는다 ───────────────────────────────────
  const checkboxes = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return null;
      const boxes = [
        ...dlg.querySelectorAll('[class*="rounded-[7px]"]'),
      ].filter((n) => n.offsetParent !== null);
    return {
      total: boxes.length,
      buttons: boxes.filter((n) => n.tagName === "BUTTON").length,
      pointer: boxes.filter((n) => getComputedStyle(n).cursor === "pointer")
        .length,
    };
  });
  check(
    checkboxes && checkboxes.total > 0 && checkboxes.buttons === 0,
    `체크가 button 이 아니다 (${checkboxes ? checkboxes.total : 0}개 중 button ${checkboxes ? checkboxes.buttons : "?"}개)`,
  );
  /*
    카드는 **누를 수 있다**(보기 전용 시트가 열린다). 커서가 바뀌는 것은
    이제 맞는 동작이라 여기서 보지 않는다 — 대신 아래에서 시트가 정말
    보기 전용인지를 본다. `체크가 button 이 아니다` 는 그대로다:
    **여는 것과 바꾸는 것은 다르다.**
  */

  // ── 4-2. 카드를 누르면 보기 전용 시트 ────────────────────────
  await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const card = [...dlg.querySelectorAll("button")].find(
      (n) => /rounded-\[18px\]/.test(n.className) && n.offsetParent !== null,
    );
    card?.click();
  });
  await wait(500);
  const planSheet = await page.evaluate(() => {
    const s = [...document.querySelectorAll('[role="dialog"]')].find((n) =>
      /자세히$/.test(n.getAttribute("aria-label") || ""),
    );
    if (!s) return null;
    return {
      text: s.innerText.replace(/\s+/g, " "),
      // 닫기 말고 다른 조작이 있으면 안 된다
      buttons: [...s.querySelectorAll("button")].map((n) =>
        (n.getAttribute("aria-label") || n.textContent || "").trim(),
      ),
      inputs: s.querySelectorAll("input,textarea,select,[role=checkbox]").length,
    };
  });
  check(!!planSheet, "카드를 누르면 시트가 열린다");
  check(
    planSheet && /남의 플랜이라 보기만/.test(planSheet.text),
    "보기 전용이라고 적혀 있다",
  );
  check(
    planSheet && /결제했어요|아직 안 냈어요/.test(planSheet.text),
    "일정 상태와 결제 상태를 따로 적는다",
  );
  check(
    planSheet && planSheet.buttons.length === 1 && planSheet.buttons[0] === "닫기",
    `바꾸는 조작이 없다 (버튼: ${planSheet ? planSheet.buttons.join(",") : "?"})`,
  );
  check(planSheet && planSheet.inputs === 0, "입력 칸이 없다");
  /*
    카드에 없던 값이 하나는 있어야 이 시트를 여는 뜻이 있다 —
    긴 날짜(요일)와 카테고리 안에서 차지하는 몫.
  */
  check(
    planSheet && /요일/.test(planSheet.text),
    "날짜가 요일까지 펴진다 (카드는 '9월 2일' 까지만)",
  );
  check(
    planSheet && /%/.test(planSheet.text),
    "이 카테고리에서 차지하는 몫이 나온다",
  );
  /*
    "180만 원 가운데 100%" 처럼 같은 말을 두 번 하는 문장이 나온 적이 있다
    (카테고리에 플랜이 하나뿐일 때). 첫 카드는 예식장 2장이라 몫이 뜻이
    있고, 아래에서 1장짜리 카테고리를 따로 본다.
  */
  check(
    planSheet && /카테고리 총/.test(planSheet.text),
    "몫을 '카테고리 총 N만 원 중 M%' 로 적는다",
  );
  check(
    planSheet && /SG 웨딩홀/.test(planSheet.text),
    "장소가 보인다 (카카오에서 고른 일정)",
  );
  const mapInfo = await page.evaluate(() => {
    const s = [...document.querySelectorAll('[role="dialog"]')].find((n) =>
      /자세히$/.test(n.getAttribute("aria-label") || ""),
    );
    if (!s) return null;
    const box = s.querySelector("#brag-plan-map");
    /*
      지도가 그려지면 SDK 가 상자 안에 자기 로고 링크(map.kakao.com)를
      끼워 넣는다. 그냥 `a[href*=map.kakao.com]` 로 찾으면 그게 먼저
      잡힌다 — **우리가 놓은 링크**를 글자로 고른다.
    */
    const link = [...s.querySelectorAll("a")].find((n) =>
      /카카오맵에서 보기/.test(n.textContent || ""),
    );
    return {
      hasBox: !!box,
      h: box ? Math.round(box.getBoundingClientRect().height) : 0,
      href: link ? link.getAttribute("href") : null,
      newTab: link ? link.getAttribute("target") === "_blank" : false,
      rel: link ? link.getAttribute("rel") : null,
    };
  });
  check(mapInfo && mapInfo.hasBox && mapInfo.h > 100, `지도 자리가 있다 (h=${mapInfo ? mapInfo.h : 0})`);
  check(
    mapInfo && /37\.5006/.test(mapInfo.href || ""),
    `카카오맵 링크에 좌표가 실린다 (${mapInfo ? String(mapInfo.href).slice(0, 60) : "없음"})`,
  );
  check(
    mapInfo && mapInfo.newTab && /noopener/.test(mapInfo.rel || ""),
    "카카오맵은 새 탭 + noopener 로 연다",
  );
  // SDK 가 실제로 타일을 그렸는지. 빈 상자로 남으면 여기서 걸린다
  await wait(2500);
  const drawn = await page.evaluate(() => {
    const box = document.getElementById("brag-plan-map");
    if (!box) return null;
    return {
      children: box.childElementCount,
      imgs: box.querySelectorAll("img").length,
    };
  });
  check(
    drawn && drawn.children > 0 && drawn.imgs > 0,
    `지도가 그려진다 (자식 ${drawn ? drawn.children : 0}개 · 타일 ${drawn ? drawn.imgs : 0}장)`,
  );
  await page.screenshot({ path: path.join(OUT, "brag-plan-sheet-1440.png") });

  /*
    장소가 없는 일정(스냅샷이 옛 범위이거나 안 고른 경우)에는 지도를 아예
    안 낸다 — "미확인" 이라고 크게 적지 않는다.
  */
  await page.keyboard.press("Escape");
  await wait(300);
  await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const card = [...dlg.querySelectorAll("button")].find(
      (n) =>
        /rounded-\[18px\]/.test(n.className) &&
        n.offsetParent !== null &&
        /본식 촬영/.test(n.innerText),
    );
    card?.click();
  });
  await wait(600);
  const noPlace = await page.evaluate(() => {
    const s = [...document.querySelectorAll('[role="dialog"]')].find((n) =>
      /자세히$/.test(n.getAttribute("aria-label") || ""),
    );
    if (!s) return null;
    return {
      text: s.innerText.replace(/\s+/g, " "),
      hasBox: !!s.querySelector("#brag-plan-map"),
    };
  });
  /*
    **빈칸으로 두지 않는다.** 지도 자리가 비어 있으면 "지도가 안 떴나" 로
    읽히는데 실제로는 그 일정에 장소가 없는 것이다. 줄도 지우면 "안 적었나"
    와 "화면이 안 그렸나" 를 구별할 수 없다.
  */
  check(
    noPlace && !noPlace.hasBox,
    "장소가 없으면 지도를 안 그린다",
  );
  check(
    noPlace && /등록하지 않았어요/.test(noPlace.text),
    "장소 줄에 '등록하지 않았어요' 라고 적는다",
  );
  check(
    noPlace && /장소를 등록하지 않은 일정이에요/.test(noPlace.text),
    "지도 자리에 플레이스홀더가 뜬다",
  );
  await page.screenshot({ path: path.join(OUT, "brag-plan-sheet-nomap.png") });

  // 장소는 적었는데 좌표가 없는 경우 — 이름은 보이고 지도는 못 그린다
  await page.keyboard.press("Escape");
  await wait(300);
  await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const card = [...dlg.querySelectorAll("button")].find(
      (n) =>
        /rounded-\[18px\]/.test(n.className) &&
        n.offsetParent !== null &&
        /드레스 피팅/.test(n.innerText),
    );
    card?.click();
  });
  await wait(600);
  const typedPlace = await page.evaluate(() => {
    const s = [...document.querySelectorAll('[role="dialog"]')].find((n) =>
      /자세히$/.test(n.getAttribute("aria-label") || ""),
    );
    if (!s) return null;
    return {
      text: s.innerText.replace(/\s+/g, " "),
      hasBox: !!s.querySelector("#brag-plan-map"),
    };
  });
  check(
    typedPlace &&
      /신사동 드레스샵/.test(typedPlace.text) &&
      !typedPlace.hasBox &&
      /지도에 표시할 수 없는 장소예요/.test(typedPlace.text),
    "손으로 적은 장소는 이름만 보이고 '지도에 표시할 수 없다' 고 적는다",
  );
  await page.screenshot({ path: path.join(OUT, "brag-plan-sheet-noplace.png") });

  /*
    좌표가 `0, 0` 인 경우. **null 과 똑같이 다뤄야 한다** — 안 그러면 기니 만
    앞바다에 마커가 찍힌 빈 지도가 그려진다.
  */
  await page.keyboard.press("Escape");
  await wait(300);
  await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const card = [...dlg.querySelectorAll("button")].find(
      (n) =>
        /rounded-\[18px\]/.test(n.className) &&
        n.offsetParent !== null &&
        /신혼여행 숙소/.test(n.innerText),
    );
    card?.click();
  });
  await wait(1200);
  const zeroCoords = await page.evaluate(() => {
    const s = [...document.querySelectorAll('[role="dialog"]')].find((n) =>
      /자세히$/.test(n.getAttribute("aria-label") || ""),
    );
    if (!s) return null;
    return {
      text: s.innerText.replace(/\s+/g, " "),
      hasBox: !!s.querySelector("#brag-plan-map"),
      hasLink: [...s.querySelectorAll("a")].some((n) =>
        /카카오맵에서 보기/.test(n.textContent || ""),
      ),
    };
  });
  check(
    zeroCoords && /씨쉘 푸꾸옥 호텔 앤 스파/.test(zeroCoords.text),
    "좌표가 0,0 이어도 장소 이름은 보인다",
  );
  check(
    zeroCoords && !zeroCoords.hasBox && !zeroCoords.hasLink,
    "좌표 0,0 에는 지도도 카카오맵 링크도 안 낸다",
  );
  check(
    zeroCoords && /지도에 표시할 수 없는 장소예요/.test(zeroCoords.text),
    "좌표 0,0 도 '지도에 표시할 수 없다' 고 적는다",
  );
  await page.screenshot({ path: path.join(OUT, "brag-plan-sheet-zero.png") });

  // 카테고리에 하나뿐이면 "가운데 100%" 대신 하나뿐이라고 적는다
  await page.keyboard.press("Escape");
  await wait(300);
  await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const card = [...dlg.querySelectorAll("button")].find(
      (n) =>
        /rounded-\[18px\]/.test(n.className) &&
        n.offsetParent !== null &&
        /예물 상담/.test(n.innerText),
    );
    card?.click();
  });
  await wait(600);
  const lonely = await page.evaluate(() => {
    const s = [...document.querySelectorAll('[role="dialog"]')].find((n) =>
      /자세히$/.test(n.getAttribute("aria-label") || ""),
    );
    return s ? s.innerText.replace(/\s+/g, " ") : null;
  });
  check(
    lonely && /하나뿐/.test(lonely) && !/100%/.test(lonely),
    `1장짜리 카테고리는 '하나뿐' 이라고 적는다 (100% 라고 안 한다)`,
  );
  await page.keyboard.press("Escape");
  await wait(300);
  await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const card = [...dlg.querySelectorAll("button")].find(
      (n) => /rounded-\[18px\]/.test(n.className) && n.offsetParent !== null,
    );
    card?.click();
  });
  await wait(600);

  // ESC 는 시트를 먼저 닫는다. 한 번에 둘 다 닫히면 보던 자리를 잃는다
  await page.keyboard.press("Escape");
  await wait(400);
  const afterEsc = await page.evaluate(() => ({
    planSheet: [...document.querySelectorAll('[role="dialog"]')].some((n) =>
      /자세히$/.test(n.getAttribute("aria-label") || ""),
    ),
    modal: !!document.querySelector('[role="dialog"]'),
  }));
  check(
    afterEsc && !afterEsc.planSheet && afterEsc.modal,
    "ESC 는 시트만 닫고 모달은 남긴다",
  );

  // ── 5. 좋아요 ────────────────────────────────────────────────
  console.log("── 좋아요 ────────────────────────────");
  const likeText = () =>
    page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]');
      const btn = dlg
        ? [...dlg.querySelectorAll("button")].find((n) =>
            /좋아요/.test(n.textContent || ""),
          )
        : null;
      return btn ? btn.textContent.replace(/\s+/g, " ").trim() : null;
    });
  const before = await likeText();
  await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const btn = [...dlg.querySelectorAll("button")].find((n) =>
      /좋아요/.test(n.textContent || ""),
    );
    btn?.click();
  });
  await wait(120);
  const during = await likeText();
  await wait(900);
  const after = await likeText();
  /*
    LIKE_FAIL 에서는 목이 지연 없이 실패로 답해서 120ms 안에 이미 되돌아와
    있다. 낙관적 갱신 자체는 정상 모드에서 확인하고, 여기서는 **되돌아오는
    것**만 본다.
  */
  if (!LIKE_FAIL)
    check(during !== before, `누르는 즉시 숫자가 바뀐다 (${before} → ${during})`);
  check(seen.like.includes("POST 1"), "POST /plan/brag/like/1 이 나갔다");
  if (LIKE_FAIL) {
    check(after === before, `실패하면 되돌아온다 (${after})`);
  } else {
    check(after === during, `응답 뒤에도 유지된다 (${after})`);
  }

  // ESC 로 닫힌다
  await page.keyboard.press("Escape");
  await wait(400);
  const closed = await page.evaluate(
    () => !document.querySelector('[role="dialog"]'),
  );
  check(closed, "ESC 로 닫힌다");

  // ── 6. 내 카드 ───────────────────────────────────────────────
  const mine = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("button")].filter((n) =>
      /김지수 · 현우 의 플랜 보기/.test(n.getAttribute("aria-label") || ""),
    );
    if (!cards.length) return null;
    const card = cards[0].closest("div[class*='rounded-[20px]']");
    return card ? card.innerText.replace(/\s+/g, " ") : null;
  });
  check(
    mine && /내 플랜/.test(mine) && /내려두기/.test(mine),
    "내 카드에는 '내 플랜' 과 '내려두기' 가 붙는다",
  );

  // ── 7. 홈의 토글 → 안내 모달 → 올리기 ─────────────────────────
  console.log("── 토글 · 안내 모달 ──────────────────");
  published = false;
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.goto(`${ORIGIN}/main`, {
    waitUntil: "networkidle2",
    timeout: 60000,
  });
  await wait(1800);

  const hasToggle = await page.evaluate(() => !!window.visibleToggle());
  check(hasToggle, "홈 예산 패널에 자랑하기 토글이 있다");

  await page.evaluate(() => window.visibleToggle()?.click());
  await wait(500);
  const sheet = await page.evaluate(() => {
    const d = [...document.querySelectorAll('[role="dialog"]')].find(
      (n) => n.getAttribute("aria-label") === "자랑하기 안내",
    );
    return d ? d.innerText.replace(/\s+/g, " ") : null;
  });
  check(!!sheet, "안내 모달이 뜬다");
  check(sheet && /목록에 올라가/.test(sheet), "규칙: 자랑하기 목록에 올라간다");
  check(
    sheet && /플랜을 고치면 같이 바뀌어요/.test(sheet),
    "규칙: 플랜을 고치면 같이 바뀐다 (스냅샷이 아니다)",
  );
  /*
    "올린 뒤에는 고칠 수 없어요" 는 **틀린 약속**이었다. 원래 규칙인
    "수정하지 못하고 볼 수만 있다" 는 보는 사람 이야기인데, 그걸 올린
    사람까지 묶는 것으로 잘못 읽어 안내 모달에 박아 넣었다. 되살아나면
    여기서 걸린다.
  */
  check(
    sheet && !/고칠 수 없어요/.test(sheet),
    "'올린 뒤에는 고칠 수 없어요' 가 되살아나지 않았다",
  );
  check(sheet && /보기와 좋아요만/.test(sheet), "규칙: 보기와 좋아요만");
  /*
    공개 목록은 **글자 그대로**여야 한다. M5-C 는 일정별 금액까지 내므로
    이 문구가 빠지면 동의받은 것과 보이는 것이 어긋난다.
  */
  check(
    sheet && /일정별 금액/.test(sheet),
    "공개 목록에 '일정별 금액' 이 있다",
  );
  check(
    sheet && /카테고리별 지출과 소계/.test(sheet),
    "공개 목록에 '카테고리별 지출과 소계' 가 있다",
  );
  check(
    sheet && !/일부 정보|등을 포함/.test(sheet),
    "'일부 정보' 같은 두루뭉술한 말을 안 쓴다",
  );
  await page.screenshot({ path: path.join(OUT, "brag-sheet-1440.png") });

  await page.evaluate(() => {
    const d = [...document.querySelectorAll('[role="dialog"]')].find(
      (n) => n.getAttribute("aria-label") === "자랑하기 안내",
    );
    const btn = [...(d ? d.querySelectorAll("button") : [])].find((n) =>
      /자랑하기에 올리기/.test(n.textContent || ""),
    );
    btn?.click();
  });
  await wait(900);
  check(seen.publish.includes("PUT"), "PUT /plan/brag 가 나갔다");
  const live = await page.evaluate(() => {
    const t = window.visibleToggle();
    if (!t) return null;
    return {
      on: t.getAttribute("aria-checked"),
      row: t.parentElement.innerText.replace(/\s+/g, " "),
    };
  });
  check(live && live.on === "true", "토글이 켜졌다");
  check(live && /보러 가기/.test(live.row), "폰에서 목록으로 갈 문이 생겼다");

  // 폰에서도 토글이 있는지 (모바일 트리는 별도 DOM 이다)
  await page.setViewport({ width: 375, height: 760, deviceScaleFactor: 1 });
  await page.goto(`${ORIGIN}/main`, {
    waitUntil: "networkidle2",
    timeout: 60000,
  });
  await wait(1800);
  const phoneToggle = await page.evaluate(() => {
    const t = window.visibleToggle();
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return { w: Math.round(r.width), visible: r.width > 0 && r.height > 0 };
  });
  check(
    phoneToggle && phoneToggle.visible,
    `폰(375)에도 토글이 있다 (w=${phoneToggle ? phoneToggle.w : 0})`,
  );

  // 폰 모달
  await page.goto(`${ORIGIN}/brag`, {
    waitUntil: "networkidle2",
    timeout: 60000,
  });
  await wait(1200);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((n) =>
      /유진 · 태호 의 플랜 보기/.test(n.getAttribute("aria-label") || ""),
    );
    btn?.click();
  });
  await wait(1000);
  await page.screenshot({ path: path.join(OUT, "brag-modal-375.png") });
  // 폰에서도 카드를 눌러 시트를 본다 (375 에서 넘치면 안 된다)
  await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const card = [...dlg.querySelectorAll("button")].find(
      (n) => /rounded-\[18px\]/.test(n.className) && n.offsetParent !== null,
    );
    card?.click();
  });
  await wait(700);
  await page.screenshot({ path: path.join(OUT, "brag-plan-sheet-375.png") });
  const sheetBox = await page.evaluate(() => {
    const s = [...document.querySelectorAll('[role="dialog"]')].find((n) =>
      /자세히$/.test(n.getAttribute("aria-label") || ""),
    );
    if (!s) return null;
    const r = s.getBoundingClientRect();
    return {
      w: Math.round(r.width),
      inView: r.left >= 0 && r.right <= window.innerWidth && r.top >= 0,
    };
  });
  check(
    sheetBox && sheetBox.inView,
    `폰에서 시트가 화면 안에 들어온다 (w=${sheetBox ? sheetBox.w : 0})`,
  );
  const phoneBox = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return null;
    const r = d.getBoundingClientRect();
    return {
      x: Math.round(r.x),
      w: Math.round(r.width),
      h: Math.round(r.height),
    };
  });
  check(
    phoneBox && phoneBox.x === 16 && phoneBox.w === 375 - 32,
    `폰에서도 여백 16px (w=${phoneBox ? phoneBox.w : 0})`,
  );

  console.log("──────────────────────────────────────");
  if (errors.length) {
    console.log("JS 오류:");
    errors.forEach((e) => console.log(`  ${e}`));
    bad += errors.length;
  }
  console.log(bad === 0 ? "자랑하기 이상 없음" : `문제 ${bad}건`);
  console.log(`캡처: ${OUT}`);
  await browser.close();
  process.exit(bad === 0 ? 0 : 1);
})();
