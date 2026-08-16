# convert-to-ico.ps1 — convert any common image (png/jpg/bmp/gif) into a
# multi-size Windows .ico (16/32/48/256, PNG-compressed frames). The image is
# contain-fitted into a square with transparent padding (no distortion).
param(
    [Parameter(Mandatory=$true)][string]$InputPath,
    [Parameter(Mandatory=$true)][string]$OutputPath
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile($InputPath)
$pngs = @{}
try {
    foreach ($s in @(256, 48, 32, 16)) {
        $bmp = [System.Drawing.Bitmap]::new($s, $s)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.Clear([System.Drawing.Color]::Transparent)
        $scale = [Math]::Min($s / $src.Width, $s / $src.Height)
        $w = [int][Math]::Round($src.Width * $scale)
        $h = [int][Math]::Round($src.Height * $scale)
        $x = [int](($s - $w) / 2)
        $y = [int](($s - $h) / 2)
        $g.DrawImage($src, $x, $y, $w, $h)
        $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("dshicn-$s-" + [guid]::NewGuid().ToString('N') + '.png')
        $bmp.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
        $pngs[$s] = $tmp
        $g.Dispose(); $bmp.Dispose()
    }
    $fs = [System.IO.File]::Create($OutputPath)
    $bw = New-Object System.IO.BinaryWriter($fs)
    $bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]4)
    $offset = 6 + 16 * 4
    foreach ($s in @(256, 48, 32, 16)) {
        $bytes = [System.IO.File]::ReadAllBytes($pngs[$s])
        $dim = 0; if ($s -lt 256) { $dim = $s }
        $bw.Write([byte]$dim); $bw.Write([byte]$dim)
        $bw.Write([byte]0); $bw.Write([byte]0)
        $bw.Write([uint16]1); $bw.Write([uint16]32)
        $bw.Write([uint32]$bytes.Length); $bw.Write([uint32]$offset)
        $offset += $bytes.Length
    }
    foreach ($s in @(256, 48, 32, 16)) { $bw.Write([System.IO.File]::ReadAllBytes($pngs[$s])) }
    $bw.Close(); $fs.Close()
    Write-Output "OK $OutputPath"
} finally {
    $src.Dispose()
    foreach ($tmp in $pngs.Values) { Remove-Item $tmp -ErrorAction SilentlyContinue }
}
