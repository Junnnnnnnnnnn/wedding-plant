/*
 * /calendar 의 보드 뷰를 확인한다.
 *
 * 확인하는 것:
 *   1. 375 캡처 — 기존 캘린더 그대로여야 한다 (보드는 ≥768 전용)
 *   2. 768 / 1024 / 1280 — 보드 컬럼이 달별로 나뉘는지, 인스펙터가 붙는지
 *   3. 보드 ↔ 캘린더 전환
 *   4. 카드 클릭 → 인스펙터에 상세가 뜨는지
 *   5. 완료 체크 → PATCH /plan/schedule/status/{id}
 *   6. 다른 달 컬럼으로 드래그 → PATCH /plan/schedule/{id} { startDate }
 *      (마우스 이벤트에서 합성되는 pointer 이벤트로 재현)
 *
 * 준비:  npm run dev / npm install --no-save puppeteer-core
 * 실행:  node scripts/plan-board.cjs
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

const SCHEDULES = [
  {
    id: 1,
    categoryName: "스드메",
    title: "드레스 투어",
    amount: null,
    startDate: "2026-08-23",
    startTime: "11:00",
    status: "NORMAL",
  },
  {
    id: 2,
    categoryName: "예식장",
    title: "예식장 2차 미팅",
    amount: null,
    startDate: "2026-08-29",
    status: "NORMAL",
  },
  {
    id: 3,
    categoryName: "예식장",
    title: "웨딩홀 계약금",
    amount: 620,
    startDate: "2026-08-02",
    startTime: "15:00",
    status: "COMPLETED",
  },
  {
    id: 7,
    categoryName: "상견례",
    title: "양가 상견례 식사",
    amount: 45,
    startDate: "2026-08-09",
    status: "COMPLETED",
  },
  {
    id: 4,
    categoryName: "스드메",
    title: "본식 촬영",
    amount: 185,
    startDate: "2026-09-12",
    status: "NORMAL",
  },
  {
    id: 5,
    categoryName: "예물",
    title: "예물 상담",
    amount: null,
    startDate: "2026-09-27",
    status: "NORMAL",
  },
  {
    id: 6,
    categoryName: "청첩장",
    title: "청첩장 발송",
    amount: null,
    startDate: "2026-10-10",
    status: "NORMAL",
  },
  {
    id: 7,
    categoryName: "한복",
    title: "한복 맞춤",
    amount: 120,
    startDate: "2026-10-17",
    status: "NORMAL",
  },
  {
    id: 8,
    categoryName: "예식장",
    title: "본식 리허설",
    amount: null,
    startDate: "2026-11-12",
    status: "NORMAL",
  },
  {
    id: 9,
    categoryName: "기타",
    title: "날짜 못 정한 일",
    amount: null,
    startDate: null,
    status: "NORMAL",
  },
];

/** 이 하네스가 관찰한 쓰기 요청 */
const writes = [];

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

    // 완료 토글
    const statusMatch = p0.match(/^\/plan\/schedule\/status\/(\d+)$/);
    if (statusMatch && method === "PATCH") {
      writes.push({
        kind: "status",
        id: Number(statusMatch[1]),
        body: req.postData(),
      });
      req.respond(ok({})).catch(() => {});
      return;
    }

    // 날짜 이동 (부분 수정)
    const patchMatch = p0.match(/^\/plan\/schedule\/(\d+)$/);
    if (patchMatch && method === "PATCH") {
      writes.push({
        kind: "date",
        id: Number(patchMatch[1]),
        body: req.postData(),
      });
      req.respond(ok({})).catch(() => {});
      return;
    }

    // 상세 (인스펙터)
    if (patchMatch && method === "GET") {
      const item = SCHEDULES.find((s) => s.id === Number(patchMatch[1]));
      req
        .respond(
          ok({
            id: item ? item.id : 0,
            title: item ? item.title : "",
            categoryName: item ? item.categoryName : "",
            // 상세 API 의 amount 는 만원 단위다 (화면이 "만 원"을 붙인다)
            amount: item && item.amount ? item.amount : 0,
            startDate: item ? item.startDate : null,
            payType: "CARD",
            location: "서울 강남구 논현로 842",
            locationLat: 37.51,
            locationLng: 127.02,
            memo: "원본 전체 포함 가격. 앨범은 나중에.",
            status: item ? item.status : "NORMAL",
            addCategoryNameList: [],
          }),
        )
        .catch(() => {});
      return;
    }

    if (p0 === "/plan/category/user/list" || p0 === "/plan/category/list") {
      req
        .respond(
          ok({
            list: ["스드메", "예식장", "예물", "상견례"].map((name, i) => ({
              id: i + 1,
              name,
              color: "#ee2b8c",
              type: "SYSTEM",
            })),
            total: 4,
          }),
        )
        .catch(() => {});
      return;
    }
    if (p0 === "/plan/schedule/list") {
      // 실제 API 와 같은 필터를 건다. 목이 더 관대하면 "status 없이 부르면
      // 완료가 빠진다" 같은 버그를 하네스가 못 잡는다 (실제로 못 잡았다).
      const status = new URL(url).searchParams.get("status");
      const list = SCHEDULES.filter(
        (s) => s.status !== "DELETE" && (!status || s.status === status),
      );
      req.respond(ok({ list, total: list.length })).catch(() => {});
      return;
    }
    if (p0 === "/plan/schedule/calendar") {
      const byDay = {};
      SCHEDULES.forEach((s) => {
        if (!s.startDate) return;
        if (!byDay[s.startDate]) byDay[s.startDate] = [];
        byDay[s.startDate].push({
          id: s.id,
          title: s.title,
          categoryName: s.categoryName,
          amount: s.amount,
          startTime: s.startTime ?? null,
          status: s.status,
        });
      });
      req
        .respond(
          ok({
            list: Object.keys(byDay).map((day) => ({ day, list: byDay[day] })),
          }),
        )
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
            chatRooms: [],
          }),
        )
        .catch(() => {});
      return;
    }

    req.respond(ok({ list: [], total: 0 })).catch(() => {});
  });
}

