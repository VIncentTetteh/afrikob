// @vitest-environment node
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Tailwind v4 silently emits nothing for a colour it does not know. A menu
 * styled `bg-card` in a theme without `--color-card` renders transparent, and
 * the table behind it shows through as if the menu sat underneath. This test
 * keeps the familiar shadcn names out unless the theme actually defines them.
 */
const ROOT = path.resolve(__dirname, "../..");
const COLOR_UTILITY = "(?:bg|text|border|ring|fill|stroke|divide|outline|from|via|to|placeholder|decoration|caret)";
const SHADCN_NAMES = [
  "card", "card-foreground", "muted", "muted-foreground", "border", "primary", "primary-foreground",
  "foreground", "background", "secondary", "secondary-foreground", "destructive", "popover",
  "popover-foreground", "input", "danger", "danger-soft", "success", "success-soft", "warning", "warning-soft",
];

function themeTokens(): Set<string> {
  const css = readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");
  return new Set([...css.matchAll(/--color-([a-z0-9-]+)\s*:/g)].map((m) => m[1]));
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("theme tokens", () => {
  it("uses no colour utility the theme does not define", () => {
    const defined = themeTokens();
    const undefinedNames = SHADCN_NAMES.filter((n) => !defined.has(n));
    const pattern = new RegExp(`(?<![\\w-])${COLOR_UTILITY}-(${undefinedNames.join("|")})(?:/\\d+)?(?![\\w-])`, "g");
    const cssVar = new RegExp(`var\\(--(${undefinedNames.join("|")})\\)`, "g");

    const offences = sourceFiles(path.join(ROOT, "src")).flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return [...text.matchAll(pattern), ...text.matchAll(cssVar)].map(
        (m) => `${path.relative(ROOT, file)}: ${m[0]}`,
      );
    });
    expect(offences).toEqual([]);
  });

  it("keeps a field's button on the input's line, not the bottom of its hint", () => {
    // A form laid out as `sm:flex-row sm:items-end` aligns the button with the
    // hint or error under the input, so it drifts below it. Use InlineAction.
    const offences = sourceFiles(path.join(ROOT, "src")).filter((file) =>
      /<form[^>]*className="[^"]*items-end/.test(readFileSync(file, "utf8")),
    );
    expect(offences.map((f) => path.relative(ROOT, f))).toEqual([]);
  });
});
