export type Actor = {
  id: string;
  role: "USER" | "ADMIN";
};

export function assertCanReadSession(actor: Actor, sessionOwnerId: string) {
  if (actor.role === "ADMIN") return;
  if (actor.id !== sessionOwnerId) {
    throw new Error("SESSION_ACCESS_DENIED");
  }
}

export function assertAdmin(actor: Actor) {
  if (actor.role !== "ADMIN") {
    throw new Error("ADMIN_ACCESS_DENIED");
  }
}
