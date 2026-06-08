import { z } from "zod";

export const puzzleColorSchema = z.enum(["red", "green", "blue", "yellow"]);

export const imageAnalysisInputSchema = z.object({
  sessionId: z.string(),
  imageKey: z.string(),
  sideIndex: z.number().int().min(0).max(3)
});

export const aiVisionResultSchema = z.object({
  puzzleDetected: z.boolean(),
  puzzleType: z.enum(["pyraminx", "unknown"]),
  imageQuality: z.object({
    blur: z.number().min(0).max(1),
    glare: z.number().min(0).max(1),
    brightness: z.number().min(0).max(1),
    perspectiveQuality: z.number().min(0).max(1)
  }),
  detectedFace: z
    .object({
      orientation: z.string(),
      cells: z.array(
        z.object({
          cellId: z.string(),
          detectedColor: puzzleColorSchema,
          confidence: z.number().min(0).max(1),
          boundingBox: z.object({
            x: z.number(),
            y: z.number(),
            width: z.number(),
            height: z.number()
          })
        })
      )
    })
    .optional(),
  warnings: z.array(z.string()),
  requiresRescan: z.boolean()
});

export type PuzzleImageAnalysisInput = z.infer<typeof imageAnalysisInputSchema>;
export type PuzzleImageAnalysisResult = z.infer<typeof aiVisionResultSchema>;

export interface PuzzleVideoAnalysisInput {
  sessionId: string;
  videoKey: string;
}

export interface PuzzleVideoAnalysisResult {
  framesAnalyzed: number;
  warnings: string[];
  requiresManualConfirmation: boolean;
}

export interface MoveExplanationInput {
  sessionId: string;
  verifiedMove: string;
  stepIndex: number;
  audienceMode: "child" | "adult" | "expert";
}

export interface MoveExplanationResult {
  text: string;
  warnings: string[];
}

export interface PuzzleAssistantInput {
  sessionId: string;
  question: string;
  verifiedCurrentMove?: string;
}

export interface PuzzleAssistantResult {
  answer: string;
  requiresRescan: boolean;
}

export interface AiProvider {
  analyzePuzzleImage(input: PuzzleImageAnalysisInput): Promise<PuzzleImageAnalysisResult>;
  analyzePuzzleVideo(input: PuzzleVideoAnalysisInput): Promise<PuzzleVideoAnalysisResult>;
  explainMove(input: MoveExplanationInput): Promise<MoveExplanationResult>;
  answerUserQuestion(input: PuzzleAssistantInput): Promise<PuzzleAssistantResult>;
}
