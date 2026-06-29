Add-Type -AssemblyName System.Drawing

$publicDir = Join-Path $PSScriptRoot '..\public'
$path = Join-Path $publicDir 'kiterp-logo-source.png'
if (-not (Test-Path $path)) {
  Write-Error "Missing source logo: $path"
  exit 1
}

$bitmap = [System.Drawing.Bitmap]::FromFile($path)
$w = $bitmap.Width
$h = $bitmap.Height
Write-Output "Original: ${w}x${h}"

function Test-BackgroundColor([System.Drawing.Color]$c) {
  if ($c.A -lt 16) { return $true }
  # Drop outer black canvas and near-black shadows.
  if ($c.R -lt 28 -and $c.G -lt 28 -and $c.B -lt 28) { return $true }
  return $false
}

$minX = $w
$minY = $h
$maxX = 0
$maxY = 0

for ($y = 0; $y -lt $h; $y++) {
  for ($x = 0; $x -lt $w; $x++) {
    $c = $bitmap.GetPixel($x, $y)
    if (Test-BackgroundColor $c) { continue }
    if ($x -lt $minX) { $minX = $x }
    if ($y -lt $minY) { $minY = $y }
    if ($x -gt $maxX) { $maxX = $x }
    if ($y -gt $maxY) { $maxY = $y }
  }
}

if ($maxX -lt $minX -or $maxY -lt $minY) {
  Write-Error 'Could not detect logo bounds'
  exit 1
}

$pad = 1
$minX = [Math]::Max(0, $minX - $pad)
$minY = [Math]::Max(0, $minY - $pad)
$maxX = [Math]::Min($w - 1, $maxX + $pad)
$maxY = [Math]::Min($h - 1, $maxY + $pad)
$cropW = $maxX - $minX + 1
$cropH = $maxY - $minY + 1
$size = [Math]::Max($cropW, $cropH)
$centerX = [Math]::Floor(($minX + $maxX) / 2)
$centerY = [Math]::Floor(($minY + $maxY) / 2)
$half = [Math]::Floor($size / 2)
$sqMinX = [Math]::Max(0, $centerX - $half)
$sqMinY = [Math]::Max(0, $centerY - $half)
if ($sqMinX + $size -gt $w) { $sqMinX = [Math]::Max(0, $w - $size) }
if ($sqMinY + $size -gt $h) { $sqMinY = [Math]::Max(0, $h - $size) }
$size = [Math]::Min($size, [Math]::Min($w - $sqMinX, $h - $sqMinY))

Write-Output "Crop: x=$sqMinX y=$sqMinY size=$size"

$rect = New-Object System.Drawing.Rectangle($sqMinX, $sqMinY, $size, $size)
$cropped = $bitmap.Clone($rect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

function Save-Size($img, [int]$outSize, [string]$out) {
  $dest = New-Object System.Drawing.Bitmap($outSize, $outSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($dest)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($img, 0, 0, $outSize, $outSize)
  $g.Dispose()
  $dest.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $dest.Dispose()
}

Save-Size $cropped 32 (Join-Path $publicDir 'favicon-32.png')
Save-Size $cropped 64 (Join-Path $publicDir 'favicon-64.png')
Save-Size $cropped 192 (Join-Path $publicDir 'favicon-192.png')
Save-Size $cropped 512 (Join-Path $publicDir 'favicon.png')

$bitmap.Dispose()
$cropped.Dispose()
Write-Output 'Done'
