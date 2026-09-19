export type ChatMessage = {
  id: string;
  role: "customer" | "assistant";
  text: string;
};
