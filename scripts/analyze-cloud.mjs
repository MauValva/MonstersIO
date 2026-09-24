// Read native pixels directly; never draw through a DPI-aware graphics context.
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
const path='public/assets/Arts/Player/PlayerCloud.png';
const {data,info}=await sharp(path).ensureAlpha().raw().toBuffer({resolveWithObject:true});
let left=info.width,top=info.height,right=-1,bottom=-1,transparentPixels=0,partialAlphaPixels=0;
for(let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) {
  const alpha=data[(y*info.width+x)*4+3];
  if(!alpha) transparentPixels++;
  else {
    if(alpha<255) partialAlphaPixels++;
    left=Math.min(left,x); top=Math.min(top,y); right=Math.max(right,x); bottom=Math.max(bottom,y);
  }
}
const result={path,...info,bounds:{x:left,y:top,width:right-left+1,height:bottom-top+1},transparentPixels,partialAlphaPixels};
writeFileSync('reports/stage2/cloud-analysis.json',JSON.stringify(result,null,2));
console.log(result.bounds);
