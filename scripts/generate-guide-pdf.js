import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('[PDF GENERATOR] Launching Chromium to generate PDF...');
  const inputHtmlPath = path.resolve(__dirname, '../docs/panduan-lengkap.html');
  const outputPdfPath = path.resolve(__dirname, '../docs/PANDUAN_LENGKAP_ZERO_TRUST_PANDAKAD.pdf');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const fileUrl = 'file:///' + inputHtmlPath.replace(/\\/g, '/');
  console.log(`[PDF GENERATOR] Loading HTML from: ${fileUrl}`);

  await page.goto(fileUrl, { waitUntil: 'load' });

  await page.pdf({
    path: outputPdfPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '18mm',
      bottom: '18mm',
      left: '15mm',
      right: '15mm',
    },
  });

  await browser.close();
  console.log(`[PDF GENERATOR] PDF successfully created at: ${outputPdfPath}`);
}

main().catch((err) => {
  console.error('[PDF GENERATOR ERROR]', err);
  process.exit(1);
});
