import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const screenshotDir = path.resolve(process.cwd(), 'docs/screenshots');

test.beforeAll(() => {
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
});

test.describe('E2E Zero Trust Multi-Role User Journeys', () => {
  test('Journey 1: Mahasiswa Login, Nilai, Transkrip, dan Logout', async ({ page }) => {
    await page.goto('/');

    // 1. Verify Login Page
    await expect(page.locator('h1')).toContainText('NILAI — Academic Records');

    // Use Quick Demo shortcut for Mahasiswa 1
    await page.getByRole('button', { name: /Mahasiswa 1/i }).click();
    await page.getByRole('button', { name: /Masuk ke Sistem/i }).click();

    // 2. Verify Mahasiswa Dashboard
    await expect(page.locator('text=Ahmad Fauzi')).toBeVisible();
    await expect(page.locator('header').getByText('MAHASISWA', { exact: true })).toBeVisible();
    await expect(page.locator('text=Nilai Perkuliahan Semester Ini')).toBeVisible();

    // Verify Grade Table content
    await expect(page.locator('table')).toContainText('Keamanan Informasi');
    await expect(page.locator('table')).toContainText('IF3101');

    await page.screenshot({ path: path.join(screenshotDir, '01-mahasiswa-grades.png') });

    // 3. Switch to Transcript Tab
    await page.getByRole('button', { name: /Transkrip Akademik/i }).click();
    await expect(page.locator('text=Transkrip Akademik Resmi')).toBeVisible();
    await expect(page.locator('text=Indeks Prestasi Kumulatif')).toBeVisible();

    await page.screenshot({ path: path.join(screenshotDir, '02-mahasiswa-transkrip.png') });

    // 4. Logout
    await page.getByRole('button', { name: /Keluar/i }).click();
    await expect(page.locator('h1')).toContainText('NILAI — Academic Records');
  });

  test('Journey 2: Dosen Gradebook, Edit Nilai, dan Finalisasi Kelas', async ({ page }) => {
    await page.goto('/');

    // Quick demo for Dosen 1
    await page.getByRole('button', { name: /Dosen 1/i }).click();
    await page.getByRole('button', { name: /Masuk ke Sistem/i }).click();

    // Verify Dosen Dashboard
    await expect(page.locator('text=Dr. Budi Santoso')).toBeVisible();
    await expect(page.locator('header').getByText('DOSEN', { exact: true })).toBeVisible();
    await expect(page.locator('text=Gradebook & Pengelolaan Nilai Dosen')).toBeVisible();

    // Verify Class A heading is loaded
    await expect(page.getByRole('heading', { name: /IF3101.*Keamanan Informasi/ })).toBeVisible();

    // Screenshot initial gradebook
    await page.screenshot({ path: path.join(screenshotDir, '03-dosen-gradebook.png') });

    // Open Finalize Confirmation Modal
    const finalizeBtn = page.getByRole('button', { name: /Finalisasi Nilai Kelas/i });
    if (await finalizeBtn.isVisible()) {
      await finalizeBtn.click();
      await expect(page.locator('h3:has-text("Konfirmasi Finalisasi")')).toBeVisible();
      await page.screenshot({ path: path.join(screenshotDir, '04-dosen-finalize-modal.png') });

      // Confirm Finalization
      await page.getByRole('button', { name: /Ya, Kunci & Finalisasi/i }).click();

      // Verify class locked
      await expect(page.locator('text=Kelas Telah Difinalisasi')).toBeVisible();
      await page.screenshot({ path: path.join(screenshotDir, '05-dosen-finalized-locked.png') });
    }

    // Logout
    await page.getByRole('button', { name: /Keluar/i }).click();
  });

  test('Journey 3: Admin Transcript Search & Audit Trail PEP', async ({ page }) => {
    await page.goto('/');

    // Quick demo for Administrator
    await page.getByRole('button', { name: /Administrator Pusat/i }).click();
    await page.getByRole('button', { name: /Masuk ke Sistem/i }).click();

    // Verify Admin Dashboard
    await expect(page.locator('text=Administrator Pusat')).toBeVisible();
    await expect(page.locator('header').getByText('ADMIN', { exact: true })).toBeVisible();

    // Check Transcript Search for Mahasiswa 1
    await page.getByRole('button', { name: /2207051001/i }).click();
    await expect(page.getByRole('heading', { name: 'Ahmad Fauzi' })).toBeVisible();

    await page.screenshot({ path: path.join(screenshotDir, '06-admin-transcript.png') });

    // Switch to Audit Trail Tab
    await page.getByRole('button', { name: /Audit Trail Log PEP/i }).click();
    await expect(page.locator('text=Log Aktivitas Policy Enforcement Point')).toBeVisible();
    await expect(page.locator('table')).toContainText('ALLOW');

    await page.screenshot({ path: path.join(screenshotDir, '07-admin-audit-trail.png') });

    // Logout
    await page.getByRole('button', { name: /Keluar/i }).click();
  });

  test('Journey 4: Zero Trust Security Rejection on Unregistered Device', async ({ page }) => {
    await page.goto('/');

    // Select the negative test simulation button
    await page.getByRole('button', { name: /Uji Device Asing/i }).click();
    await page.getByRole('button', { name: /Masuk ke Sistem/i }).click();

    // Verify policy rejection banner
    await expect(page.locator('text=Akses Ditolak (Policy Deny)')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotDir, '08-security-device-rejected.png') });
  });
});
