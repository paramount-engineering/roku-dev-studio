import * as fs from 'fs';
import { getCaPemPath, getOrCreateCa } from './ca-store';

/**
 * Write the RDS CA PEM to a user-chosen path. RDS does not modify or inject anything into the
 * channel package itself — trusting the CA (so the MITM proxy can decrypt HTTPS) is up to the app.
 */
export function exportCaPemToFile(targetPath: string): { success: boolean; error?: string } {
  try {
    getOrCreateCa();
    fs.copyFileSync(getCaPemPath(), targetPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function exportCaCertToFile(targetPath: string): { success: boolean; error?: string } {
  try {
    const ca = getOrCreateCa();
    fs.writeFileSync(targetPath, ca.certPem, 'utf8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
