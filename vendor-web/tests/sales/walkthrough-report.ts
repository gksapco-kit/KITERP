import { chromium, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export type StepResult = { id: string; title: string; pass: boolean; note?: string; image?: string };

export function createWalkthroughReport(scenarioId: string, reportTitle: string, baseDir: string) {
  const screenshotDir = path.join(baseDir, 'results', scenarioId);
  const reportPath = path.join(screenshotDir, 'report.html');
  const pdfPath = path.join(screenshotDir, 'report.pdf');
  const steps: StepResult[] = [];

  async function snap(page: Page, id: string) {
    fs.mkdirSync(screenshotDir, { recursive: true });
    const file = `${id}.png`;
    await page.screenshot({ path: path.join(screenshotDir, file), fullPage: true });
    return file;
  }

  function record(id: string, title: string, pass: boolean, image?: string, note?: string) {
    steps.push({ id, title, pass, image, note });
  }

  function writeReport() {
    fs.mkdirSync(screenshotDir, { recursive: true });
    const passed = steps.filter(s => s.pass).length;
    const rows = steps
      .map(
        s => `
    <section class="step ${s.pass ? 'pass' : 'fail'}">
      <h2><span class="badge">${s.pass ? 'PASS' : 'FAIL'}</span> ${s.id} — ${s.title}</h2>
      ${s.note ? `<p class="note">${s.note}</p>` : ''}
      ${s.image ? `<img src="${s.image}" alt="${s.title}" />` : ''}
    </section>`,
      )
      .join('\n');

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>${reportTitle}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 1100px; margin: 0 auto; padding: 24px; background: #f8fafc; color: #111; }
  h1 { font-size: 1.5rem; }
  .summary { margin: 16px 0; padding: 12px 16px; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; }
  .step { margin: 24px 0; padding: 16px; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; page-break-inside: avoid; }
  .step.fail { border-color: #fca5a5; }
  .badge { font-size: 0.7rem; padding: 2px 8px; border-radius: 4px; margin-right: 8px; vertical-align: middle; }
  .pass .badge { background: #dcfce7; color: #166534; }
  .fail .badge { background: #fee2e2; color: #991b1b; }
  img { max-width: 100%; margin-top: 12px; border: 1px solid #e2e8f0; border-radius: 6px; }
  .note { color: #64748b; font-size: 0.9rem; }
</style></head><body>
  <h1>${reportTitle}</h1>
  <div class="summary"><strong>${passed}/${steps.length}</strong> steps passed · ${new Date().toLocaleString()}</div>
  ${rows}
</body></html>`;
    fs.writeFileSync(reportPath, html, 'utf-8');
  }

  return { screenshotDir, reportPath, pdfPath, snap, record, writeReport, steps };
}

export async function exportReportPdf(htmlPath: string, pdfPath: string) {
  if (!fs.existsSync(htmlPath)) return;
  // Best-effort, time-bounded: the PDF is a convenience artifact (the HTML
  // report is always written). Never let it exceed the afterAll hook budget
  // or throw — that would mask otherwise-passing test results.
  const work = (async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;
      await page.goto(fileUrl, { waitUntil: 'load', timeout: 15000 });
      await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: { top: '16mm', bottom: '16mm', left: '12mm', right: '12mm' },
      });
    } finally {
      await browser.close();
    }
  })();

  const guard = new Promise<void>((resolve) => setTimeout(resolve, 20000));
  try {
    await Promise.race([work, guard]);
  } catch (err) {
    console.warn(`[walkthrough-report] PDF export skipped: ${(err as Error).message}`);
  }
}

export function writeResultsIndex(baseDir: string, scenarios: { id: string; title: string }[]) {
  const resultsDir = path.join(baseDir, 'results');
  fs.mkdirSync(resultsDir, { recursive: true });

  const links = scenarios
    .map(
      s => `<li>
        <strong>${s.title}</strong>
        — <a href="${s.id}/report.html">HTML report</a>
        · <a href="${s.id}/report.pdf">PDF report</a>
      </li>`,
    )
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>Sales Management Test Results</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 1.5rem; }
  ul { line-height: 2; }
  a { color: #2563eb; }
</style></head><body>
  <h1>Sales Management — E2E Test Results</h1>
  <p>Generated ${new Date().toLocaleString()}</p>
  <ul>${links}</ul>
</body></html>`;
  fs.writeFileSync(path.join(resultsDir, 'index.html'), html, 'utf-8');
}
