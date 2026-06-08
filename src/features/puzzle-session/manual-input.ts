import { z } from "zod";

export const manualPyraminxInputSchema = z.object({
  sessionId: z.string().optional(),
  stickerColors: z.record(z.string(), z.enum(["red", "green", "blue", "yellow"])),
  confirmedByUser: z.boolean()
});

export type ManualPyraminxInput = z.infer<typeof manualPyraminxInputSchema>;

export function requiresManualConfirmation(input: ManualPyraminxInput) {
  return !input.confirmedByUser;
}
