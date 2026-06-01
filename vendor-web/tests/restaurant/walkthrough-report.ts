import type { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export type StepResult = { id: string; title: string; pass: boolean; note?: string; image?: string };

export function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function createWalkthroughReport(scenarioId: string, reportTitle: string, baseDir: string) {
  const screenshotDir = path.join(baseDir, 'results', scenarioId);
  const reportPath = path.join(screenshotDir, 'report.html');
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
  .step { margin: 24px 0; padding: 16px; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; }
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

  return { screenshotDir, snap, record, writeReport, steps };
}
