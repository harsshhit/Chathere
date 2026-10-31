import { palettes } from "./colors";

const luminance = (hex) => {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
};

const contrastRatio = (foreground, background) => {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

describe("theme action colors", () => {
  test.each(Object.entries(palettes))("%s primary actions meet text contrast", (_, palette) => {
    expect(contrastRatio(palette.onPrimary, palette.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(palette.onPrimary, palette.primaryHover)).toBeGreaterThanOrEqual(4.5);
  });
});
