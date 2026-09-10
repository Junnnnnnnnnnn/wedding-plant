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
}));

/**
 * 상위 4개만 색이 붙는다(`STACK_COLORS`). **청첩장·혼수는 일부러 빼 둔다** —
 * 색이 없는 묶음(무채색)으로 떨어지는 분기를 봐야 한다.
 */
const CATEGORY_CHART = [
  { categoryName: "예식장", usedAmount: 1240 },
  { categoryName: "스드메", usedAmount: 760 },
  { categoryName: "예물 · 예단", usedAmount: 480 },
  { categoryName: "신혼여행", usedAmount: 240 },
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
    // 범례: 9x9 스와치가 붙은 줄
    const legend = [...dlg.querySelectorAll("span")]
      .filter((n) => /(^|\s)h-\[9px\]/.test(n.className))
      .map((n) => {
        const row = n.parentElement;
        return { name: row.children[1].textContent.trim(), color: bgOf(n) };
      });
    // 묶음 머리: 10x10 사각 + 이름
    const groups = [...dlg.querySelectorAll("i")]
      .filter((n) => /(^|\s)h-2\.5/.test(n.className))
      .map((n) => {
        const head = n.parentElement;
        return {
          name: head.children[1].textContent.trim(),
          count: head.children[2].textContent.trim(),
          subtotal: head.children[3].textContent.trim(),
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
    const boxes = [...dlg.querySelectorAll('[class*="rounded-[7px]"]')];
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
  check(checkboxes && checkboxes.pointer === 0, "체크 위에서 커서가 안 바뀐다");

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
  check(sheet && /고칠 수 없어요/.test(sheet), "규칙: 고칠 수 없다");
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
