import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base=process.env.FULL_REPORT_UI_BASE || 'http://localhost:3001';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const browser=await chromium.launch();
try {
 const page=await browser.newPage();
 await page.goto(`${base}/test-full-report`);
 const hub=page.locator('[data-report-hub]');
 const opener=page.getByRole('button',{name:'생성된 Skin Match 플랜 열기',exact:true});
 for(let i=0;i<60&&!await hub.isVisible();i++) { if(await opener.isVisible()){await opener.click();break;} await page.waitForTimeout(500); }
 await hub.waitFor();
 for(const width of [320,390,430,1024]) {
  await page.setViewportSize({width,height:844});
  for(const theme of ['light','dark']) {
   await page.evaluate(theme=>document.documentElement.classList.toggle('dark',theme==='dark'),theme);
   const bounds=await hub.locator('[data-hub-sector]').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();const text=node.querySelector('[class*=cardHeading]');return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,font:parseFloat(getComputedStyle(text).fontSize)};}));
   assert.equal(bounds.length,4);
   const frame=await hub.boundingBox();
   for(const r of bounds) assert.ok(r.x>=frame.x && r.right<=frame.x+frame.width, 'all sector controls stay inside the visible hub');
   for(const r of bounds){assert.ok(r.width>=44&&r.height>=44);assert.ok(r.font>=14);}
   assert.ok(bounds[0].right <= bounds[1].x && bounds[2].right <= bounds[3].x, 'sector controls do not overlap horizontally');
   assert.equal(bounds[0].y, bounds[1].y, 'first row aligned');
   assert.equal(bounds[2].y, bounds[3].y, 'second row aligned');
   assert.ok(bounds[0].bottom < bounds[2].y, 'rows do not overlap');
   assert.deepEqual(await hub.locator('[data-hub-sector]').evaluateAll(nodes=>nodes.map(n=>n.dataset.hubSector)), ['routine','tracking','functional','condition']);
   const dock=await hub.locator('a[href="#skin-match-input-context"]').boundingBox();
   assert.ok(Math.max(...bounds.map(r=>r.bottom)) <= dock.y, 'sector labels stay above the dock');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:`artifacts/full-report-four-sector/actual-test-hub-${width}-${theme}.png`,fullPage:true,style:'nextjs-portal { visibility: hidden }'});
  }
 }
 await hub.getByRole('button', {name: /Face Lab에서 더 자세히/}).click();
 assert.equal(await page.locator('[data-report-hub]').count(),0);
 assert.match(await page.locator('body').innerText(), /Face Lab/);
 console.log('Actual /test-full-report: 320/390/430/1024 Light/Dark, readable labels, separated controls, dock clearance, no horizontal overflow: PASS');
} finally { await browser.close(); }
