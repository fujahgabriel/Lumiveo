import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const service = "com.appdemostudio.providers";

export interface SecretStore {
  get(account: string): Promise<string | null>;
  set(account: string, value: string): Promise<void>;
  delete(account: string): Promise<void>;
}

export class MacKeychainSecretStore implements SecretStore {
  async get(account: string) {
    try {
      const { stdout } = await execFileAsync("/usr/bin/security", [
        "find-generic-password",
        "-s",
        service,
        "-a",
        account,
        "-w",
      ]);
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }

  async set(account: string, value: string) {
    await execFileAsync("/usr/bin/security", [
      "add-generic-password",
      "-U",
      "-s",
      service,
      "-a",
      account,
      "-w",
      value,
    ]);
  }

  async delete(account: string) {
    try {
      await execFileAsync("/usr/bin/security", [
        "delete-generic-password",
        "-s",
        service,
        "-a",
        account,
      ]);
    } catch {
      // Deleting an absent credential is idempotent.
    }
  }
}

export class MemorySecretStore implements SecretStore {
  private readonly values = new Map<string, string>();

  async get(account: string) {
    return this.values.get(account) ?? null;
  }

  async set(account: string, value: string) {
    this.values.set(account, value);
  }

  async delete(account: string) {
    this.values.delete(account);
  }
}
