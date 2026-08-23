/*
 * /feed 의 폭별 레이아웃과 동작을 확인한다.
 *
 * 확인하는 것:
 *   1. 375 / 768 / 1024 / 1440 캡처 (<900px 컨테이너에서는 사이드 대신 한 줄 띠)
 *   2. 카테고리 칩을 누르면 category 쿼리를 붙여 다시 받는지
 *   3. "도움이 돼요" 를 누르면 POST /plan/feed/{id}/vote 가 나가고 숫자가
 *      바뀌는지, "안 돼요" 로 바꾸면 표가 뒤집히며 돼요 수가 줄어드는지,
 *      같은 값을 다시 누르면 DELETE 가 나가는지
 *   4. **"도움이 안 돼요" 수가 화면에 새지 않는지**
 *   5. "내 플랜에 담기" 가 /add-plen 으로 값을 채워 넘기는지
 *   6. 비공개 금액(amount 필드 없음)이 "금액 비공개" 로 보이는지
 *   7. FAIL_POSTABLE=1 이면 "올릴 수 있는 일정" 이 실패했을 때
 *      "없음" 이 아니라 실패 안내가 뜨는지
 *
 * 준비:  npm run dev / npm install --no-save puppeteer-core
 * 실행:  node scripts/feed.cjs                    (정상)
 *        FAIL_POSTABLE=1 node scripts/feed.cjs    (목록 실패)
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

const CATEGORIES = ["스드메", "웨딩홀", "예물 · 예단", "신혼여행", "청첩장"];

/**
 * 실제 응답과 같은 모양이어야 한다.
 *
 * - 익명이라 planUserId 가 없다
 * - 비공개 금액은 **필드 자체가 없다** (null 0 이 아니다).
 *   목을 실제보다 관대하게 만들면 "금액 비공개" 분기를 영영 못 본다.
 * - notHelpfulCount 는 **응답에 없다**. 있으면 화면이 실수로 그린다.
 * - address/placeId/lat/lng 는 카카오 장소를 고른 후기에만 있다.
 *   전부 채워 두면 "장소 없는 후기" 분기를 영영 못 본다.
 */
const POSTS = [
  {
    id: 1,
    categoryName: "웨딩홀",
    title: "SG 웨딩홀",
    amount: 1111,
    isAmountPublic: true,
    region: "서울 강남구",
    address: "서울 강남구 테헤란로 152",
    placeId: "26338954",
    lat: 37.5006,
    lng: 127.0364,
    rating: 4,
    body: "하객 200명 기준 식대 포함. 주차가 넉넉해요.",
    authorDDay: 131,
    authorRole: "BRIDE",
    helpfulCount: 24,
    myVote: null,
    isMine: false,
    createDate: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 2,
    categoryName: "스드메",
    title: "아뜰리에 진",
    amount: 385,
    isAmountPublic: true,
    region: "서울 강남구",
    address: "서울 강남구 도산대로 430",
    placeId: "11223344",
    lat: 37.5223,
    lng: 127.0388,
    rating: 5,
    body: "드레스 3벌 + 본식 스냅. 헬퍼비 25만원은 따로였습니다.",
    authorDDay: 88,
    authorRole: "GROOM",
    helpfulCount: 61,
    myVote: "HELPFUL",
    isMine: false,
    createDate: new Date(Date.now() - 9 * 86400000).toISOString(),
  },
  {
    // 비공개 금액 — amount 키가 아예 없다
    id: 3,
    categoryName: "예물 · 예단",
    title: "종로 3가 귀금속",
    isAmountPublic: false,
    region: null,
    address: null,
    placeId: null,
    lat: null,
    lng: null,
    rating: 3,
    body: "가격은 밝히기 어렵지만 세 군데 비교하고 가면 다릅니다.",
    authorDDay: -12,
    authorRole: "UNKNOWN",
    helpfulCount: 8,
    myVote: null,
    isMine: true,
    createDate: new Date(Date.now() - 40 * 86400000).toISOString(),
  },
];

