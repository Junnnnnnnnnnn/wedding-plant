/* eslint-disable no-console */
/**
 * 후기 상세(/feed/[postId]) — 시안 A2.
 *
 *   1. 목록에서 카드를 누르면 /feed/{id} 로 가고 **요청이 한 건도 안 나간다**
 *      (목록이 이미 받아 둔 항목을 넘긴다 — 백엔드에 단건 조회가 없다)
 *   2. 좌표가 있으면 지도를 그린다 (카카오 SDK 를 부른다)
 *   3. **좌표가 없으면 지도 블록 자체가 없다** (높이 0)
 *   4. 금액 비공개는 "0원" 이 아니라 "금액 비공개" 로 낸다
 *   5. 직접 주소로 열어도(새로고침) 목록에서 찾아 연다
 *   6. 카드 안쪽 버튼(투표·담기)은 상세로 새지 않는다
 *
 * 백엔드는 목으로 세운다 — 실제 계정을 건드리지 않는다.
 * 실행: npm run dev 를 띄운 뒤 `node scripts/feed-detail.cjs`
 */
const path = require("path");
const p = require(path.join(__dirname, "..", "node_modules", "puppeteer-core"));

const problems = [];
const ok = (m) => console.log("  · " + m);
const bad = (m) => {
  problems.push(m);
  console.log("  ✗ " + m);
};
const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.SHOT_DIR || path.join(__dirname, "..", "shots");
const fs2 = require("fs");

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const ME = "me-1";
const JWT = [
  b64u({ alg: "HS256", typ: "JWT" }),
  b64u({ planUserId: ME, sub: ME, exp: 9999999999 }),
  "sig",
].join(".");

const POSTS = [
  {
    id: 901,
    categoryName: "스드메",
    title: "세컨드모먼트 스튜디오",
    amount: 230,
    isAmountPublic: true,
    region: "서울 강남구",
    address: "서울 강남구 논현로 842",
    placeId: "p1",
    lat: 37.5112,
    lng: 127.0298,
    rating: 4,
    body: "원본 보정까지 3주 걸렸어요. 야외 촬영은 추가 20만원이고, 실장님 지정하면 30만원 더 붙습니다.",
    authorDDay: 131,
    authorRole: "BRIDE",
    helpfulCount: 12,
    myVote: null,
    isMine: false,
    createDate: "2026-08-14T00:00:00.000Z",
  },
  {
    id: 902,
    categoryName: "청첩장",
    title: "모던하우스 청첩장",
    isAmountPublic: false,
    region: null,
    address: null,
    placeId: null,
    lat: null,
    lng: null,
    rating: 5,
    body: "200장 주문했고 재인쇄 한 번 무료로 해 주셨어요.",
    authorDDay: 88,
    authorRole: "GROOM",
    helpfulCount: 3,
    myVote: null,
    isMine: false,
    createDate: "2026-07-02T00:00:00.000Z",
  },
];

