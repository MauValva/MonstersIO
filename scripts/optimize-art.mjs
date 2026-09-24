// Deterministic derivatives only: source artwork is never written.
import sharp from 'sharp';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const group = process.argv[2] ?? 'props';
const plans = {
  props: [
    { key: 'enemy', source: 'Enemy/Enemies.png', columns: 2, rows: 1, frameWidth: 256, frameHeight: 256, padding: 2, display: [166,166] },
    { key: 'plant', source: 'Environment/Plant.png', columns: 1, rows: 1, frameWidth: 512, frameHeight: 461, padding: 0, display: [348,348] },
    { key: 'upgradeBase', source: 'Environment/UpgradeBase.png', columns: 1, rows: 1, frameWidth: 384, frameHeight: 375, padding: 0, display: [220,224] },
    { key: 'enemyNest', source: 'Environment/enemyNest.png', columns: 2, rows: 1, frameWidth: 384, frameHeight: 384, padding: 2, display: [296,296] },
  ],
  eggs: [{ key: 'eggs', source: 'Eggs/spr_Eggs.png', columns: 5, rows: 3, frameWidth: 180, frameHeight: 150, padding: 2, display: [140,117] }],
  ground: [{ key: 'ground', source: 'Environment/Tile_Ground_V2.png', columns: 3, rows: 1, frameWidth: 512, frameHeight: 512, padding: 2, repeat: true, display: [390,390] }],
};
assert.ok(plans[group], 'Choose props, eggs or ground');
const outDir = 'public/assets/Optimized';
const reportDir = 'reports/stage2';
mkdirSync(outDir, { recursive: true });
mkdirSync(`${reportDir}/comparisons`, { recursive: true });
const reportPath = `${reportDir}/assets.json`;
const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath)) : {};
const audit = JSON.parse(readFileSync('reports/assets.json','utf8').replace(/^\uFEFF/,''));
const hash = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();

