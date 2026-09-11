/* eslint-disable no-console */
/**
 * 신랑·신부 초대 = **귀속** 정책을 확인한다.
 *
 *   1. 배우자 링크(`?as=spouse`)는 열자마자 참여시키지 않고 먼저 묻는다
 *   2. "아직 아니요" 면 참여 요청이 나가지 않는다
 *   3. "네" 를 눌러야 POST /plan/room/{code}?as=spouse 가 나간다
 *   4. 내가 만들어 둔 일정이 있으면 경고가 그 개수를 말한다
 *   5. 일정이 0 건이면 없는 손해를 지어내지 않는다
 *   6. 조언자 링크(`as` 없음)는 예전처럼 바로 참여한다 — 경고 없음
 *   7. 로그인 전 초대 화면에도 배우자일 때만 미리 알림이 붙는다
 *   8. 귀속된 사람이 방을 보는 화면에 그냥 오면 그 방으로 돌아간다
 *      (/main 뿐 아니라 **주소를 직접 친** /calendar·/budget-detail·
 *      /schedule-detail·/add-plen 도. /add-plen 이 특히 중요하다 —
 *      roomId 없이 열리면 새 일정이 안 보이는 개인 플랜에 저장된다)
 *   9. 기존 쿼리(`?id=`)를 날리지 않고 roomId 만 얹는다
 *  10. 방장·조언자는 돌지 않는다 (내 플랜 그대로)
 *  11. 목록·피드(/plan-list·/feed)는 방 화면이 아니라 돌지 않는다
 *  12. 새로고침할 때 내 개인 예산이 **한 프레임도 읽히지 않는다**
 *      (DOM 에 있는지가 아니라 그 자리 맨 위에 무엇이 있는지로 센다 —
 *      예전 공용 오버레이는 bg-white/40 라 떠 있어도 숫자가 비쳤다)
 *  13. 귀속이 아닌 사람에게는 가림막이 두 번째 방문부터 아예 없다
 *  14. **roomId 가 이미 붙은 채** 새로고침해도 개인·기본 예산이 안 보인다
 *  15. 방을 보다가 **홈을 눌러도** 그 방으로 간다 (개인 플랜을 거치지 않는다)
 *  16. 커플 플랜이면 머리글에 **두 사람 이름**이 함께 뜨고, 레일·탭바는
 *      "참여 플랜" 이 아니라 **홈**을 켠다 (귀속된 방은 남의 플랜이 아니다)
 *  17. 배우자도 **자랑하기** 칸을 볼 수 있고, 방장이 올린 일정이 하나도
 *      빠지지 않는다 — 지난 일과 **날짜 미정**까지 (완료한 건만 제외)
 *      (대시보드 예산 패널이 planLoading 을 안 봐서, 방을 보는 중에도
 *       1,000 → 3,000 → 방 예산 순으로 숫자가 깜빡였다)
 *      (대부분의 사용자가 여기 해당한다 — 매번 흰 막이 번쩍이면
 *      고치려던 것보다 나쁜 화면이 된다)
 *
 * 백엔드는 목으로 세운다 — 실제 계정을 건드리지 않는다.
 * 실행: npm run dev 를 띄운 뒤 `node scripts/spouse-join.cjs`
 */
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const BASE = process.env.BASE || "http://localhost:3000";
const CHROME =
  process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = process.env.SHOT_DIR || path.join(__dirname, "..", "shots");
const CODE = "11111111-2222-3333-4444-555555555555";

