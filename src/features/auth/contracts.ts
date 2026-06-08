import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(10).max(200)
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200)
});

export const resetPasswordSchema = z.object({
  email: z.string().email()
});