for (const plan of plans[group]) {
  const sourcePath = `public/assets/Arts/${plan.source}`;
  const original = readFileSync(sourcePath);
  assert.equal(hash(original), audit.find(a=>a.path===sourcePath).sha256, `Source changed: ${sourcePath}`);
  const metadata = await sharp(original).metadata();
  const { columns, rows, frameWidth: fw, frameHeight: fh, padding: p } = plan;
  const width = columns*(fw+2*p), height = rows*(fh+2*p);
  const atlas = Buffer.alloc(width*height*4);
  const frames = [];
  const compareParts = [];
  const [dw,dh] = plan.display;
  const cellWidth = dw*2+30, cellHeight = dh+42;
  const compareColumns = Math.min(columns, 3);
  let maxDisplayDifference = 0;
  for(let index=0;index<columns*rows;index++) {
    const col=index%columns, row=Math.floor(index/columns);
    // Round only source pixel boundaries. Logical dimensions remain the original
    // fractional grid, and the destination content frames are all identical integers.
    const left=Math.round(col*metadata.width/columns), top=Math.round(row*metadata.height/rows);
    const right=Math.round((col+1)*metadata.width/columns), bottom=Math.round((row+1)*metadata.height/rows);
    const sourceFrame = await sharp(original).extract({left,top,width:right-left,height:bottom-top}).png().toBuffer();
    let rgba;
    if(plan.repeat) {
      // Periodic filtering: resize the centre of a 3x3 repetition, rather than
      // blending with a different artwork in the neighbouring atlas cell.
      const repeated = await sharp({create:{width:(right-left)*3,height:(bottom-top)*3,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
        .composite(Array.from({length:9},(_,i)=>({input:sourceFrame,left:(i%3)*(right-left),top:Math.floor(i/3)*(bottom-top)})))
        .png().toBuffer();
      const resized = await sharp(repeated).resize(fw*3,fh*3,{fit:'fill',kernel:'lanczos3'}).png().toBuffer();
      rgba = await sharp(resized).extract({left:fw,top:fh,width:fw,height:fh}).ensureAlpha().raw().toBuffer();
    } else {
      // libvips premultiplies alpha during resize, avoiding white/dark fringes.
      rgba = await sharp(sourceFrame).resize(fw,fh,{fit:'fill',kernel:'lanczos3'}).ensureAlpha().raw().toBuffer();
    }
    const x=col*(fw+2*p)+p,y=row*(fh+2*p)+p;
    frames.push({x,y,width:fw,height:fh,sourceBounds:{left,top,right,bottom}});
    for(let py=-p;py<fh+p;py++) for(let px=-p;px<fw+p;px++) {
      const sx=plan.repeat?(px+fw)%fw:Math.max(0,Math.min(fw-1,px));
      const sy=plan.repeat?(py+fh)%fh:Math.max(0,Math.min(fh-1,py));
      rgba.copy(atlas,((y+py)*width+x+px)*4,(sy*fw+sx)*4,(sy*fw+sx)*4+4);
    }
    const derivedFrame=await sharp(rgba,{raw:{width:fw,height:fh,channels:4}}).png().toBuffer();
    const oldDisplay=await sharp(sourceFrame).resize(dw,dh,{fit:'fill',kernel:'lanczos3'}).flatten({background:'#28423d'}).raw().toBuffer();
    const newDisplay=await sharp(derivedFrame).resize(dw,dh,{fit:'fill',kernel:'lanczos3'}).flatten({background:'#28423d'}).raw().toBuffer();
    let error=0; for(let i=0;i<oldDisplay.length;i++) error+=Math.abs(oldDisplay[i]-newDisplay[i]);
    maxDisplayDifference=Math.max(maxDisplayDifference,error/oldDisplay.length);
    const cx=(index%compareColumns)*cellWidth, cy=Math.floor(index/compareColumns)*cellHeight;
    compareParts.push({input:await sharp(oldDisplay,{raw:{width:dw,height:dh,channels:3}}).png().toBuffer(),left:cx,top:cy+30});
    compareParts.push({input:await sharp(newDisplay,{raw:{width:dw,height:dh,channels:3}}).png().toBuffer(),left:cx+dw+12,top:cy+30});
    const label=Buffer.from(`<svg width="${cellWidth}" height="24"><text x="0" y="18" font-family="Arial" font-size="12" fill="white">${plan.key} ${index}: antes | depois (DPR 2)</text></svg>`);
    compareParts.push({input:label,left:cx,top:cy});
  }
  const outputName=plan.source.split('/').at(-1);
  const outputPath=`${outDir}/${outputName}`;
  await sharp(atlas,{raw:{width,height,channels:4}}).png({compressionLevel:9,adaptiveFiltering:true,palette:false}).toFile(outputPath);
  // Comparison only. WebP is intentionally outside public/dist.
  const webpPath=`${reportDir}/comparisons/${outputName.replace('.png','.webp')}`;
  await sharp(outputPath).webp({lossless:true,effort:6}).toFile(webpPath);
  const pngPixels=await sharp(outputPath).ensureAlpha().raw().toBuffer();
  const webpPixels=await sharp(webpPath).ensureAlpha().raw().toBuffer();
  let visibleDifferences=0,alphaDifferences=0;
  for(let i=0;i<pngPixels.length;i+=4) {
    if(pngPixels[i+3]!==webpPixels[i+3]) alphaDifferences++;
    if(pngPixels[i+3] && (pngPixels[i]!==webpPixels[i] || pngPixels[i+1]!==webpPixels[i+1] || pngPixels[i+2]!==webpPixels[i+2])) visibleDifferences++;
  }
  assert.equal(alphaDifferences,0); assert.equal(visibleDifferences,0);
  const comparisonPath=`${reportDir}/comparisons/${plan.key}.png`;
  await sharp({create:{width:compareColumns*cellWidth,height:Math.ceil(columns*rows/compareColumns)*cellHeight,channels:4,background:'#192b30'}})
    .composite(compareParts).png().toFile(comparisonPath);
  report[plan.key]={...plan,sourcePath,outputPath,webpPath,comparisonPath,originalWidth:metadata.width,originalHeight:metadata.height,
    originalBytes:original.length,originalHash:hash(original),width,height,frames,
    pngBytes:statSync(outputPath).size,webpBytes:statSync(webpPath).size,
    visibleDifferences,alphaDifferences,maxDisplayMeanAbsoluteError:maxDisplayDifference};
  assert.equal(hash(readFileSync(sourcePath)),hash(original));
  console.log(`${plan.key}: ${metadata.width}x${metadata.height} -> ${width}x${height}; PNG ${report[plan.key].pngBytes}; lossless WebP ${report[plan.key].webpBytes}; visible RGBA differences ${visibleDifferences}/${alphaDifferences}`);
}
writeFileSync(reportPath,JSON.stringify(report,null,2));
