/**
 * Exportación de reportes (HU-13 · BP-07) — PDF (expo-print) e imagen
 * (react-native-view-shot), compartidos con expo-sharing (todos en Expo Go).
 * buildReportHtml es PURO y sin nativos: recibe cadenas ya traducidas/
 * formateadas (i18n y money en el caller) + los colores token activos —
 * testeable sin device. El glue nativo usa imports DINÁMICOS (jest seguro).
 */

export interface ReportExportCategory {
  name: string;
  amountText: string;
  percent: number;
  /** Valor token activo (tema claro u oscuro). */
  color: string;
}

export interface ReportExportTxRow {
  dateText: string;
  payee: string;
  category: string;
  typeLabel: string;
  amountText: string;
  kind: 'income' | 'expense' | 'transfer';
}

export interface ReportHtmlColors {
  bgBase: string;
  surface: string;
  surfaceSunken: string;
  primary: string;
  primarySoft: string;
  accent: string;
  secondary: string;
  textPrimary: string;
  textMuted: string;
  danger: string;
  textOnPrimary: string;
  tileBg: string;
  tileLetter: string;
  tileFont: string;
}

export interface ReportHtmlInput {
  monthLabel: string;
  tagline: string;
  labels: {
    chart: string;
    movements: string;
    income: string;
    expense: string;
    balance: string;
    date: string;
    payee: string;
    category: string;
    type: string;
    amount: string;
  };
  incomeText: string;
  expenseText: string;
  balanceText: string;
  /** Centavos para las barras comparativas de la tarjeta-resumen. */
  reportMax: { income: number; expense: number; max: number };
  categories: ReportExportCategory[];
  transactions: ReportExportTxRow[];
  colors: ReportHtmlColors;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * HTML del reporte mensual (impresión A4): encabezado de marca, gráfico de
 * gastos por categoría, tabla con TODOS los movimientos del mes y, AL FINAL,
 * la tarjeta-resumen con identidad visual (ingresos · gastos · balance).
 */
export function buildReportHtml(input: ReportHtmlInput): string {
  const { colors: c } = input;

  const categoryRows = input.categories
    .map(
      (cat) => `
      <tr>
        <td><span class="dot" style="background:${cat.color}"></span>${esc(cat.name)}</td>
        <td class="bar-cell">
          <div class="bar"><div class="bar-fill" style="width:${Math.min(100, cat.percent).toFixed(1)}%;background:${cat.color}"></div></div>
        </td>
        <td class="num">${esc(cat.amountText)}</td>
        <td class="num muted">${Math.round(cat.percent)} %</td>
      </tr>`,
    )
    .join('');

  const txRows = input.transactions
    .map(
      (tx) => `
      <tr>
        <td class="muted">${esc(tx.dateText)}</td>
        <td>${esc(tx.payee)}</td>
        <td class="muted">${esc(tx.category)}</td>
        <td class="muted">${esc(tx.typeLabel)}</td>
        <td class="num ${tx.kind === 'income' ? 'income' : ''}">${esc(tx.amountText)}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<style>
  @page { margin: 18mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: ${c.textPrimary}; background: ${c.bgBase}; margin: 0; }
  .brand { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid ${c.surfaceSunken}; padding-bottom: 12px; }
  .tile { width: 44px; height: 44px; border-radius: 12px; background: ${c.tileBg}; color: ${c.tileLetter}; font-family: ${c.tileFont}, serif; font-weight: 700; font-size: 26px; display: flex; align-items: center; justify-content: center; }
  .brand h1 { font-size: 22px; margin: 0; }
  .brand .month { color: ${c.textMuted}; font-size: 13px; margin-top: 2px; }
  .tagline { color: ${c.textMuted}; font-size: 11px; margin: 8px 0 0; }
  h2 { font-size: 15px; margin: 22px 0 8px; }
  table { width: 100%; border-collapse: collapse; background: ${c.surface}; border-radius: 10px; overflow: hidden; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: ${c.textMuted}; padding: 8px 10px; background: ${c.surfaceSunken}; }
  td { font-size: 12px; padding: 7px 10px; border-top: 1px solid ${c.surfaceSunken}; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  .muted { color: ${c.textMuted}; }
  .income { color: ${c.primary}; font-weight: 600; }
  .dot { display: inline-block; width: 10px; height: 10px; border-radius: 5px; margin-right: 8px; }
  .bar-cell { width: 34%; }
  .bar { height: 10px; background: ${c.surfaceSunken}; border-radius: 5px; overflow: hidden; }
  .bar-fill { height: 10px; border-radius: 5px; }
  .summary { margin-top: 26px; background: ${c.surface}; border: 1px solid ${c.surfaceSunken}; border-radius: 16px; padding: 18px; }
  .summary .head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .summary .head .tile { width: 36px; height: 36px; font-size: 20px; border-radius: 10px; }
  .summary .head h3 { margin: 0; font-size: 15px; }
  .stats { display: flex; gap: 10px; }
  .stat { flex: 1; background: ${c.bgBase}; border-radius: 12px; padding: 12px; }
  .stat .label { font-size: 11px; color: ${c.textMuted}; }
  .stat .value { font-size: 17px; font-weight: 700; margin-top: 4px; }
  .stat .value.income { color: ${c.primary}; }
  .stat .value.expense { color: ${c.accent}; }
  .stat .value.balance { color: ${c.secondary}; }
  .compare { margin-top: 12px; }
  .compare .row { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
  .compare .label { font-size: 11px; color: ${c.textMuted}; width: 90px; }
  .compare .track { flex: 1; height: 12px; background: ${c.surfaceSunken}; border-radius: 6px; overflow: hidden; }
  .compare .fill { height: 12px; border-radius: 6px; }
</style>
</head>
<body>
  <div class="brand">
    <div class="tile">M</div>
    <div>
      <h1>Monedero</h1>
      <div class="month">${esc(input.monthLabel)}</div>
    </div>
  </div>
  <p class="tagline">${esc(input.tagline)}</p>

  <h2>${esc(input.labels.chart)}</h2>
  <table>
    <thead><tr><th>${esc(input.labels.category)}</th><th></th><th class="num">${esc(input.labels.amount)}</th><th class="num">%</th></tr></thead>
    <tbody>${categoryRows || `<tr><td colspan="4" class="muted">—</td></tr>`}</tbody>
  </table>

  <h2>${esc(input.labels.movements)}</h2>
  <table>
    <thead><tr>
      <th>${esc(input.labels.date)}</th><th>${esc(input.labels.payee)}</th>
      <th>${esc(input.labels.category)}</th><th>${esc(input.labels.type)}</th>
      <th class="num">${esc(input.labels.amount)}</th>
    </tr></thead>
    <tbody>${txRows || `<tr><td colspan="5" class="muted">—</td></tr>`}</tbody>
  </table>

  <!-- Tarjeta-resumen con identidad: ingresos · gastos · balance + gráfico -->
  <div class="summary">
    <div class="head">
      <div class="tile">M</div>
      <h3>${esc(input.monthLabel)}</h3>
    </div>
    <div class="stats">
      <div class="stat"><div class="label">${esc(input.labels.income)}</div><div class="value income">${esc(input.incomeText)}</div></div>
      <div class="stat"><div class="label">${esc(input.labels.expense)}</div><div class="value expense">${esc(input.expenseText)}</div></div>
      <div class="stat"><div class="label">${esc(input.labels.balance)}</div><div class="value balance">${esc(input.balanceText)}</div></div>
    </div>
    <div class="compare">
      <div class="row">
        <div class="label">${esc(input.labels.income)}</div>
        <div class="track"><div class="fill" style="width:${((input.reportMax?.income ?? 0) / (input.reportMax?.max ?? 1)) * 100}%;background:${c.primary}"></div></div>
      </div>
      <div class="row">
        <div class="label">${esc(input.labels.expense)}</div>
        <div class="track"><div class="fill" style="width:${((input.reportMax?.expense ?? 0) / (input.reportMax?.max ?? 1)) * 100}%;background:${c.accent}"></div></div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/** Comparte el PDF generado (expo-print + expo-sharing; fallback al diálogo de impresión). */
export async function shareReportPdf(html: string): Promise<void> {
  let uri: string;
  try {
    const Print = await import('expo-print');
    uri = (await Print.printToFileAsync({ html })).uri;
  } catch (err) {
    // Etapa 1: generación del archivo (la más frágil en algunos dispositivos).
    if (__DEV__) console.warn('[monedero] export pdf: printToFileAsync falló', err);
    throw new Error(`PDF_PRINT_FAILED: ${err instanceof Error ? err.message : String(err)}`);
  }
  try {
    const Sharing = await import('expo-sharing');
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Monedero' });
      return;
    }
  } catch (err) {
    if (__DEV__) console.warn('[monedero] export pdf: shareAsync falló', err);
    // Sin compartir → cae al diálogo de impresión del sistema.
  }
  try {
    const Print = await import('expo-print');
    await Print.printAsync({ html });
  } catch (err) {
    if (__DEV__) console.warn('[monedero] export pdf: printAsync falló', err);
    throw new Error(`PDF_PRINT_FAILED: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Captura una vista como PNG y la comparte (tarjeta-resumen, HU-13).
 * `snapshot: true` usa el trazado de dibujo de Android (más fiable con el
 * nuevo motor/Fabric, donde la captura por defecto sale en blanco). Verifica
 * además que el archivo tenga contenido real (una captura vacía <5 KB lanza).
 */
export async function shareViewShot(viewRef: unknown): Promise<void> {
  const ViewShot = await import('react-native-view-shot');
  // Pequeña pausa: asegura el layout completo antes del snapshot.
  await new Promise<void>((resolve) => setTimeout(resolve, 250));
  let uri: string;
  try {
    // `snapshot` (trazado de dibujo de Android, más fiable con Fabric) no está
    // en los tipos instalados pero SÍ en el runtime de la librería.
    const captureOptions = {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
      snapshot: true,
    } as Parameters<typeof ViewShot.captureRef>[1];
    uri = await ViewShot.captureRef(viewRef as never, captureOptions);
  } catch (err) {
    if (__DEV__) console.warn('[monedero] export image: captureRef falló', err);
    throw new Error(`CAPTURE_FAILED: ${err instanceof Error ? err.message : String(err)}`);
  }
  const Sharing = await import('expo-sharing');
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Monedero' });
  }
}
