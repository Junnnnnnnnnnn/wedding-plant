/* eslint-disable no-console */
/**
 * 시안(docs/concepts/landing-1a-final.html)의 <style> 로 app/landing.css 를 만든다.
 *
 * **랜딩 CSS 를 손으로 고치지 말고 이 스크립트를 다시 돌리세요** — 시안이 원본이다.
 *
 * 왜 파서를 쓰나: 손으로 짠 문자열 치환으로 옮겼다가 주석이 선택자 자리에 끼면서
 * 규칙 두 개가 뒤섞였고, 그 바람에 모바일 리셋(opacity:1)이 통째로 사라져
 * 폰에서 한 화면이 백지였다. 규칙 수·선언 수가 시안과 같은지 검사하고 쓴다.
 */
const fs=require("fs"),postcss=require("postcss");
const src=fs.readFileSync("docs/concepts/landing-1a-final.html","utf8");
let css=src.slice(src.indexOf("<style>")+7,src.indexOf("</style>"));
css=css.replace(/@font-face\s*\{[^}]*\}\s*/g,"");                 // next/font 가 이미 붙인다
css=css.replace('--font-display: "Dgm", system-ui, sans-serif;','--font-display: var(--font-dunggeunmiso), system-ui, sans-serif;');
css=css.replace('--font-body: "Dgm", system-ui, sans-serif;','--font-body: var(--font-dunggeunmiso), system-ui, sans-serif;');
css=css.replace('--font-num: "TmnEB", "Dgm", sans-serif;','--font-num: var(--font-tmoney), var(--font-dunggeunmiso), sans-serif;');

const NEST=new Set(["media","supports","layer","container"]);
const root=postcss.parse(css);
function scopeSel(sel){
  return sel.split(",").map(s=>{
    const t=s.trim();
    if(t===":root"||t==="html"||t==="body") return "#lp";
    return "#lp "+t;
  }).join(",\n");
}
function walk(container){
  container.each(node=>{
    if(node.type==="rule") node.selector=scopeSel(node.selector);
    else if(node.type==="atrule" && NEST.has(node.name.toLowerCase())) walk(node);
  });
}
walk(root);
const out=root.toString();

// 검사 1: 스코프 안 붙은 규칙
const bad=[];
postcss.parse(out).walkRules(r=>{
  // @keyframes 안의 from/to 는 스코프 대상이 아니다
  let p=r.parent, inKf=false;
  while(p){ if(p.type==="atrule" && /keyframes$/i.test(p.name)) inKf=true; p=p.parent; }
  if(!inKf && !r.selector.includes("#lp")) bad.push(r.selector.slice(0,60));
});
// 검사 2: 규칙 수와 선언 수가 시안과 같은지
const cnt=t=>{let r=0,d=0;postcss.parse(t).walkRules(x=>{r++;x.walkDecls(()=>d++)});return[r,d];};
const [r1,d1]=cnt(css), [r2,d2]=cnt(out);
console.log("규칙",r1,"→",r2,"  선언",d1,"→",d2,"  스코프 누락",bad.length);
if(bad.length) bad.slice(0,5).forEach(b=>console.log("  -",b));
if(r1!==r2||d1!==d2||bad.length){ console.log("불일치 — 쓰지 않는다"); process.exit(1); }

fs.writeFileSync("app/landing.css",
`/* 랜딩 전용 스타일. docs/concepts/landing-1a-final.html 의 <style> 을
   PostCSS 로 파싱해 전부 #lp 아래로 스코프한 것이다.
   **손으로 고치지 말고 이 파일을 다시 생성하세요** — 시안이 원본이다.

   왜 스코프가 필요한가: 클래스 이름(.wrap·.sec·.tile…)이 흔한 것도 있지만,
   --color-* 를 :root 에 두면 Tailwind v4 가 테마 색으로 등록해 앱 전체에 샌다.
   폰트는 next/font 가 붙여 둔 --font-dunggeunmiso / --font-tmoney 를 쓴다. */
`+out);
console.log("app/landing.css 재생성");
