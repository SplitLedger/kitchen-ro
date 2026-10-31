export async function copyPlainText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // The desktop window can reject the async clipboard. The selection fallback still works.
    }
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "true");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "0";
  area.style.opacity = "0";
  document.body.append(area);
  area.focus();
  area.select();
  const copied = document.execCommand("copy");
  area.remove();
  if (!copied) {
    throw new Error("Could not copy that text.");
  }
}
