import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { writeResultsIndex } from './walkthrough-report';

const _dir = path.dirname(fileURLToPath(import.meta.url));
const resultsDir = path.join(_dir, 'results');

const SCENARIOS = [
  { id: 'scenario1-orders', title: 'Scenario 1 — Orders Management' },
  { id: 'scenario2-pos', title: 'Scenario 2 — POS Billing' },
  { id: 'scenario3-bookings', title: 'Scenario 3 — Bookings' },
  { id: 'scenario4-invoices', title: 'Scenario 4 — Invoices & Billing' },
  { id: 'scenario5-coupons', title: 'Scenario 5 — Coupons & Promo Codes' },
  { id: 'scenario6-memos', title: 'Scenario 6 — Credit / Debit Memos' },
];

test('generate sales test results index', () => {
  fs.mkdirSync(resultsDir, { recursive: true });
  writeResultsIndex(_dir, SCENARIOS);
});