const problems = [];
const ok = (m) => console.log("  · " + m);
const bad = (m) => {
  problems.push(m);
  console.log("  ✗ " + m);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const ME = "me-1";
const JWT = [
  b64u({ alg: "HS256", typ: "JWT" }),
  b64u({ planUserId: ME, sub: ME, exp: 9999999999 }),
  "sig",
].join(".");

const USER = {
  planUserId: ME,
  name: "미듀",
  weddingDate: "2026-12-26",
  budget: 4200,
  weddingVenue: null,
  roomId: null,
  members: [],
  chatRooms: [],
};

const schedule = (id) => ({
  id,
  title: `내 일정 ${id}`,
  startDate: "2026-10-01",
  status: "NORMAL",
  amount: 100,
  categoryName: "스드메",
});

/** 방 하나. `myPermission` 으로 내가 그 방에서 무엇인지 정한다 */
const room = (roomId, myPermission) => ({
  roomId,
  onwerName: "지수",
  weddingDate: "2026-11-14",
  budget: 9000,
  remainingBudget: 5000,
  plannedUseAmount: 1000,
  planCount: 3,
  name: "지수",
  members: [
    { planUserId: "owner-1", name: "지수", image: "", permission: "OWNER" },
    { planUserId: ME, name: "미듀", image: "", permission: myPermission },
  ],
  chatRooms: [],
});

async function boot({
  token = JWT,
  myScheduleCount = 0,
  rooms = [],
  latencyMs = 0,
  seedWeddingData = false,
  width = 390,
  roomPlans = null,
} = {}) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: process.env.HEADED ? false : "new",
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--hide-scrollbars",
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width, height: 800, isMobile: width < 768 });
  await page.setRequestInterception(true);

  /** 이 페이지에서 나간 방 참여 요청들 */
  const joins = [];

  page.on("request", async (req) => {
    const u = req.url();
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "*",
    };
    const json = (b) =>
      req.respond({
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
        body: JSON.stringify(b),
      });
    if (u.includes("/plan/")) {
      if (req.method() === "OPTIONS")
        return req.respond({ status: 204, headers: cors });
      // 백엔드가 곧바로 답하면 깜빡임이 드러나지 않는다
      if (latencyMs) await wait(latencyMs);
      // 방 참여: POST /plan/room/{uuid}
      if (req.method() === "POST" && /\/plan\/room\/[0-9a-f-]{36}/i.test(u)) {
        joins.push(u);
        return json({ result: true, data: null });
      }
      if (u.includes("/plan/room/list"))
        return json({
          result: true,
          data: { total: rooms.length, list: rooms },
        });
      /*
        방 하나 조회. 이게 없으면 화면이 방 데이터를 영영 못 받아
        개인 값이 그대로 남고, 하네스가 그걸 앱 문제로 보고한다.
      */
      {
        const single = rooms.find((r) => u.includes(`/plan/room/${r.roomId}`));
        if (single) return json({ result: true, data: single });
      }
      if (u.includes("/plan/schedule/calendar")) {
        const inRoom = u.includes("roomId=77");
        const src = inRoom
          ? [
              {
                id: 901,
                title: "A 의 본식 촬영",
                startDate: "2026-09-15",
                status: "NORMAL",
                amount: 250,
                categoryName: "스드메",
                startTime: null,
              },
            ]
          : Array.from({ length: myScheduleCount }, (_, i) => schedule(i + 1));
        const byDay = {};
        src.forEach((s) => {
          byDay[s.startDate] = byDay[s.startDate] || [];
          byDay[s.startDate].push(s);
        });
        return json({
          result: true,
          data: {
            list: Object.keys(byDay).map((day) => ({ day, list: byDay[day] })),
          },
        });
      }
      if (u.includes("/plan/schedule/room/77")) {
        const all = roomPlans ?? [];
        const wanted = u.match(/status=(w+)/);
        const list = wanted ? all.filter((s) => s.status === wanted[1]) : all;
        return json({ result: true, data: { total: list.length, list } });
      }
      if (u.includes("/plan/schedule/list")) {
        const list = Array.from({ length: myScheduleCount }, (_, i) =>
          schedule(i + 1),
        );
        return json({ result: true, data: { total: list.length, list } });
      }
      /*
        예산 화면은 이 응답의 숫자를 곧바로 toLocaleString 한다. 빈 목을 주면
        화면이 크래시해서 라우팅까지 못 가 — 하네스가 앱 문제로 오해한다.
      */
      if (u.includes("total-amount"))
        return json({
          result: true,
          data: {
            totalAmount: 2023,
            remainingAmount: 1414,
            usedAmount: 609,
            plannedUseAmount: 600,
          },
        });
      if (u.includes("/amount/detail"))
        return json({
          result: true,
          data: {
            initialCapital: u.includes("room") ? 9000 : 3000,
            totalPlannedAndUsedAmount: 2400,
            plannedUseAmount: 600,
            usedAmount: 1800,
          },
        });
      if (u.includes("/amount/category-chart"))
        return json({ result: true, data: { list: [] } });
      if (u.includes("/plan/user")) return json({ result: true, data: USER });
      return json({ result: true, data: { total: 0, list: [] } });
    }
    return req.continue().catch(() => {});
  });

  if (token) {
    await page.evaluateOnNewDocument((t) => {
      localStorage.setItem("plan_auth_token", t);
      sessionStorage.setItem("plan_auth_token", t);
    }, token);
  }
  if (seedWeddingData) {
    /*
      예산·이름·날짜는 WeddingContext 가 sessionStorage 에서 곧바로 읽어
      네트워크 없이 그린다. 새로고침한 사람을 흉내 내려면 심어 둬야 한다 —
      안 심으면 깜빡일 값 자체가 없어 이 검사가 헛돈다.
    */
    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem(
        "weddingData",
        JSON.stringify({ budget: "3000", name: "미듀", date: "2026-12-26" }),
      );
    });
  }
  return { browser, page, joins };
}

