import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Ingresa un correo valido."),
  password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres."),
});

export const signupSchema = z.object({
  fullName: z.string().min(2, "Ingresa tu nombre y apellido."),
  email: z.string().email("Ingresa un correo valido."),
  communityName: z.string().min(2, "Ingresa el nombre del conjunto o residencia."),
  password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres."),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Ingresa un correo valido."),
});

export const resetPasswordSchema = z
  .object({
    accessToken: z.string().min(1, "El enlace de recuperacion es invalido."),
    refreshToken: z.string().min(1, "El enlace de recuperacion es invalido."),
    password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres."),
    confirmPassword: z.string().min(8, "Confirma la contrasena."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Las contrasenas no coinciden.",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
