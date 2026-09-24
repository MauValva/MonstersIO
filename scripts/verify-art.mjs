import sharp from 'sharp';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const assets=JSON.parse(readFileSync('reports/stage2/assets.json','utf8'));
let guards=0;
for(const asset of Object.values(assets)) {
  assert.equal(createHash('sha256').update(readFileSync(asset.sourcePath)).digest('hex').toUpperCase(),asset.originalHash);
  const raw=await sharp(asset.outputPath).ensureAlpha().raw().toBuffer();
  for(const frame of asset.frames) {
    assert.ok([frame.x,frame.y,frame.width,frame.height].every(Number.isInteger));
    const p=asset.padding;
    for(let y=-p;y<frame.height+p;y++) for(let x=-p;x<frame.width+p;x++) {
      if(x>=0&&x<frame.width&&y>=0&&y<frame.height) continue;
      const sx=asset.repeat?(x+frame.width)%frame.width:Math.max(0,Math.min(frame.width-1,x));
      const sy=asset.repeat?(y+frame.height)%frame.height:Math.max(0,Math.min(frame.height-1,y));
      const index=((frame.y+y)*asset.width+frame.x+x)*4;
      const expected=((frame.y+sy)*asset.width+frame.x+sx)*4;
      assert.deepEqual(raw.subarray(index,index+4),raw.subarray(expected,expected+4)); guards++;
    }
  }
}
// Software comparison of repetitions. These are reference images, not GPU screenshots.
const ground=assets.ground;
const seams=[];
for(let index=0;index<3;index++) {
  const frame=ground.frames[index];
  const old=await sharp(ground.sourcePath).extract({left:index*724,top:0,width:724,height:724}).resize(195,195,{kernel:'lanczos3'}).png().toBuffer();
  const next=await sharp(ground.outputPath).extract({left:frame.x,top:frame.y,width:frame.width,height:frame.height}).resize(195,195,{kernel:'lanczos3'}).png().toBuffer();
  const layers=[];
  for(let y=0;y<3;y++) for(let x=0;x<3;x++) {
    layers.push({input:old,left:x*195,top:y*195});
    layers.push({input:next,left:597+x*195,top:y*195});
  }
  await sharp({create:{width:1182,height:585,channels:4,background:'#192b30'}}).composite(layers).png().toFile(`reports/stage2/comparisons/ground-repeat-${index}.png`);
  const edgeError=async input=>{
    const data=await sharp(input).removeAlpha().raw().toBuffer();let horizontal=0,vertical=0;
    for(let i=0;i<195;i++) for(let c=0;c<3;c++) {
      horizontal+=Math.abs(data[(i*195)*3+c]-data[(i*195+194)*3+c]);
      vertical+=Math.abs(data[i*3+c]-data[(194*195+i)*3+c]);
    }
    return {horizontal:horizontal/(195*3),vertical:vertical/(195*3)};
  };
  seams.push({frame:index,before:await edgeError(old),after:await edgeError(next)});
}
writeFileSync('reports/stage2/seams.json',JSON.stringify(seams,null,2));
console.log(`PASS: ${Object.keys(assets).length} derivative sources intact; integer content frames; ${guards} edge guards match; repeat comparison images generated.`);
