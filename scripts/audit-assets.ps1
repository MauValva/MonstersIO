$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
public static class AlphaAudit {
 public static long[] Inspect(string path) {
  using(var source = new Bitmap(path))
  using(var bmp = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppArgb)) {
   using(var g = Graphics.FromImage(bmp)) g.DrawImageUnscaled(source,0,0);
   var data = bmp.LockBits(new Rectangle(0,0,bmp.Width,bmp.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
   try {
    byte[] row = new byte[bmp.Width*4]; long transparent=0, partial=0;
    int left=bmp.Width, top=bmp.Height, right=-1, bottom=-1;
    for(int y=0;y<bmp.Height;y++) {
     Marshal.Copy(IntPtr.Add(data.Scan0,y*data.Stride),row,0,row.Length);
     for(int x=0;x<bmp.Width;x++) {
      int alpha=row[x*4+3];
      if(alpha==0) transparent++;
      else { if(alpha<255) partial++; left=Math.Min(left,x); top=Math.Min(top,y); right=Math.Max(right,x); bottom=Math.Max(bottom,y); }
     }
    }
    return new long[]{bmp.Width,bmp.Height,transparent,partial,left,top,right+1,bottom+1};
   } finally { bmp.UnlockBits(data); }
  }
 }
}
'@
$root = (Resolve-Path "$PSScriptRoot/..").Path
$rows = foreach ($file in Get-ChildItem "$root/public/assets" -Recurse -File) {
 $entry = [ordered]@{ path=$file.FullName.Substring($root.Length+1).Replace('\','/'); bytes=$file.Length; sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash }
 if ($file.Extension -match '^\.(png|jpg|jpeg|webp)$') {
  $info = [AlphaAudit]::Inspect($file.FullName)
  $entry.width=$info[0]; $entry.height=$info[1]; $entry.gpuBytes=$info[0]*$info[1]*4
  $entry.transparentPixels=$info[2]; $entry.partialAlphaPixels=$info[3]
  $entry.contentBounds=@($info[4],$info[5],$info[6],$info[7])
 }
 [pscustomobject]$entry
}
New-Item -ItemType Directory -Force "$root/reports" | Out-Null
$rows | ConvertTo-Json -Depth 5 | Set-Content "$root/reports/assets.json" -Encoding UTF8
$rows | Format-Table path,bytes,width,height,gpuBytes,transparentPixels
