/** Strip vendor/tech jargon from errors that may reach the UI. */
export function sanitizeUserError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("groq") ||
    lower.includes("openrouter") ||
    lower.includes("claude") ||
    lower.includes("whisper") ||
    lower.includes("ffmpeg") ||
    lower.includes("openai") ||
    lower.includes("anthropic") ||
    lower.includes("api_key") ||
    lower.includes("llm")
  ) {
    return "Something went wrong while processing this video. Try again.";
  }
  return message;
}
