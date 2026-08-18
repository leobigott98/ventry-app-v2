import { describe, expect, it } from "vitest";

import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/schemas/auth";

describe("esquemas de autenticacion", () => {
  it("valida login y recuperacion por correo", () => {
    expect(loginSchema.safeParse({ email: "ana@example.com", password: "secreto12" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "incorrecto", password: "secreto12" }).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({ email: "ana@example.com" }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: "incorrecto" }).success).toBe(false);
  });

  it("valida los campos minimos del registro", () => {
    expect(
      signupSchema.safeParse({
        fullName: "Ana Perez",
        email: "ana@example.com",
        communityName: "Residencias Sol",
        password: "secreto12",
      }).success,
    ).toBe(true);
    expect(
      signupSchema.safeParse({
        fullName: "A",
        email: "ana@example.com",
        communityName: "R",
        password: "corta",
      }).success,
    ).toBe(false);
  });

  it("rechaza un cambio de clave sin tokens o con confirmacion distinta", () => {
    expect(
      resetPasswordSchema.safeParse({
        accessToken: "access",
        refreshToken: "refresh",
        password: "secreto12",
        confirmPassword: "secreto12",
      }).success,
    ).toBe(true);
    expect(
      resetPasswordSchema.safeParse({
        accessToken: "",
        refreshToken: "",
        password: "secreto12",
        confirmPassword: "diferente12",
      }).success,
    ).toBe(false);
  });
});
