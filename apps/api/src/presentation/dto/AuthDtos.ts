import { z } from "zod";
import { Cpf } from "../../domain/value-objects/Cpf";

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "Full name must have at least 3 characters")
    .max(150),
  email: z.string().trim().email("Invalid email address").max(200),
  cpf: z
    .string()
    .trim()
    .refine((val) => Cpf.isValid(val), { message: "Invalid CPF number" }),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .refine((val) => /[A-Za-z]/.test(val) && /\d/.test(val), {
      message: "Password must contain at least one letter and one number",
    }),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(1, "Password is required").max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  code: z.string().trim().regex(/^\d{6}$/, "Code must be 6 digits"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .refine((val) => /[A-Za-z]/.test(val) && /\d/.test(val), {
      message: "Password must contain at least one letter and one number",
    }),
});
