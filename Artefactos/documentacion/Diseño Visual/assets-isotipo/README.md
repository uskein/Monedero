# Assets del isotipo «M»

Fuente de verdad del isotipo: **manual-identidad-visual.md §9** (tile «M» · fondo `#2F7D5B` · letra blanca Fraunces 700 · variante Principal).

## Contenido

| Archivo | Descripción |
|---|---|
| `Fraunces-700.ttf` | Instancia estática weight 700 de **Fraunces** (Google Fonts, licencia SIL OFL 1.1). Familia interna: `Fraunces NonWonky` (build estático por defecto de Google). |
| `generar-isotipo.ps1` | Script GDI+ (PowerShell) que rastrea la «M» y compone los PNG con centrado óptico por cap-height (0.701em medido). |

## Salidas que regenera

| Ruta | Tamaño | Tratamiento |
|---|---|---|
| `apps/mobile/assets/icon.png` | 1024² | Full-bleed `#2F7D5B`, «M» al 50% del lienzo (iOS/legacy; el SO aplica su máscara). |
| `apps/mobile/assets/adaptive-icon.png` | 1024² | Transparente, «M» al 44% (zona segura adaptativa 66/108). |
| `apps/web/public/icons/icon-192.png` | 192² | Full-bleed (PWA `purpose: any`, favicon). |
| `apps/web/public/icons/icon-512.png` | 512² | Full-bleed, «M» al 44% (PWA `purpose: maskable`, círculo 80%). |

## Regenerar

```powershell
# La fuente vive en este folder; el script apunta a su propia ubicación.
& "assets-isotipo\generar-isotipo.ps1"
```

> Nota: `apps/mobile/android/` es generado (gitignored). Tras regenerar `icon.png`/`adaptive-icon.png`
> ejecutar `npx expo prebuild -p android --no-install` para copiar los recursos y reconstruir el APK.

## Próhibiciones aplicadas (§9)

Sin degradados, sin contornos, sin sombras nuevas, sin recolorear la «M»: variante **Principal** plana en todos los formatos.
