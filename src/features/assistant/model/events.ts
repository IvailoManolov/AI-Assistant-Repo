/**
 * Asking Robby something from outside the chat.
 *
 * A window event rather than shared React state, because the dock and the
 * screens that want to talk to it have no common ancestor worth creating one
 * for. The payload is only a draft: it fills the box and opens the panel, and
 * the customer still presses send. Putting a message into the pipeline on
 * their behalf would put a session in the console that nobody typed.
 */
export const ASK_ROBBY = "robby:ask";

export type AskRobbyDetail = { text: string };

export function askRobby(text: string) {
  window.dispatchEvent(new CustomEvent<AskRobbyDetail>(ASK_ROBBY, { detail: { text } }));
}
