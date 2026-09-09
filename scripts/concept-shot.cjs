/* eslint-disable no-console */
/**
 * 시안 HTML 을 그대로 찍는다 (`docs/concepts/*.html`).
 *
 * 시안은 앱이 아니라 문서라 dev 서버가 필요 없다. 파일을 열어 전체 높이로
 * 한 장, 그리고 `--clip <선택자>` 를 주면 그 부분만 한 장 더 찍는다.
 *
 * 실행: node scripts/concept-shot.cjs docs/concepts/brag-a.html
 *   OUT=__shots/brag  저장 위치 (기본 `__shots/concept`)
 *   W=1280            문서 폭
 *   CLIP=".step:nth-of-type(3)"  그 요소만 따로 한 장
 */
const fs = require("fs");
const path = require("path");
const url = require("url");
const p = require("puppeteer-core");

const CHROME =
  process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = process.env.OUT || path.join(__dirname, "..", "__shots", "concept");
const WIDTH = Number(process.env.W || 1280);

(async () => {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error("쓸 파일을 하나 이상 주세요");
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await p.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--font-render-hinting=none", "--no-sandbox"],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));

  for (const f of files) {
    const abs = path.resolve(f);
    const name = path.basename(abs, path.extname(abs));
    await page.setViewport({ width: WIDTH, height: 1000, deviceScaleFactor: 1 });
    await page.goto(url.pathToFileURL(abs).href, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 400));

    // 가로 넘침은 시안에서도 문제다 — 문서 폭을 넘으면 알려 준다
    const over = await page.evaluate(() => ({
      docW: document.documentElement.scrollWidth,
      winW: window.innerWidth,
      h: document.documentElement.scrollHeight,
    }));
    if (over.docW > over.winW + 1)
      console.log(`  ! ${name}: 가로로 ${over.docW - over.winW}px 넘친다`);

    await page.screenshot({
      path: path.join(OUT, `${name}.png`),
      fullPage: true,
    });
    console.log(`캡처 ${name}.png  높이=${over.h}px`);

    if (process.env.CLIP) {
      const el = await page.$(process.env.CLIP);
      if (el) {
        await el.screenshot({ path: path.join(OUT, `${name}-clip.png`) });
        console.log(`캡처 ${name}-clip.png  (${process.env.CLIP})`);
      } else {
        console.log(`  ! ${process.env.CLIP} 을 못 찾았다`);
      }
    }
  }

  await browser.close();
  if (errors.length) {
    console.log("\n스크립트 오류:\n - " + errors.join("\n - "));
    process.exit(1);
  }
})();
