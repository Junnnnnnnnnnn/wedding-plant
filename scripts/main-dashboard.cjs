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
    if (p0 === "/plan/room/spouse") {
      req.respond(ok(null)).catch(() => {});
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
                permission: "SPOUSE",
              },
              {
                planUserId: "u-3",
                name: "엄마",
                image: null,
                permission: "READ",
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
                // 실제 API 는 방장+배우자 둘만 있는 방 하나에만 붙인다
                isCouple: true,
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
          ok({
            initialCapital: 4200,
            totalPlannedAndUsedAmount: 1340,
            plannedUseAmount: 1850,
            usedAmount: 1340,
          }),
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
    // 일정 상세 — 인스펙터가 읽는다
    const detailMatch = /^\/plan\/schedule\/(\d+)$/.exec(p0);
    if (detailMatch && req.method() === "GET") {
      const id = Number(detailMatch[1]);
      const item = SCHEDULES.find((x) => x.id === id);
      if (!item) {
        req.respond(ok(null)).catch(() => {});
        return;
      }
      req
        .respond(
          ok({
            id: item.id,
            title: item.title,
            categoryName: item.categoryName,
            amount: item.amount ?? 0,
            startDate: item.startDate,
            startTime: item.startTime ?? null,
            status: item.status,
            payType: "CREDIT",
            location: item.location ?? "",
            locationLat: 0,
            locationLng: 0,
            memo: "",
            addCategoryNameList: [],
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
      ).filter((s) => !emptyThisMonth || !(s.startDate || "").startsWith("2026-08"));
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

  for (const w of [375, 768, 1024, 1280, 1440, 2327]) {
    await page.setViewport({ width: w, height: 900, deviceScaleFactor: 1.5 });
    await page.goto(`${ORIGIN}/main`, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    await wait(3500);
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

  // 완료 토글이 예산·카테고리에 바로 반영되는지 (새로고침 없이)
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.goto(`${ORIGIN}/main`, {
    waitUntil: "networkidle2",
    timeout: 60000,
  });
  await wait(2200);
  const readBudget = () =>
    page.evaluate(() => {
      const txt = document.body.innerText.replace(/\s+/g, " ");
      const remain = /([\d,\-]+)만원 (?:4,200만원 중 남음|중 남음)/.exec(txt);
      const spent = /이번 달 지출 ([\d,\-]+)만원/.exec(txt);
      const cats = [...document.querySelectorAll("span")]
        .map((x) => x.innerText.trim())
        .filter((t) => ["예식장", "스드메", "상견례", "기차"].includes(t));
      return {
        남은: remain ? remain[1] : "?",
        이번달지출: spent ? spent[1] : "?",
        카테고리수: new Set(cats).size,
      };
    });
  const before = await readBudget();
  // 토글 뒤에 어떤 요청이 다시 나가는지 본다. 새로고침 없이 예산·카테고리가
  // 따라오려면 이 요청들이 나가야 한다.
  const seen = [];
  const record = (r) => {
    const u = r.url();
    if (u.includes("/plan/")) seen.push(`${r.method()} ${new URL(u).pathname}`);
  };
  page.on("request", record);
  const toggled = await page.evaluate(() => {
    const box = document.querySelector('[aria-label="완료로 표시"]');
    if (!box) return "체크박스 없음";
    box.click();
    return "clicked";
  });
  await wait(2500);
  page.off("request", record);
  const after = await readBudget();
  await page.screenshot({ path: path.join(OUT, "main-1440-after-toggle.png") });
  const want = [
    "PATCH /plan/schedule/status/",
    "GET /plan/user/amount/category-chart",
    "GET /plan/user/amount/detail",
    "GET /plan/user/total-amount",
    "GET /plan/schedule/list",
    "GET /plan/activity/list",
  ];
  const missing = want.filter((w) => !seen.some((x) => x.startsWith(w)));
  console.log(
    `완료 토글 ${toggled} → 재요청 ${missing.length === 0 ? "모두 나감" : "빠짐: " + missing.join(", ")}`,
  );
  console.log(
    `  남은 ${before.남은}→${after.남은} / 이번달지출 ${before.이번달지출}→${after.이번달지출}`,
  );

  // 이번 달 일정이 하나도 없어도 "이번 달 할 일" 줄은 남아야 한다
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  emptyThisMonth = true;
  await page.goto(`${ORIGIN}/main`, {
    waitUntil: "networkidle2",
    timeout: 60000,
  });
  await wait(2200);
  const emptyState = await page.evaluate(() => {
    const h = [...document.querySelectorAll("h2")].find((x) =>
      x.innerText.includes("이번 달 할 일"),
    );
    const add = [...document.querySelectorAll("button")].find((b) =>
      /월에 할 일 추가/.test(b.innerText),
    );
    return {
      제목: h ? h.innerText.replace(/\s+/g, " ").trim() : "없음",
      추가카드: add ? add.innerText.replace(/\s+/g, " ").trim() : "없음",
    };
  });
  await page.screenshot({ path: path.join(OUT, "main-1440-empty-month.png") });
  console.log(
    `캡처 main-1440-empty-month.png   제목=${emptyState.제목} 추가카드=${emptyState.추가카드}`,
  );
  emptyThisMonth = false;

  // 공유 모달의 참여 멤버 + 신랑·신부 지정
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.goto(`${ORIGIN}/main`, {
    waitUntil: "networkidle2",
    timeout: 60000,
  });
  await wait(2200);
  const openedShare = await page.evaluate(() => {
    const b = document.querySelector('[aria-label="참여 멤버"]');
    if (!b) return "버튼 없음";
    b.click();
    return "clicked";
  });
  await wait(1600);
  await page.screenshot({ path: path.join(OUT, "main-share-modal.png") });
  const modal = await page.evaluate(() => {
    const txt = document.body.innerText.replace(/\s+/g, " ");
    return {
      멤버목록: txt.includes("참여 멤버"),
      배지: txt.includes("신랑 · 신부"),
      지정버튼: txt.includes("배우자로"),
      조언자: txt.includes("조언자"),
    };
  });
  console.log(
    `공유 모달 ${openedShare} → 멤버목록=${modal.멤버목록} 배지=${modal.배지} 지정버튼=${modal.지정버튼} 조언자=${modal.조언자}`,
  );

  // 대시보드에서 일정을 누르면 >=1024 는 옆 인스펙터에서 열려야 한다.
  // 예전에는 폭과 관계없이 /schedule-detail 로 나가 448px 폰 띠가 됐다.
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.goto(`${ORIGIN}/main`, {
    waitUntil: "networkidle2",
    timeout: 60000,
  });
  await wait(2200);
  const opened = await page.evaluate(() => {
    // "드레스 투어" 는 대화 패널 미리보기에도 있다. 그쪽을 누르면
    // /plan-list 로 나가 버리므로 스트립 카드(w-[232px])만 고른다.
    // 앞 단계에서 완료 토글을 한 뒤라 어떤 카드가 남아 있을지 모른다.
    // 스트립(w-[232px])의 첫 카드를 그냥 누른다.
    const btn = [...document.querySelectorAll("button")].find((b) =>
      String(b.className).includes("w-[232px]"),
    );
    if (!btn) return "카드 없음";
    const title = btn.innerText.trim().slice(0, 20);
    btn.click();
    return `clicked(${title})`;
  });
  await wait(2000);
  const inspector = await page.evaluate(() => ({
    라우트: location.pathname,
    머리글: !![...document.querySelectorAll("span")].find(
      (x) => x.innerText.trim() === "플랜 상세",
    ),
    제목: [...document.querySelectorAll("h2")]
      .map((x) => x.innerText.trim())
      .find((t) => t.includes("드레스")),
  }));
  await page.screenshot({ path: path.join(OUT, "main-1440-inspector.png") });
  console.log(
    `일정 열기 ${opened} → 라우트=${inspector.라우트} 인스펙터=${inspector.머리글 ? "열림" : "안열림"} 제목=${inspector.제목 ?? "-"}`,
  );

  // 대시보드의 "+ 플랜 추가" → 우측 등록 pane (>=1024)
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.goto(`${ORIGIN}/main`, {
    waitUntil: "networkidle2",
    timeout: 60000,
  });
  await wait(2200);
  const clicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => x.innerText.replace(/\s+/g, " ").trim() === "플랜 추가",
    );
    if (!b) {
      return [...document.querySelectorAll("button")]
        .map((x) => x.innerText.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .slice(0, 12)
        .join(" | ");
    }
    b.click();
    return "clicked";
  });
  await wait(1500);
  await page.screenshot({ path: path.join(OUT, "main-1440-addpane.png") });
  const pane = await page.evaluate(() => {
    const title = [...document.querySelectorAll("b")].find(
      (x) => x.innerText.trim() === "플랜 추가",
    );
    return {
      열림: !!title,
      제목칸: !!document.querySelector('input[placeholder="어떤 지출인가요?"]'),
      라우트: location.pathname,
    };
  });
  // pane 에서 저장하면 예산·카테고리가 새로고침 없이 따라와야 한다.
  //
  // /main 에는 같은 이름의 카테고리 필터 칩("스드메" 등)이 이미 떠 있다.
  // 문서 전체에서 버튼을 찾으면 그쪽이 먼저 걸리므로, 반드시 pane 안에서만
  // 찾는다.
  const saveSeen = [];
  const recordSave = (r) => {
    const u = r.url();
    if (u.includes("/plan/"))
      saveSeen.push(`${r.method()} ${new URL(u).pathname}`);
  };
  page.on("request", recordSave);
  const paneHelpers = `
    const paneRoot = () => document.querySelector("[data-plan-pane]");
    const paneBtn = (label) => {
      const root = paneRoot();
      if (!root) return null;
      return [...root.querySelectorAll("button")].find(
        (x) => x.innerText.replace(/\s+/g, " ").trim() === label,
      );
    };
  `;
  await page.evaluate(`(() => {
    ${paneHelpers}
    const root = paneRoot();
    const el = root && root.querySelector('input[placeholder="어떤 지출인가요?"]');
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, "value",
    ).set;
    setter.call(el, "본식 리허설");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await wait(1100);
  await page.evaluate(`(() => {
    ${paneHelpers}
    const b = paneBtn("카테고리 선택");
    if (b) b.click();
  })()`);
  await wait(900);
  // 카테고리 모달은 pane 밖(화면 가운데)에 뜬다. role=dialog 안에서 고른다.
  await page.evaluate(() => {
    // 모달은 화면 가운데에 뜨지만 DOM 상으로는 pane 안에 있다.
    // /main 의 카테고리 필터 칩과 이름이 겹치므로 pane 안에서만 찾는다.
    const root = document.querySelector("[data-plan-pane]");
    if (!root) return;
    const b = [...root.querySelectorAll("button")].find((x) =>
      ["스드메", "예식장", "예물", "상견례"].includes(x.innerText.trim()),
    );
    if (b) b.click();
  });
  await wait(900);
  await page.evaluate(`(() => {
    ${paneHelpers}
    const b = paneBtn("카드");
    if (b) b.click();
  })()`);
  await wait(1100);
  const saved = await page.evaluate(`(() => {
    ${paneHelpers}
    const b = paneBtn("플랜 저장하기");
    if (!b) {
      const root = paneRoot();
      return (
        "저장버튼 없음 · pane버튼=" +
        (root
          ? [...root.querySelectorAll("button")]
              .map((x) => x.innerText.replace(/\s+/g, " ").trim())
              .filter(Boolean)
              .join(" | ")
          : "pane 없음")
      );
    }
    b.click();
    return "clicked";
  })()`);
  await wait(2600);
  // 저장 뒤 "채팅방에 공유할까요?" 모달에서 "아니요" 를 누르면
  // onSaved 가 불려 목록·예산이 다시 받아진다.
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => x.innerText.trim() === "아니요",
    );
    if (b) b.click();
  });
  await wait(2400);
  page.off("request", recordSave);
  const wantSave = [
    "POST /plan/schedule",
    "GET /plan/user/amount/category-chart",
    "GET /plan/user/amount/detail",
    "GET /plan/user/total-amount",
    "GET /plan/activity/list",
  ];
  const missSave = wantSave.filter(
    (w) => !saveSeen.some((x) => x.startsWith(w)),
  );
  console.log(
    `등록 pane 저장 ${saved} → 재요청 ${missSave.length === 0 ? "모두 나감" : "빠짐: " + missSave.join(", ")}`,
  );
  console.log(
    `캡처 main-1440-addpane.png   클릭=${clicked} pane=${pane.열림 ? "열림" : "안열림"} 제목칸=${pane.제목칸 ? "있음" : "없음"} 라우트=${pane.라우트}`,
  );

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
