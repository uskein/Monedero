# Genera el isotipo "M" de Monedero (manual de identidad, seccion 9):
#   fondo #2F7D5B · "M" #FFFFFF Fraunces 700 · flat (variante Principal).
# Salidas: icono movil 1024 (full-bleed), foreground adaptativo 1024 (transparente),
#          iconos PWA 192 (any) y 512 (maskable, padding generoso).
# Rutas relativas al propio script: ejecutable desde cualquier maquina del repo.
Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path   # raiz del repo
$fontPath = Join-Path $PSScriptRoot 'Fraunces-700.ttf'
$outMobile = Join-Path $root 'apps\mobile\assets'
$outWeb = Join-Path $root 'apps\web\public\icons'
$bg = [System.Drawing.Color]::FromArgb(255, 0x2F, 0x7D, 0x5B)   # cs-primary
$white = [System.Drawing.Color]::White

New-Item -ItemType Directory -Force -Path $outMobile, $outWeb | Out-Null

$pfc = New-Object System.Drawing.Text.PrivateFontCollection
$pfc.AddFontFile($fontPath)
$family = $pfc.Families[0]
Write-Host "fuente: $($family.Name)"

# -- Metricas: cap-height y ancho de la "M" a 1000px (razon constante) --
function Get-Metrics([float]$fontPx) {
  $f = [System.Drawing.Font]::new($family, $fontPx, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $sz = [int]($fontPx * 2)
  $bmp = [System.Drawing.Bitmap]::new($sz, $sz, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
  [void]$g.DrawString('M', $f, [System.Drawing.Brushes]::White, ([float]($sz / 8)), ([float]($sz / 8)))
  $g.Dispose()
  $left = $sz; $top = $sz; $right = 0; $bottom = 0
  for ($y = 0; $y -lt $sz; $y++) {
    for ($x = 0; $x -lt $sz; $x++) {
      if ($bmp.GetPixel($x, $y).A -gt 24) {
        if ($x -lt $left) { $left = $x }; if ($x -gt $right) { $right = $x }
        if ($y -lt $top) { $top = $y }; if ($y -gt $bottom) { $bottom = $y }
      }
    }
  }
  $bmp.Dispose(); $f.Dispose()
  return [pscustomobject]@{
    W = ($right - $left + 1); H = ($bottom - $top + 1)
    OffX = ($left - $sz / 8); OffY = ($top - $sz / 8)   # desplazamiento del glyph en el em box
  }
}
$m = Get-Metrics 1000
$ratioW = $m.W / 1000.0; $ratioH = $m.H / 1000.0; $offXR = $m.OffX / 1000.0; $offYR = $m.OffY / 1000.0
Write-Host "metricas: W=$($m.W) H=$($m.H) Off=($($m.OffX),$($m.OffY)) por 1000px"

# -- Compone un icono: capH = altura objetivo de la "M" en px --
function New-Icon([int]$size, [float]$capH, [bool]$transparentBg, [string]$path) {
  $fontPx = $capH / $ratioH
  $glyphW = $fontPx * $ratioW
  $x = ($size - $glyphW) / 2 - ($fontPx * $offXR)
  $y = ($size - $capH) / 2 - ($fontPx * $offYR)
  $fmt = [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  $bmp = [System.Drawing.Bitmap]::new($size, $size, $fmt)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
  if (-not $transparentBg) { $g.Clear($bg) } else { $g.Clear([System.Drawing.Color]::Transparent) }
  $f = [System.Drawing.Font]::new($family, $fontPx, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $sf = New-Object System.Drawing.StringFormat
  $sf.FormatFlags = [System.Drawing.StringFormatFlags]::MeasureTrailingSpaces
  $g.DrawString('M', $f, (New-Object System.Drawing.SolidBrush $white), ([float]$x), ([float]$y), $sf)
  $g.Dispose(); $f.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
  Write-Host "-> $path ($size px)"
}

# Movil: icon.png full-bleed (iOS/legacy enmascara el sistema) - M al 50% del lienzo
New-Icon 1024 (1024 * 0.50) $false "$outMobile\icon.png"
# Android adaptive foreground: transparente, M al 44% (zona segura 66/108)
New-Icon 1024 (1024 * 0.44) $true  "$outMobile\adaptive-icon.png"
# PWA: 192 "any" full-bleed y 512 "maskable" (circulo 80% -> M al 44%)
New-Icon 192  (192 * 0.50) $false "$outWeb\icon-192.png"
New-Icon 512  (512 * 0.44) $false "$outWeb\icon-512.png"
Write-Host 'LISTO'
