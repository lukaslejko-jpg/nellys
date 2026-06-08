import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Nellys",
  description: "Puzzle Solver for Pyraminx and future twisty puzzles."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk">
      <body>{children}</body>
    </html>
  );
}