const readModal = (page) =>
  page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return null;
    return {
      label: dialog.getAttribute("aria-label"),
      text: dialog.innerText.replace(/\s+/g, " ").trim(),
    };
  });

const clickText = (text) => {
  const b = Array.from(document.querySelectorAll("button")).find(
    (x) => (x.textContent || "").trim() === text && x.offsetParent !== null,
  );
  if (!b) return false;
  b.click();
  return true;
};

async function shot(page, name) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((e) => e.remove());
  });
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

(async () => {
  // 1·2. 배우자 링크 — 묻기 전에는 참여하지 않는다
  console.log("1. 배우자 링크는 먼저 묻는다 (일정 3건 보유)");
  {
    const { browser, page, joins } = await boot({ myScheduleCount: 3 });
    await page.goto(`${BASE}/share/${CODE}?as=spouse`, {
      waitUntil: "networkidle0",
      timeout: 120000,
    });
    await wait(2500);
    const modal = await readModal(page);
    if (!modal) bad("경고 모달이 뜨지 않았다");
    else ok(`경고가 떴다 ("${modal.label}")`);
    if (joins.length) bad(`묻기도 전에 참여 요청이 나갔다 (${joins.length}건)`);
    else ok("아직 참여 요청이 나가지 않았다");
    if (modal && !modal.text.includes("3건"))
      bad(`내 일정 개수를 말하지 않았다 — "${modal.text}"`);
    else if (modal) ok("내 일정 3건을 말한다");
    if (modal && !modal.text.includes("지워지는 건 아니"))
      bad("지워지지 않는다는 사실을 말하지 않았다");
    else if (modal) ok("지워지지 않는다고 알린다");
    await shot(page, "spouse-warning-390");

    console.log('2. "아직 아니요" — 참여 요청이 나가면 안 된다');
    await page.evaluate(clickText, "아직 아니요");
    await wait(1500);
    if (joins.length) bad(`거절했는데 참여했다 (${joins.length}건)`);
    else ok("참여하지 않았다");
    await browser.close();
  }

  // 3. 확인하면 참여한다
  console.log('3. "네, 같이 준비할게요" — 그때 참여한다');
  {
    const { browser, page, joins } = await boot({ myScheduleCount: 3 });
    await page.goto(`${BASE}/share/${CODE}?as=spouse`, {
      waitUntil: "networkidle0",
      timeout: 120000,
    });
    await wait(2500);
    await page.evaluate(clickText, "네, 같이 준비할게요");
    await wait(2500);
    if (!joins.length) bad("확인했는데 참여 요청이 없다");
    else if (!joins[0].includes("as=spouse"))
      bad(`배우자로 참여하지 않았다 — ${joins[0]}`);
    else ok("POST /plan/room/{code}?as=spouse 가 나갔다");
    await browser.close();
  }

  // 4. 일정이 없으면 개수 줄을 내지 않는다
  console.log("4. 내 일정이 0 건이면 없는 손해를 지어내지 않는다");
  {
    const { browser, page } = await boot({ myScheduleCount: 0 });
    await page.goto(`${BASE}/share/${CODE}?as=spouse`, {
      waitUntil: "networkidle0",
      timeout: 120000,
    });
    await wait(2500);
    const modal = await readModal(page);
    if (!modal) bad("경고 모달이 뜨지 않았다");
    else if (modal.text.includes("보이지 않게 돼요"))
      bad(`0 건인데 "보이지 않게 된다"고 했다 — "${modal.text}"`);
    else ok("개수 줄 없이 정책만 알린다");
    await browser.close();
  }

  // 5. 조언자 링크는 예전대로 바로 참여
  console.log("5. 조언자 링크는 경고 없이 바로 참여한다");
  {
    const { browser, page, joins } = await boot({ myScheduleCount: 3 });
    await page.goto(`${BASE}/share/${CODE}`, {
      waitUntil: "networkidle0",
      timeout: 120000,
    });
    await wait(2500);
    const modal = await readModal(page);
    if (modal) bad(`조언자인데 경고가 떴다 ("${modal.label}")`);
    else ok("경고 없음");
    if (!joins.length) bad("바로 참여하지 않았다");
    else if (joins[0].includes("as=spouse"))
      bad("조언자인데 배우자로 참여했다");
    else ok("바로 참여했다");
    await browser.close();
  }

  // 6. 로그인 전 초대 화면의 미리 알림
  console.log("6. 로그인 전 초대 화면 — 배우자일 때만 미리 알린다");
  {
    const { browser, page } = await boot({ token: null });
    await page.goto(`${BASE}/share/${CODE}?as=spouse`, {
      waitUntil: "networkidle0",
      timeout: 120000,
    });
    await wait(2000);
    const text = await page.evaluate(() =>
      document.body.innerText.replace(/\s+/g, " "),
    );
    if (!text.includes("보이지 않게 돼요"))
      bad("배우자 초대인데 미리 알림이 없다");
    else ok("미리 알림이 붙었다");
    await shot(page, "spouse-invite-pre-login-390");
    await browser.close();
  }
  {
    const { browser, page } = await boot({ token: null });
    await page.goto(`${BASE}/share/${CODE}`, {
      waitUntil: "networkidle0",
      timeout: 120000,
    });
    await wait(2000);
    const text = await page.evaluate(() =>
      document.body.innerText.replace(/\s+/g, " "),
    );
    if (text.includes("보이지 않게 돼요"))
      bad("조언자 초대인데 귀속 알림이 붙었다");
    else ok("조언자에게는 안 붙는다");
    await browser.close();
  }

  /*
    7. **주소를 직접 친** 경우까지 본다.

    홈에서 눌러 들어가면 roomId 가 붙어 따라오지만, 주소창에 바로 치면 안
    붙는다. 예전에 /main 에만 걸어 두어서 /calendar 를 직접 열면 A 의 플랜이
    안 보였다 — 이 하네스가 그때 아무 말도 못 했다.
  */
  console.log("7. 귀속된 사람이 방 화면을 직접 열면 그 방으로 간다");
  for (const target of ["/main", "/calendar", "/budget-detail", "/add-plen"]) {
    const { browser, page } = await boot({ rooms: [room(77, "SPOUSE")] });
    await page.goto(`${BASE}${target}`, {
      waitUntil: "networkidle0",
      timeout: 120000,
    });
    await wait(3500);
    const url = await page.evaluate(() => location.pathname + location.search);
    if (!url.includes("roomId=77"))
      bad(`${target} 가 그 방으로 안 갔다 (${url})`);
    else ok(`${target} → roomId=77`);
    await browser.close();
  }

  // 8. 기존 쿼리를 날리지 않는다
  console.log("8. 기존 쿼리(?id=)를 지우지 않고 roomId 만 얹는다");
  {
    const { browser, page } = await boot({ rooms: [room(77, "SPOUSE")] });
    await page.goto(`${BASE}/schedule-detail?id=12`, {
      waitUntil: "networkidle0",
      timeout: 120000,
    });
    await wait(3500);
    const url = await page.evaluate(() => location.pathname + location.search);
    if (!url.includes("roomId=77")) bad(`그 방으로 안 갔다 (${url})`);
    else if (!url.includes("id=12")) bad(`id 를 잃었다 (${url})`);
    else ok("id=12 를 지키며 roomId 를 얹었다");
    await browser.close();
  }

  // 9. 방장·조언자는 그대로
  console.log("9. 방장·조언자는 돌지 않는다");
  for (const perm of ["OWNER", "READ"]) {
    const { browser, page } = await boot({ rooms: [room(77, perm)] });
    await page.goto(`${BASE}/calendar`, {
      waitUntil: "networkidle0",
      timeout: 120000,
    });
    await wait(3500);
    const url = await page.evaluate(() => location.pathname + location.search);
    if (url.includes("roomId=")) bad(`${perm} 인데 방으로 끌려갔다 (${url})`);
    else ok(`${perm} 는 내 플랜 그대로`);
    await browser.close();
  }

  // 10. 목록·피드는 방 화면이 아니다
  console.log("10. /plan-list · /feed 는 돌지 않는다");
  for (const target of ["/plan-list", "/feed"]) {
    const { browser, page } = await boot({ rooms: [room(77, "SPOUSE")] });
    await page.goto(`${BASE}${target}`, {
      waitUntil: "networkidle0",
      timeout: 120000,
    });
    await wait(3000);
    const url = await page.evaluate(() => location.pathname + location.search);
    if (url.includes("roomId=")) bad(`${target} 가 방으로 끌려갔다 (${url})`);
    else ok(`${target} 그대로`);
    await browser.close();
  }

  /*
    12. 깜빡임. 백엔드 지연을 흉내 내고 새로고침 직후를 50ms 간격으로 훑는다.

    **DOM 에 글자가 있는지로 세면 안 된다.** 예전 공용 오버레이는
    bg-white/40 라 떠 있어도 뒤의 큰 숫자가 그대로 읽혔고, 그렇게 재다가
    이 하네스가 통과를 보고했는데 사람 눈에는 3,000 이 보였다.
    그 자리 한가운데의 **맨 위 요소**가 그 글자인지로 센다.
  */
  console.log("12. 새로고침할 때 내 개인 예산이 읽히지 않는다");
  for (const target of ["/main", "/calendar"]) {
    const { browser, page } = await boot({
      rooms: [room(77, "SPOUSE")],
      latencyMs: 250,
      seedWeddingData: true,
    });
    page
      .goto(`${BASE}${target}`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      })
      .catch(() => {});
    let leaked = 0;
    let translucent = null;
    for (let i = 0; i < 60; i += 1) {
      await wait(50);
      try {
        const visible = await page.evaluate(() => {
          const walk = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
          );
          let node = walk.nextNode();
          while (node) {
            if (/3,?000/.test(node.textContent || "")) {
              const el = node.parentElement;
              const r = el && el.getBoundingClientRect();
              if (r && r.width && r.height) {
                const top = document.elementFromPoint(
                  r.left + r.width / 2,
                  r.top + r.height / 2,
                );
                if (!top || el.contains(top) || top === el) return true;
              }
            }
            node = walk.nextNode();
          }
          return false;
        });
        if (visible) leaked += 1;
        if (translucent === null) {
          translucent = await page.evaluate(() => {
            const v = document.querySelector(
              '[aria-label="플랜을 불러오는 중입니다"]',
            );
            if (!v) return null;
            const bg = getComputedStyle(v).backgroundColor;
            const m = bg.match(/rgba?(([^)]+))/);
            if (!m) return bg;
            const parts = m[1].split(",").map((x) => x.trim());
            const alpha = parts.length > 3 ? Number(parts[3]) : 1;
            return alpha < 1 ? bg : false;
          });
        }
      } catch {
        // 이동 중에는 평가가 끊긴다
      }
    }
    if (leaked) bad(`${target}: 개인 예산이 ${leaked} 프레임 읽혔다`);
    else ok(`${target}: 한 프레임도 읽히지 않았다`);

    /*
      **가림막은 불투명해야 한다.** elementFromPoint 는 반투명도
      "덮었다" 고 답하므로 위 검사만으로는 비쳐 보이는 회귀를 못 잡는다.
      실제로 예전 공용 오버레이(bg-white/40)가 그래서 통과했고, 사람 눈에는
      3,000 이 그대로 보였다. 배경색의 알파를 직접 잰다.
    */
    if (translucent)
      bad(`${target}: 가림막이 반투명이다 (${translucent}) — 뒤 숫자가 비친다`);
    else ok(`${target}: 가림막이 불투명하다`);
    await browser.close();
  }

  /*
    13. 귀속이 아닌 사람이 치르는 값. 첫 방문은 한 번 묻느라 가리지만,
    같은 세션의 두 번째 화면부터는 가림막이 없어야 한다.
  */
  console.log("13. 귀속이 아니면 두 번째 방문부터 가림막이 없다");
  {
    const { browser, page } = await boot({ rooms: [], latencyMs: 250 });
    const countVeil = async () => {
      let n = 0;
      for (let i = 0; i < 40; i += 1) {
        await wait(50);
        try {
          const on = await page.evaluate(
            () =>
              !!document.querySelector(
                '[aria-label="플랜을 불러오는 중입니다"]',
              ),
          );
          if (on) n += 1;
        } catch {
          // 이동 중
        }
      }
      return n;
    };
    page
      .goto(`${BASE}/main`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      })
      .catch(() => {});
    await countVeil();
    page
      .goto(`${BASE}/calendar`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      })
      .catch(() => {});
    const second = await countVeil();
    if (second) bad(`두 번째 방문에도 가림막이 ${second} 프레임 떴다`);
    else ok("두 번째 방문에는 가림막이 없다");
    await browser.close();
  }

  /*
    14. 방을 보는 중(roomId 가 이미 URL 에 있음)의 새로고침.

    여기는 전환이 없어 가림막이 돌지 않는다. 그런데도 깜빡였다 —
    대시보드 예산 패널이 "planLoading" 을 보지 않아서, WeddingContext 가
    sessionStorage 에서 읽은 개인 예산(과 그 기본값 1,000)을 먼저 그렸다.
    머리글 이름·날짜만 스켈레톤이고 금액은 열려 있던 자리다.
  */
  console.log("14. roomId 가 붙은 새로고침에서 개인·기본 예산이 안 보인다");
  {
    const { browser, page } = await boot({
      rooms: [room(77, "SPOUSE")],
      latencyMs: 350,
      seedWeddingData: true,
      width: 1440,
    });
    page
      .goto(`${BASE}/main?roomId=77`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      })
      .catch(() => {});
    const seen = new Set();
    for (let i = 0; i < 60; i += 1) {
      await wait(50);
      try {
        const text = await page.evaluate(() => {
          const el = document.querySelector("#main-dash-budget");
          return el ? (el.innerText || "").replace(/s+/g, " ") : "";
        });
        if (text.includes("3,000만원")) seen.add("3,000");
        if (text.includes("1,000만원")) seen.add("1,000");
      } catch {
        // 이동 중
      }
    }
    const leaked = [...seen];
    if (leaked.length) bad(`방을 보는 중인데 ${leaked.join(" · ")} 이 보였다`);
    else ok("개인 3,000 · 기본 1,000 모두 안 보였다");
    await browser.close();
  }

  /*
    15. 홈 버튼. 예전에는 무조건 쿼리를 떼어 "/main" 으로 보냈다 —
    귀속된 사람은 홈을 누를 때마다 자기 개인 플랜(빈 화면)에 떨어졌다가
    BoundRoomRedirect 가 다시 방으로 돌려세우느라 한 번 더 깜빡였다.
    링크가 처음부터 방을 달고 가면 그 왕복이 없다.
  */
  console.log("15. 방을 보다가 홈을 눌러도 그 방으로 간다");
  for (const width of [390, 1440]) {
    const { browser, page } = await boot({
      rooms: [room(77, "SPOUSE")],
      width,
    });
    // 먼저 방을 연다 (여기서 캐시가 채워진다)
    await page.goto(`${BASE}/main`, {
      waitUntil: "networkidle0",
      timeout: 120000,
    });
    await wait(3000);
    const before = await page.evaluate(
      () => location.pathname + location.search,
    );
    if (!before.includes("roomId=77")) {
      bad(`${width}: 방을 열지 못했다 (${before})`);
      await browser.close();
      continue;
    }

    // 홈을 누른다
    const clicked = await page.evaluate(() => {
      const hit = Array.from(document.querySelectorAll("button, a")).find(
        (b) => (b.textContent || "").trim() === "홈" && b.offsetParent !== null,
      );
      if (!hit) return false;
      hit.click();
      return true;
    });
    if (!clicked) bad(`${width}: 홈 버튼을 못 찾았다`);

    /*
      누른 **직후부터** 훑는다. 개인 플랜을 잠깐 거쳤다가 돌아오면
      최종 주소만 봐서는 알 수 없다 — 그 왕복 자체가 깜빡임이다.
    */
    let detoured = false;
    for (let i = 0; i < 24; i += 1) {
      await wait(50);
      try {
        const here = await page.evaluate(
          () => location.pathname + location.search,
        );
        if (here === "/main") detoured = true;
      } catch {
        // 이동 중
      }
    }
    const after = await page.evaluate(
      () => location.pathname + location.search,
    );
    if (detoured) bad(`${width}: 홈이 개인 플랜을 거쳐 갔다`);
    else ok(`${width}: 개인 플랜을 거치지 않았다`);
    if (!after.includes("roomId=77"))
      bad(`${width}: 홈이 방으로 가지 않았다 (${after})`);
    else ok(`${width}: 홈 → ${after}`);
    await browser.close();
  }

  /*
    16. 귀속된 방의 머리글과 활성 탭.

    방장 이름만 띄우면 들어온 사람은 계속 남의 플랜에 얹혀 있는 것처럼
    읽힌다. 레일이 "참여 플랜" 을 켜고 있던 것도 같은 어긋남이다.
  */
  console.log("16. 커플 이름이 함께 뜨고 홈이 켜진다");
  for (const width of [390, 1440]) {
    const { browser, page } = await boot({
      rooms: [room(77, "SPOUSE")],
      width,
    });
    await page.goto(`${BASE}/main`, {
      waitUntil: "networkidle0",
      timeout: 120000,
    });
    await wait(3500);
    const text = await page.evaluate(() =>
      document.body.innerText.replace(/s+/g, " "),
    );
    if (!text.includes("지수 · 미듀"))
      bad(`${width}: 머리글에 두 사람 이름이 없다`);
    else ok(`${width}: "지수 · 미듀"`);

    // 활성 표시: 브랜드색으로 칠해진 내비 항목
    const active = await page.evaluate(() => {
      const items = Array.from(
        document.querySelectorAll("nav button, nav a, aside button, aside a"),
      );
      return items
        .filter((b) => {
          const c = getComputedStyle(b).color;
          return c.includes("238, 43, 140");
        })
        .map((b) => (b.textContent || "").trim())
        .filter(Boolean);
    });
    if (active.some((t) => t.includes("참여 플랜")))
      bad(
        `${width}: 귀속된 방인데 "참여 플랜" 이 켜져 있다 (${active.join("/")})`,
      );
    else ok(`${width}: 참여 플랜이 켜져 있지 않다`);
    await browser.close();
  }

  /*
    17. 배우자가 보는 것.

    자랑하기는 방장만 할 수 있게 막혀 있어서 배우자 화면에서는 그 칸이
    통째로 사라졌다. 귀속된 뒤에는 둘의 플랜이라 둘 다 자랑한다.

    일정은 넓은 화면에서 **지난 일과 날짜 미정이 빠졌다** — 대시보드가
    "날짜가 있으면서 이번 달" 만 골랐는데, 폰의 "그 다음" 묶음이 여기엔
    없어서 날짜를 안 정한 일정이 어디에도 안 보였다.
  */
  console.log("17. 배우자에게 자랑하기가 보이고 일정이 빠지지 않는다");
  {
    const PLANS = [
      {
        id: 900,
        title: "지난달건",
        startDate: "2026-08-20",
        status: "NORMAL",
        amount: 150,
        categoryName: "기타",
        startTime: null,
      },
      {
        id: 901,
        title: "이번달건",
        startDate: "2026-09-15",
        status: "NORMAL",
        amount: 250,
        categoryName: "스드메",
        startTime: null,
      },
      {
        id: 903,
        title: "다음달건",
        startDate: "2026-10-05",
        status: "NORMAL",
        amount: 500,
        categoryName: "신혼여행",
        startTime: null,
      },
      {
        id: 904,
        title: "완료된건",
        startDate: "2026-09-02",
        status: "COMPLETED",
        amount: 300,
        categoryName: "기타",
        startTime: null,
      },
      {
        id: 905,
        title: "날짜미정건",
        startDate: null,
        status: "NORMAL",
        amount: 100,
        categoryName: "기타",
        startTime: null,
      },
    ];
    for (const width of [390, 1440]) {
      const { browser, page } = await boot({
        rooms: [room(77, "SPOUSE")],
        width,
        roomPlans: PLANS,
      });
      await page.goto(`${BASE}/main`, {
        waitUntil: "networkidle0",
        timeout: 120000,
      });
      await wait(4000);
      /*
        넓은 화면에서는 **대시보드 안에서만** 찾는다. 모바일 트리는 md:hidden
        이라 눈에는 안 보여도 같은 글자가 DOM 에 남아 있어, body 전체를 읽으면
        대시보드가 비어 있어도 통과한다(실제로 그렇게 헛통과했다).
      */
      const text = await page.evaluate((wide) => {
        const clean = (el) => (el ? el.innerText : "");
        if (!wide) return clean(document.body);
        return (
          clean(document.querySelector("#main-dash-tasks")) +
          " " +
          clean(document.querySelector("#main-dash-timeline")) +
          " " +
          clean(document.querySelector("#main-dash-budget"))
        );
      }, width >= 768);
      if (!text.includes("자랑")) bad(`${width}: 자랑하기 칸이 없다`);
      else ok(`${width}: 자랑하기 칸이 있다`);

      const missing = ["지난달건", "이번달건", "다음달건", "날짜미정건"].filter(
        (t) => !text.includes(t),
      );
      if (missing.length)
        bad(`${width}: 일정이 빠졌다 — ${missing.join(" / ")}`);
      else ok(`${width}: 네 건이 모두 보인다 (완료건만 빠짐)`);
      await browser.close();
    }
  }

  console.log("");
  if (problems.length) {
    console.log(`문제 ${problems.length}건:`);
    problems.forEach((p) => console.log(" - " + p));
    process.exitCode = 1;
  } else console.log("배우자 귀속 정책 이상 없음");
})();
