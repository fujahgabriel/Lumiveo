export interface LicenseStatus {
  state: "trial" | "active" | "expired" | "unlicensed";
  canExport: boolean;
  expiresAt: string | null;
  offlineGraceEndsAt: string | null;
}

export interface LicenseProvider {
  status(): Promise<LicenseStatus>;
  activate(key: string): Promise<LicenseStatus>;
  deactivate(): Promise<void>;
}

export class DevelopmentLicenseProvider implements LicenseProvider {
  async status(): Promise<LicenseStatus> {
    return {
      state: "trial",
      canExport: true,
      expiresAt: null,
      offlineGraceEndsAt: null,
    };
  }

  async activate(_key: string) {
    return this.status();
  }

  async deactivate() {}
}

export interface UpdateStatus {
  currentVersion: string;
  availableVersion: string | null;
  channel: "stable" | "beta";
  downloadUrl: string | null;
  releaseNotes: string | null;
}

export interface UpdateProvider {
  check(channel: "stable" | "beta"): Promise<UpdateStatus>;
}

export class NoopUpdateProvider implements UpdateProvider {
  async check(channel: "stable" | "beta"): Promise<UpdateStatus> {
    return {
      currentVersion: process.env.npm_package_version ?? "0.1.0",
      availableVersion: null,
      channel,
      downloadUrl: null,
      releaseNotes: null,
    };
  }
}
