import { describe, expect, it } from "vitest";

import { getDefaultAppRouteForRole, hasRequiredRole } from "@/lib/auth/access";

describe("acceso por rol", () => {
  it.each([
    ["admin", "/app/dashboard"],
    ["guard", "/app/guards"],
    ["resident", "/app/dashboard"],
  ] as const)("envia %s a su ruta inicial", (role, route) => {
    expect(getDefaultAppRouteForRole(role)).toBe(route);
  });

  it("permite rutas sin restriccion o con un rol incluido", () => {
    expect(hasRequiredRole("resident")).toBe(true);
    expect(hasRequiredRole("resident", [])).toBe(true);
    expect(hasRequiredRole("guard", ["admin", "guard"])).toBe(true);
  });

  it("rechaza roles fuera de la lista permitida", () => {
    expect(hasRequiredRole("resident", ["admin", "guard"])).toBe(false);
  });
});
