export const LOVE_MESSAGE_REGEX = /\blove\w*/gi;

export const getLoveMatches = (text = "") => {
  const matcher = new RegExp(LOVE_MESSAGE_REGEX.source, "gi");
  return Array.from(String(text).matchAll(matcher), (match) => ({
    text: match[0],
    index: match.index,
  }));
};

export const hasLoveMessage = (text = "") => getLoveMatches(text).length > 0;