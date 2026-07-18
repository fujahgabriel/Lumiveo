import { describe, expect, it } from "vitest";
import { t, uiDirection } from "./i18n";

describe("i18n", () => {
  it("returns translated strings for known locales", () => {
    expect(t("es", "newProject")).toBe("Nuevo proyecto");
    expect(t("ar", "scenes")).toBe("المشاهد");
  });

  it("falls back to English for unknown locales", () => {
    expect(t("pt-BR", "export")).toBe("Export");
  });

  it("reports RTL only for Arabic UI", () => {
    expect(uiDirection("ar")).toBe("rtl");
    expect(uiDirection("en")).toBe("ltr");
    expect(uiDirection("zh-CN")).toBe("ltr");
  });
});