const POSTABLE = [
  {
    scheduleId: 17,
    categoryName: "스드메",
    title: "본식 촬영",
    amount: 185,
    location: "아뜰리에 진",
    locationLat: 37.5223,
    locationLng: 127.0388,
    startDate: "2026-07-01",
  },
];

/** 하네스가 잡아 둔 요청 기록 */
const seen = { list: [], vote: [] };

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
    const query = url.slice(API.length).split("?")[1] ?? "";

    if (p0.startsWith("/socket.io")) {
      req.respond({ status: 404, headers: CORS, body: "" }).catch(() => {});
      return;
    }
    if (/^\/plan\/notification\//.test(p0)) {
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
            name: "김지수",
            budget: 4200,
            weddingDate: "2026-11-14",
            roomId: 1,
            hasSeenChatGuide: true,
            chatRooms: [],
          }),
        )
        .catch(() => {});
      return;
    }

    // 실제 앱은 토큰이 있으면 /user/list, 방이면 /room/{id}/list 로 간다.
    // 하나만 목으로 두면 등록 폼의 카테고리 목록이 빈 채로 남는다.
    if (/^\/plan\/category\/(list|user\/list|room\/\d+\/list)$/.test(p0)) {
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

    if (p0 === "/plan/feed/list") {
      const params = new URLSearchParams(query);
      seen.list.push({
        category: params.get("category"),
        sort: params.get("sort"),
        page: params.get("page"),
      });
      const category = params.get("category");
      const list = category
        ? POSTS.filter((post) => post.categoryName === category)
        : POSTS;
      req.respond(ok({ list, total: list.length })).catch(() => {});
      return;
    }

    if (p0 === "/plan/feed/my/status") {
      req
        .respond(
          ok({
            postCount: 2,
            receivedHelpfulCount: 17,
            postableScheduleCount: POSTABLE.length,
          }),
        )
        .catch(() => {});
      return;
    }

    if (p0 === "/plan/feed/postable") {
      // FAIL_POSTABLE=1 이면 서버가 죽은 상황을 흉내 낸다.
      // "없음" 과 "못 불러옴" 이 같은 화면으로 보이던 버그가 있었다.
      if (process.env.FAIL_POSTABLE) {
        req
          .respond({
            status: 500,
            headers: CORS,
            contentType: "application/json",
            body: "{}",
          })
          .catch(() => {});
        return;
      }
      req
        .respond(ok({ list: POSTABLE, total: POSTABLE.length }))
        .catch(() => {});
      return;
    }

    const vote = p0.match(/^\/plan\/feed\/(\d+)\/vote$/);
    if (vote) {
      const id = Number(vote[1]);
      const post = POSTS.find((x) => x.id === id);
      // 실제 서버와 같은 규칙으로 센다. 목이 관대하면 화면 버그를 못 잡는다.
      const value =
        method === "POST" ? JSON.parse(req.postData() || "{}").value : null;
      seen.vote.push({ id, method, value });
      if (post) {
        const was = post.myVote;
        post.myVote = value;
        post.helpfulCount +=
          (value === "HELPFUL" ? 1 : 0) - (was === "HELPFUL" ? 1 : 0);
      }
      req
        .respond(
          ok({
            myVote: post ? post.myVote : null,
            helpfulCount: post ? post.helpfulCount : 0,
          }),
        )
        .catch(() => {});
      return;
    }

    if (p0 === "/plan/feed" && method === "POST") {
      req.respond(ok({ ...POSTS[0], id: 99 })).catch(() => {});
      return;
    }

    req.respond(ok({ list: [], total: 0 })).catch(() => {});
  });
}

/** 여러 줄 텍스트를 한 줄 로그로 */
const flat = (text) =>
  String(text ?? "")
    .split("\n")
    .join(" | ");