(async () => {
  fs2.mkdirSync(OUT, { recursive: true });
  const br = await p.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: "new",
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--hide-scrollbars",
    ],
  });
  const pg = await br.newPage();
  await pg.setViewport({ width: 390, height: 850, isMobile: true });
  await pg.setRequestInterception(true);
  const hits = [];
  pg.on("request", (r) => {
    const u = r.url();
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "*",
    };
    const json = (b) =>
      r.respond({
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
        body: JSON.stringify(b),
      });
    if (u.includes("dapi.kakao.com")) {
      hits.push("kakao-sdk");
      return r.respond({
        status: 200,
        headers: { "Content-Type": "application/javascript" },
        body: "window.kakao={maps:{load:(cb)=>cb(),LatLng:function(){},Map:function(){return{};},Marker:function(){return{setMap(){}};}}};",
      });
    }
    if (u.includes("/plan/")) {
      if (r.method() === "OPTIONS")
        return r.respond({ status: 204, headers: cors });
      hits.push(
        r.method() + " " + u.replace(/^https?:\/\/[^/]+/, "").split("?")[0],
      );
      if (u.includes("/plan/feed/list"))
        return json({
          result: true,
          data: { total: POSTS.length, list: POSTS },
        });
      if (u.includes("/plan/feed/stats"))
        return json({
          result: true,
          data: {
            total: 1,
            list: [
              {
                categoryName: "스드메",
                total: 61,
                median: 245,
                p25: 180,
                p75: 320,
              },
            ],
          },
        });
      if (u.includes("/plan/feed/my/status"))
        return json({
          result: true,
          data: {
            postCount: 0,
            receivedHelpfulCount: 0,
            postableScheduleCount: 0,
          },
        });
      if (u.includes("/plan/feed/postable"))
        return json({ result: true, data: { total: 0, list: [] } });
      if (u.includes("/plan/category"))
        return json({
          result: true,
          data: {
            total: 1,
            list: [{ id: 1, name: "스드메", color: "#ee2b8c", type: "SYSTEM" }],
          },
        });
      if (u.includes("/plan/user"))
        return json({
          result: true,
          data: {
            planUserId: ME,
            name: "미듀",
            weddingDate: "2026-12-26",
            budget: 3000,
            roomId: null,
            members: [],
            chatRooms: [],
          },
        });
      return json({ result: true, data: { total: 0, list: [] } });
    }
    return r.continue().catch(() => {});
  });
  await pg.evaluateOnNewDocument((t) => {
    localStorage.setItem("plan_auth_token", t);
    sessionStorage.setItem("plan_auth_token", t);
  }, JWT);

  await pg.goto(BASE + "/feed", { waitUntil: "networkidle0", timeout: 120000 });
  await new Promise((r) => setTimeout(r, 2500));

  console.log("1. 카드를 누르면 상세로 가고 요청이 안 나간다");
  hits.length = 0;
  const clicked = await pg.evaluate(() => {
    const a = document.querySelector("article");
    if (!a) return false;
    a.click();
    return true;
  });
  if (!clicked) bad("카드를 못 찾았다");
  await new Promise((r) => setTimeout(r, 2500));

  const url1 = await pg.evaluate(() => location.pathname);
  if (url1 !== "/feed/901") bad("상세로 가지 않았다 (" + url1 + ")");
  else ok("/feed/901 로 갔다");

  /*
    후기 자체를 받으려고 나가는 요청이 없어야 한다. 시세(/plan/feed/stats)는
    상세가 새로 필요로 하는 값이라 한 건 나가는 게 맞다.
  */
  const refetch = hits.filter(
    (h) => h.includes("/plan/feed/list") || h.includes("/plan/feed/9"),
  );
  if (refetch.length) bad("후기를 다시 받았다 — " + JSON.stringify(refetch));
  else ok("후기를 다시 받지 않았다 (목록이 넘긴 항목을 쓴다)");

  console.log("2. 좌표가 있으면 지도를 그린다");
  if (!hits.includes("kakao-sdk")) bad("카카오 SDK 를 부르지 않았다");
  else ok("카카오 SDK 를 불렀다");

  const t1 = await pg.evaluate(() =>
    document.body.innerText.replace(/[\s\u00a0]+/g, " "),
  );
  if (!t1.includes("2,300,000원")) bad("금액이 안 보인다");
  else ok("금액 2,300,000원");
  if (!t1.includes("D-131 신부")) bad("작성자 문장이 안 보인다");
  else ok("D-131 신부");
  console.log("2-1. 같은 카테고리 안에서의 자리");
  // 시세는 뒤이어 오므로 여기서 다시 읽는다
  await new Promise((r) => setTimeout(r, 1500));
  const t1b = await pg.evaluate(() =>
    document.body.innerText.replace(/[\s\u00a0]+/g, " "),
  );
  if (!t1b.includes("스드메 후기 61건 안에서")) bad("시세 줄이 없다");
  else ok("스드메 후기 61건 안에서");
  if (!t1b.includes("중앙값 245만")) bad("중앙값이 없다");
  else ok("중앙값 245만");

  await pg.evaluate(() =>
    document.querySelectorAll("nextjs-portal").forEach((e) => e.remove()),
  );
  await pg.screenshot({ path: path.join(OUT, "feed-detail-map.png") });

  console.log("3. 좌표가 없으면 지도 블록이 아예 없다 (직접 주소로 연다)");
  await pg.goto(BASE + "/feed/902", {
    waitUntil: "networkidle0",
    timeout: 120000,
  });
  await new Promise((r) => setTimeout(r, 2500));
  const t2 = await pg.evaluate(() =>
    document.body.innerText.replace(/[\s\u00a0]+/g, " "),
  );
  const mapH = await pg.evaluate(() => {
    const el = document.querySelector('[class*="h-[168px]"]');
    return el ? el.getBoundingClientRect().height : 0;
  });
  if (mapH) bad("지도 자리가 " + mapH + "px 남아 있다");
  else ok("지도 블록이 없다");
  if (!t2.includes("모던하우스 청첩장")) bad("직접 주소로 못 열었다");
  else ok("직접 주소로도 열린다 (목록에서 찾음)");

  console.log("4. 금액 비공개");
  if (t2.includes("0원")) bad('"0원" 으로 그렸다');
  else if (!t2.includes("금액 비공개")) bad("금액 비공개 문구가 없다");
  else ok("금액 비공개");
  await pg.evaluate(() =>
    document.querySelectorAll("nextjs-portal").forEach((e) => e.remove()),
  );
  await pg.screenshot({ path: path.join(OUT, "feed-detail-nomap.png") });

  console.log("4-1. 금액 비공개면 시세 막대를 내지 않는다");
  if (t2.includes("안에서")) bad("비공개인데 시세 막대가 떴다");
  else ok("시세 막대 없음");

  console.log("5. 카드 안쪽 버튼은 상세로 새지 않는다");
  await pg.goto(BASE + "/feed", { waitUntil: "networkidle0", timeout: 120000 });
  await new Promise((r) => setTimeout(r, 2500));
  const voted = await pg.evaluate(() => {
    const b = document.querySelector('article [aria-label="도움이 돼요"]');
    if (!b) return false;
    b.click();
    return true;
  });
  if (!voted) bad("투표 버튼을 못 찾았다");
  await new Promise((r) => setTimeout(r, 1500));
  const url2 = await pg.evaluate(() => location.pathname);
  if (url2 !== "/feed") bad("투표하려다 상세로 넘어갔다 (" + url2 + ")");
  else ok("투표해도 목록에 머문다");

  await br.close();

  console.log("");
  if (problems.length) {
    console.log("문제 " + problems.length + "건:");
    problems.forEach((m) => console.log(" - " + m));
    process.exitCode = 1;
  } else console.log("후기 상세 이상 없음");
})();