const boxOf = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width };
  }, sel);

(async () => {
  const browser = await p.launch({
    executablePath: CHROME,
    headless: process.env.HEADED ? false : "new",
    args: ["--font-render-hinting=none"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });

  await page.goto(`${ORIGIN}/calendar`, {
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
      if (String(url).includes(host)) throw new Error("harness: ws blocked");
      return new Native(url, protocols);
    }
    Blocked.prototype = Native.prototype;
    window.WebSocket = Blocked;
  }, "api.seoulmoment.com.tw");

  await page.setRequestInterception(true);
  installMocks(page);

  // ── 1. 폭별 캡처 ──────────────────────────────────────────────
  for (const w of [375, 768, 1024, 1280, 1440]) {
    await page.setViewport({ width: w, height: 900, deviceScaleFactor: 1.5 });
    await page.goto(`${ORIGIN}/calendar`, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    await wait(1800);
    await page.screenshot({ path: path.join(OUT, `board-${w}.png`) });
    const cols = await page.evaluate(() =>
      [...document.querySelectorAll("[data-board-column]")].map((c) =>
        c.getAttribute("data-board-column"),
      ),
    );
    console.log(`캡처 board-${w}.png   컬럼=${JSON.stringify(cols)}`);
  }

  // ── 2. 캘린더 전환 ────────────────────────────────────────────
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1.5 });
  await page.goto(`${ORIGIN}/calendar`, {
    waitUntil: "networkidle2",
    timeout: 60000,
  });
  await wait(1600);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => x.innerText.trim() === "캘린더",
    );
    if (b) b.click();
  });
  await wait(900);
  await page.screenshot({ path: path.join(OUT, "board-1280-calendar.png") });
  const monthSummary = await page.evaluate(
    () =>
      [...document.querySelectorAll("span")]
        .map((x) => x.innerText.trim())
        .find((t) => t.startsWith("이번 달 지출")) ?? "(없음)",
  );
  console.log(`캡처 board-1280-calendar.png   ${monthSummary}`);

  // 완료한 날을 눌러 금액이 목록에 뜨는지 본다 ("얼마를 왜 썼는지")
  await page.evaluate(() => {
    const cell = [...document.querySelectorAll("div")].find((d) =>
      d.className?.includes?.("min-h-[100px]") &&
      d.innerText.includes("웨딩홀"),
    );
    if (cell) cell.click();
  });
  await wait(700);
  await page.screenshot({ path: path.join(OUT, "board-1280-day.png") });
  const dayText = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.innerText.includes("웨딩홀"),
    );
    return btn ? btn.innerText.replace(/\s+/g, " ").trim() : "(없음)";
  });
  console.log(`캡처 board-1280-day.png   ${dayText}`);
  // 모달 하단의 "확인" 으로 닫는다. 헤더의 aria-label="닫기" 를 쓰면
  // 캘린더 헤더의 X 까지 잡혀 /main 으로 나가 버린다.
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => x.innerText.trim() === "확인",
    );
    if (b) b.click();
  });
  await wait(600);

  // 보드의 "+ 플랜 추가" → 우측 등록 pane
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => x.innerText.trim() === "보드",
    );
    if (b) b.click();
  });
  await wait(900);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => x.innerText.trim() === "+ 플랜 추가",
    );
    if (b) b.click();
  });
  await wait(1400);
  // 제목·카테고리를 채워 폼이 다 펼쳐진 모습을 본다
  await page.evaluate(() => {
    const input = document.querySelector(
      'input[placeholder="어떤 지출인가요?"]',
    );
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    setter.call(input, "드레스 투어");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await wait(1100);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => x.innerText.trim() === "카테고리 선택",
    );
    if (b) b.click();
  });
  await wait(800);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      ["스드메", "예식장", "예물", "기타"].includes(x.innerText.trim()),
    );
    if (b) b.click();
  });
  await wait(900);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => x.innerText.trim() === "카드",
    );
    if (b) b.click();
  });
  await wait(1100);
  await page.screenshot({ path: path.join(OUT, "board-1440-addpane.png") });
  // 저장 버튼까지 닿는지 — pane 아래로 끝까지 굴려 본다
  const saveInfo = await page.evaluate(() => {
    const title = [...document.querySelectorAll("b")].find(
      (x) => x.innerText.trim() === "플랜 추가",
    );
    const pane = title?.closest("div")?.parentElement;
    const scroller = pane?.querySelector("main");
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
    const btn = [...document.querySelectorAll("button")].find((b) =>
      /등록|저장|수정/.test(b.innerText.trim()),
    );
    return {
      스크롤: scroller ? `${scroller.scrollHeight}px` : "-",
      저장버튼: btn ? btn.innerText.trim() : "없음",
    };
  });
  await wait(600);
  await page.screenshot({ path: path.join(OUT, "board-1440-addpane-end.png") });
  console.log(
    `캡처 board-1440-addpane-end.png   폼높이=${saveInfo.스크롤} 저장버튼=${saveInfo.저장버튼}`,
  );
  const addPane = await page.evaluate(() => {
    const title = [...document.querySelectorAll("b")].find(
      (x) => x.innerText.trim() === "플랜 추가",
    );
    const box = title?.closest("div")?.parentElement?.getBoundingClientRect();
    return {
      열림: !!title,
      제목입력: !!document.querySelector('input[placeholder="어떤 지출인가요?"]'),
      라우트: location.pathname,
      좌표: box ? `x=${Math.round(box.x)} w=${Math.round(box.width)}` : "-",
    };
  });
  console.log(
    `캡처 board-1440-addpane.png   pane=${addPane.열림 ? "열림" : "안열림"} 제목칸=${addPane.제목입력 ? "있음" : "없음"} 라우트=${addPane.라우트} ${addPane.좌표}`,
  );
  // 닫고 원상복구. aria-label="닫기" 는 캘린더 헤더의 X 도 잡아
  // /main 으로 나가 버리므로, 반드시 pane 머리글 안에서만 찾는다.
  const closed = await page.evaluate(() => {
    const title = [...document.querySelectorAll("b")].find(
      (x) => x.innerText.trim() === "플랜 추가",
    );
    const btn = title?.parentElement?.querySelector('[aria-label="닫기"]');
    if (!btn) return false;
    btn.click();
    return true;
  });
  await wait(800);
  const afterClose = await page.evaluate(() => ({
    pane: !![...document.querySelectorAll("b")].find(
      (x) => x.innerText.trim() === "플랜 추가",
    ),
    라우트: location.pathname,
  }));
  console.log(
    `등록 pane 닫기 → ${closed ? "눌림" : "버튼 못찾음"} pane=${afterClose.pane ? "아직열림(문제)" : "닫힘"} 라우트=${afterClose.라우트}`,
  );

  // 보드로 복귀
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => x.innerText.trim() === "보드",
    );
    if (b) b.click();
  });
  await wait(900);

  // ── 3. 카드 클릭 → 인스펙터 ───────────────────────────────────
  await page.evaluate(() => {
    const card = [
      ...document.querySelectorAll("[data-board-column] [role='button']"),
    ].find((c) => c.innerText.includes("본식 촬영"));
    if (card) card.click();
  });
  await wait(2000);
  const inspector = await page.evaluate(() => ({
    hasTitle: document.body.innerText.includes("본식 촬영"),
    hasMemo: document.body.innerText.includes("원본 전체 포함 가격"),
  }));
  await page.screenshot({ path: path.join(OUT, "board-1280-inspector.png") });
  console.log(
    `캡처 board-1280-inspector.png   제목=${inspector.hasTitle ? "보임" : "안보임"} 메모=${inspector.hasMemo ? "보임" : "안보임"}`,
  );

  // ── 4. 완료 토글 ──────────────────────────────────────────────
  writes.length = 0;
  await page.evaluate(() => {
    const card = [
      ...document.querySelectorAll("[data-board-column] [role='button']"),
    ].find((c) => c.innerText.includes("드레스 투어"));
    const tick = card && card.querySelector("[role='checkbox']");
    if (tick) tick.click();
  });
  await wait(1200);
  const statusWrite = writes.find((w) => w.kind === "status");
  console.log(
    `완료 토글 → ${statusWrite ? `PATCH status/${statusWrite.id} ${statusWrite.body}` : "요청 없음 (문제)"}`,
  );

  // ── 5. 드래그로 달 이동 ───────────────────────────────────────
  // 인스펙터를 닫아 보드가 넓은 상태에서 끈다. 열려 있으면 오른쪽 컬럼이
  // 패널에 가려서, 그 좌표로 마우스를 내려도 카드가 아니라 패널이 잡힌다.
  await page.evaluate(() => {
    // aria-label="닫기" 는 캘린더 헤더의 X 와도 겹친다. 그걸 누르면 /main 으로
    // 나가버리므로, "플랜 상세" 헤더를 가진 인스펙터 안의 버튼만 고른다.
    const header = [...document.querySelectorAll("div")].find(
      (d) =>
        d.children.length === 2 &&
        d.firstElementChild &&
        d.firstElementChild.textContent === "플랜 상세",
    );
    const close = header && header.querySelector('button[aria-label="닫기"]');
    if (close) close.click();
  });
  await wait(700);

  // 1440 으로 넓혀서 인접한 두 컬럼이 모두 보이게 한다. 보드는 가로 스크롤이라
  // 좁은 폭에서는 세 번째 컬럼부터 인스펙터 뒤로 잘려, 그 좌표로 마우스를
  // 내리면 카드가 아니라 패널이 잡힌다.
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
  await wait(800);

  writes.length = 0;
  const grab = await page.evaluate(() => {
    const card = [
      ...document.querySelectorAll("[data-board-column] [role='button']"),
    ].find((c) => c.innerText.includes("드레스 투어"));
    const target = document.querySelector('[data-board-column="2026-09"]');
    if (!card || !target) return null;
    const cr = card.getBoundingClientRect();
    const tr = target.getBoundingClientRect();
    const from = {
      x: Math.round(cr.x + cr.width / 2),
      y: Math.round(cr.y + 20),
    };
    const to = {
      x: Math.round(tr.x + tr.width / 2),
      y: Math.round(tr.y + tr.height / 2),
    };
    // 실제로 그 좌표에 카드가 있는지 확인한다
    const hit = document.elementFromPoint(from.x, from.y);
    return { from, to, hitsCard: !!(hit && hit.closest("[role='button']")) };
  });

  if (grab && grab.hitsCard) {
    await page.mouse.move(grab.from.x, grab.from.y);
    await page.mouse.down();
    for (let i = 1; i <= 12; i += 1) {
      await page.mouse.move(
        grab.from.x + ((grab.to.x - grab.from.x) * i) / 12,
        grab.from.y + ((grab.to.y - grab.from.y) * i) / 12,
      );
      await wait(30);
    }
    await page.screenshot({ path: path.join(OUT, "board-1440-drag.png") });
    await page.mouse.up();
    await wait(1200);
  } else {
    console.log(`  드래그 시작 지점에 카드가 없음: ${JSON.stringify(grab)}`);
  }
  const dateWrite = writes.find((w) => w.kind === "date");
  console.log(
    `드래그 이동 → ${dateWrite ? `PATCH schedule/${dateWrite.id} ${dateWrite.body}` : "요청 없음 (문제)"}`,
  );

  await browser.close();
  if (!statusWrite || !dateWrite) process.exit(1);
})().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
