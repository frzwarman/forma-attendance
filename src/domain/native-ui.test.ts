import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(resolve(process.cwd(), "package.json"));
type Element = { props?: Record<string, any> };

function renderSheet(platform: string, busy = false) {
  // Execute the actual shared component with native host primitives, rather
  // than React Native Web (which accepts roles Android rejects).
  const file = resolve("src/components/ui.tsx");
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const exports: Record<string, any> = {};
  const native = Object.fromEntries(["ActivityIndicator", "KeyboardAvoidingView", "Modal", "Pressable", "ScrollView", "Text", "TextInput", "View"].map((name) => [name, name]));
  const theme = new Proxy({}, { get: () => "#000000" });
  runInNewContext(code, {
    exports,
    require: (name: string) => {
      if (name === "react-native") return { ...native, Platform: { OS: platform }, useWindowDimensions: () => ({ width: 390, height: 844 }) };
      if (name === "react-native-safe-area-context") return { useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) };
      if (name === "../theme") return { useTheme: () => theme, fonts: {}, fontWeights: {} };
      if (name === "lucide-react-native") return { ChevronRight: "ChevronRight", X: "X" };
      return require(name);
    },
  }, { filename: file });
  return exports.Sheet({ visible: true, title: "Request leave", children: "Form content", busy, onClose: () => {} }) as Element;
}

function elements(root: Element): Element[] {
  const children = root?.props?.children;
  return [root, ...(Array.isArray(children) ? children.flat(Infinity) : [children])
    .filter((child) => child && typeof child === "object")
    .flatMap((child) => elements(child))];
}

test("Android popup roles satisfy the installed native accessibility contract", () => {
  const source = readFileSync(resolve("node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/uimanager/ReactAccessibilityDelegate.kt"), "utf8");
  const roles = source.split("public enum class AccessibilityRole {")[1].split(";")[0]
    .match(/\b[A-Z][A-Z_]+\b/g)!.map((role) => role.toLowerCase());
  const tree = elements(renderSheet("android"));
  for (const element of tree) {
    const role = element.props?.accessibilityRole;
    if (role) assert.ok(roles.includes(role), `Android throws for accessibilityRole=${role}`);
  }
  const panel = tree.find((element) => element.props?.testID === "sheet-panel")!;
  assert.equal(panel.props!.accessibilityLabel, "Request leave");
  assert.equal(panel.props!.accessibilityViewIsModal, true);
  assert.equal(panel.props!.accessibilityRole, undefined);
});

test("web popups retain dialog semantics while native platforms omit that unsupported role", () => {
  for (const platform of ["web", "android", "ios"]) {
    const panel = elements(renderSheet(platform)).find((element) => element.props?.testID === "sheet-panel")!;
    assert.equal(panel.props!.accessibilityRole, platform === "web" ? "dialog" : undefined);
  }
});

test("busy Android popups prevent dismissal and keep their content inside the screen", () => {
  const tree = elements(renderSheet("android", true));
  const panel = tree.find((element) => element.props?.testID === "sheet-panel")!;
  assert.equal(panel.props!.accessibilityState.busy, true);
  assert.ok(panel.props!.style.height <= 844 - 48);
  const backdrop = tree.find((element) => element.props?.accessibilityLabel === "Close dialog backdrop")!;
  assert.equal(backdrop.props!.disabled, true);
});