const cardTexts = (page) =>
  page.$$eval("article", (nodes) => nodes.map((n) => n.innerText));

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

  // ── 1. 폭별 캡처 ─────────────────────────────────────────────
  for (const w of [375, 768, 1024, 1440]) {
    await page.setViewport({ width: w, height: 1000, deviceScaleFactor: 1 });
    await page.goto(`${ORIGIN}/feed`, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    await wait(1600);
    await page.screenshot({ path: path.join(OUT, `feed-${w}.png`) });

    const layout = await page.evaluate(() => {
      const list = document.querySelector("article");
      const side = [...document.querySelectorAll("p")].find(
        (n) => n.textContent.trim() === "내 후기",
      );
      if (!list) return "목록없음";
      // 좁을 때는 사이드 카드를 아예 감춘다(한 줄 띠가 대신한다).
      // 숨은 요소의 rect 는 0 이라 top 비교만으로는 구분되지 않는다.
      if (!side || side.getBoundingClientRect().width === 0) {
        const strip = [...document.querySelectorAll("button")].find((b) =>
          b.textContent.includes("아직 안 올렸어요"),
        );
        return strip ? "1열(공급 띠 한 줄)" : "1열(띠 없음)";
      }
      const a = list.getBoundingClientRect();
      const b = side.getBoundingClientRect();
      return Math.abs(a.top - b.top) < 80 ? "2열" : "1열(사이드가 위)";
    });
    console.log(`캡처 feed-${w}.png   ${layout}`);
  }

  // ── 2. 비공개 금액 · 익명 표시 ───────────────────────────────
  const texts = await cardTexts(page);
  console.log(
    `  비공개 금액 카드  ${
      texts.some((t) => t.includes("금액 비공개")) ? "정상" : "안 보임"
    }`,
  );
  console.log(
    `  익명 표시  ${
      texts.some((t) => t.includes("D-131 신부")) ? "정상" : "안 보임"
    }`,
  );

  const placeInfo = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("article")];
    return cards.map((c) => ({
      addr:
        c
          .querySelector("svg.lucide-map-pin")
          ?.parentElement?.innerText.trim() ?? null,
      map: [...c.querySelectorAll("a")].some((a) =>
        a.textContent.includes("카카오맵"),
      ),
    }));
  });
  console.log(`  장소 줄  ${JSON.stringify(placeInfo)}`);

  // ── 3. 카테고리 칩 ───────────────────────────────────────────
  seen.list.length = 0;
  await page.evaluate(() => {
    const chip = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "스드메",
    );
    chip?.click();
  });
  await wait(1200);
  const afterChip = await cardTexts(page);
  console.log(
    `  카테고리 칩(스드메)  요청=${JSON.stringify(
      seen.list.map((x) => x.category),
    )}  카드=${afterChip.length}장`,
  );

  await page.evaluate(() => {
    const chip = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "전체",
    );
    chip?.click();
  });
  await wait(1200);

  // ── 4. 도움이 돼요 / 안 돼요 ────────────────────────────────
  seen.vote.length = 0;
  const voteBefore = await page.evaluate(() => {
    const btn = document.querySelector(
      'article button[aria-label="도움이 돼요"]',
    );
    const n = btn?.innerText.trim();
    btn?.click();
    return n;
  });
  await wait(1000);
  const voteAfter = await page.evaluate(() => {
    const btn = document.querySelector(
      'article button[aria-label="도움이 돼요"]',
    );
    return {
      text: btn?.innerText.trim(),
      pressed: btn?.getAttribute("aria-pressed"),
    };
  });
  console.log(
    `  도움이 돼요  "${flat(voteBefore)}" → "${flat(voteAfter.text)}" (pressed=${
      voteAfter.pressed
    })  요청=${JSON.stringify(seen.vote)}`,
  );

  // 안 돼요로 바꾸면 표가 뒤집히고 돼요 수가 줄어야 한다
  seen.vote.length = 0;
  await page.evaluate(() => {
    document
      .querySelector('article button[aria-label="도움이 안 돼요"]')
      ?.click();
  });
  await wait(1000);
  const flipped = await page.evaluate(() => {
    const up = document.querySelector(
      'article button[aria-label="도움이 돼요"]',
    );
    const down = document.querySelector(
      'article button[aria-label="도움이 안 돼요"]',
    );
    return {
      up: up?.innerText.trim(),
      upPressed: up?.getAttribute("aria-pressed"),
      downPressed: down?.getAttribute("aria-pressed"),
    };
  });
  console.log(
    `  안 돼요로 전환  돼요="${flat(flipped.up)}"(pressed=${
      flipped.upPressed
    }) 안돼요pressed=${flipped.downPressed}  요청=${JSON.stringify(seen.vote)}`,
  );

  // 같은 값을 다시 누르면 취소(DELETE)
  seen.vote.length = 0;
  await page.evaluate(() => {
    document
      .querySelector('article button[aria-label="도움이 안 돼요"]')
      ?.click();
  });
  await wait(1000);
  console.log(`  같은 값 재클릭(취소)  요청=${JSON.stringify(seen.vote)}`);

  // 안 돼요 수는 응답에도 화면에도 없어야 한다
  const downHasNumber = await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        'article button[aria-label="도움이 안 돼요"]',
      ),
    ]
      .map((b) => b.innerText.trim())
      .some((t) => /\d/.test(t)),
  );
  console.log(
    `  안 돼요 수 노출  ${downHasNumber ? "노출됨 (문제)" : "감춰짐 (정상)"}`,
  );

  // ── 5. 내 플랜에 담기 ────────────────────────────────────────
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("article button")].find((b) =>
      b.textContent.includes("내 플랜에 담기"),
    );
    btn?.click();
  });
  await wait(1800);
  const url = new URL(page.url());
  console.log(
    `  담기 → ${url.pathname}  title=${url.searchParams.get(
      "title",
    )}  category=${url.searchParams.get(
      "category",
    )}  amount=${url.searchParams.get("amount")}`,
  );

  // 등록 폼은 단계형이라 결제 유형을 고르기 전에는 금액·장소 칸이 없다.
  // 값은 이미 state 에 들어가 있고, 칸이 뜨는 순간 채워져 보인다.
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "카드",
    );
    btn?.click();
  });
  await wait(1200);
  const filled = await page.evaluate(() =>
    [...document.querySelectorAll("input")].map((i) => i.value).filter(Boolean),
  );
  console.log(`  등록 폼에 채워진 값  ${JSON.stringify(filled)}`);

  // ── 6. 올릴 수 있는 일정 ─────────────────────────────────────
  await page.goto(`${ORIGIN}/feed`, {
    waitUntil: "networkidle2",
    timeout: 60000,
  });
  await wait(1500);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent.includes("올릴 수 있는 일정 보기"),
    );
    btn?.click();
  });
  await wait(1000);

  if (process.env.FAIL_POSTABLE) {
    const failText = await page.evaluate(() => {
      const dialog = document.querySelector('[aria-label="올릴 수 있는 일정"]');
      return dialog ? dialog.innerText : "안 열림";
    });
    await page.screenshot({ path: path.join(OUT, "feed-postable-fail.png") });
    console.log("캡처 feed-postable-fail.png");
    console.log(`  목록 실패 안내  ${flat(failText)}`);
    await browser.close();
    return;
  }

  await page.evaluate(() => {
    const row = [...document.querySelectorAll("button")].find((b) =>
      b.textContent.includes("본식 촬영"),
    );
    row?.click();
  });
  await wait(800);
  await page.screenshot({ path: path.join(OUT, "feed-post-modal.png") });
  const modal = await page.evaluate(() => {
    const dialog = document.querySelector('[aria-label="후기 올리기"]');
    return dialog ? dialog.innerText : "안 열림";
  });
  console.log("캡처 feed-post-modal.png");
  console.log(`  후기 올리기 모달  ${flat(modal).slice(0, 120)}`);
  const placePicker = await page.evaluate(() => {
    const input = document.querySelector(
      '[aria-label="후기 올리기"] input[placeholder="업체 이름으로 검색"]',
    );
    return input ? input.value : "없음";
  });
  console.log(`  업체 검색칸 기본값  "${placePicker}"`);

  await browser.close();
})().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
