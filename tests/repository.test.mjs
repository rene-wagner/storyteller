import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import path from "node:path";
import { expect, onTestFinished, test } from "vitest";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const readJson = (file) =>
  JSON.parse(readFileSync(path.join(root, file), "utf8"));
function runTool(tool, args, cwd = root) {
  const result = spawnSync(
    process.execPath,
    [path.join(root, "node_modules", tool, "bin", tool), ...args],
    { cwd, encoding: "utf8" },
  );
  expect(result.error ?? null).toBeNull();
  expect(result.signal).toBe(null);
  return result;
}

function probeWorkspace() {
  const cwd = mkdtempSync(path.join(tmpdir(), "storyteller-quality-"));
  onTestFinished(() => rmSync(cwd, { recursive: true, force: true }));
  for (const config of [".oxlintrc.json", ".oxfmtrc.json"]) {
    copyFileSync(path.join(root, config), path.join(cwd, config));
  }
  return {
    cwd,
    write(file, source) {
      const target = path.join(cwd, file);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, source);
    },
  };
}

function appConfig(app) {
  const config = ts.getParsedCommandLineOfConfigFile(
    path.join(root, "apps", app, "tsconfig.json"),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic(diagnostic) {
        expect.unreachable(
          ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
        );
      },
    },
  );
  expect(config).toBeTruthy();
  expect(config.errors).toStrictEqual([]);
  expect(config.fileNames.length > 0).toBeTruthy();
  return config;
}

function probeDiagnostics(app, source) {
  const config = appConfig(app);
  const fileName = path.join(root, "apps", app, "src", "config-probe.ts");
  const host = ts.createCompilerHost(config.options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (file, languageVersion, ...args) =>
    file === fileName
      ? ts.createSourceFile(file, source, languageVersion, true)
      : getSourceFile(file, languageVersion, ...args);
  return ts.getPreEmitDiagnostics(
    ts.createProgram([fileName], config.options, host),
  );
}

test("workspace packages and root commands form a private monorepo", () => {
  const pkg = readJson("package.json");
  expect(pkg.private).toBe(true);
  expect(pkg.packageManager).toMatch(/^pnpm@12\./);
  expect(pkg.scripts.dev).toBe("pnpm -r --parallel dev");
  expect(pkg.scripts.test).toBe("vitest run");
  expect(pkg.devDependencies.vitest).toBeTruthy();
  for (const command of ["build", "typecheck"]) {
    expect(pkg.scripts[command]).toBe(`pnpm -r ${command}`);
  }
  expect(pkg.scripts.validate).toBe(
    "pnpm lint && pnpm typecheck && pnpm test && pnpm build",
  );
  const workspace = readFileSync(
    path.join(root, "pnpm-workspace.yaml"),
    "utf8",
  );
  expect(workspace).toMatch(/- apps\/\*/);
  expect(workspace).toMatch(/- packages\/\*/);
  for (const app of ["api", "web"]) {
    const appPackage = readJson(`apps/${app}/package.json`);
    expect(appPackage.private).toBe(true);
    expect(appPackage.devDependencies["@storyteller/config"]).toBe(
      "workspace:*",
    );
    expect(appPackage.scripts.lint).toBe(
      app === "web"
        ? "oxlint --deny-warnings src vite.config.mts"
        : "oxlint --deny-warnings src drizzle.config.ts",
    );
    expect(appPackage.scripts.typecheck).toBe(
      app === "web" ? "vue-tsc && tsc -p tsconfig.node.json" : "tsc",
    );
  }
});

test("Vite serves and bundles the Vue shell and tooling probe", async () => {
  const webRoot = path.join(root, "apps/web");
  const pkg = readJson("apps/web/package.json");
  expect(pkg.scripts.dev).toBe("vite");
  expect(pkg.scripts.build).toBe("pnpm typecheck && vite build");
  const require = createRequire(path.join(webRoot, "package.json"));
  const { build, createServer } = await import(
    pathToFileURL(require.resolve("vite")).href
  );
  const config = {
    root: webRoot,
    configFile: path.join(webRoot, "vite.config.mts"),
    logLevel: "silent",
  };
  const server = await createServer({
    ...config,
    server: { host: "127.0.0.1", port: 0, strictPort: true },
  });
  try {
    await server.listen();
    const address = server.httpServer.address();
    expect(address && typeof address !== "string").toBeTruthy();
    const origin = `http://127.0.0.1:${address.port}`;
    const html = await fetch(origin);
    expect(html.status).toBe(200);
    expect(await html.text()).toMatch(/\/src\/main\.ts/);
    const main = await fetch(`${origin}/src/main.ts`);
    expect(main.status).toBe(200);
    expect(await main.text()).toMatch(/App\.vue/);
    const shell = await fetch(`${origin}/src/App.vue`);
    expect(shell.status).toBe(200);
    expect(await shell.text()).toMatch(/ToolingCheck\.vue/);
    const component = await fetch(`${origin}/src/ToolingCheck.vue`);
    expect(component.status).toBe(200);
    const componentCode = await component.text();
    expect(componentCode).toMatch(/toolingCheck/);
    expect(componentCode).toMatch(/render/);
  } finally {
    await server.close();
  }
  const result = await build({ ...config, build: { write: false } });
  expect(!Array.isArray(result) && "output" in result).toBeTruthy();
  expect(
    result.output.some((file) => file.fileName === "index.html"),
  ).toBeTruthy();
  expect(
    result.output.some(
      (file) => file.type === "chunk" && file.isEntry && /web/.test(file.code),
    ),
  ).toBeTruthy();
});

test("workspace orchestration needs no Turbo dependency or configuration", () => {
  const pkg = readJson("package.json");
  expect(pkg.devDependencies.turbo).toBe(undefined);
  expect(existsSync(path.join(root, "turbo.json"))).toBe(false);
  const lockfile = readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8");
  expect(lockfile).not.toMatch(/turbo/);
});

for (const app of ["api", "web"]) {
  test(`${app} inherits strict settings and rejects nullable string assignment`, () => {
    const { options } = appConfig(app);
    expect(options.strict).toBe(true);
    expect(options.noEmit).toBe(true);
    expect(options.target).toBe(ts.ScriptTarget.ES2022);
    expect(options.moduleResolution).toBe(
      app === "api"
        ? ts.ModuleResolutionKind.NodeNext
        : ts.ModuleResolutionKind.Bundler,
    );
    expect(
      probeDiagnostics(app, "export const probe: string = undefined;").some(
        (diagnostic) => diagnostic.code === 2322,
      ),
    ).toBeTruthy();
  });
}

test("Node config allows Node globals but excludes browser globals", () => {
  expect(
    probeDiagnostics(
      "api",
      "export const probe: string = process.release.name;",
    ),
  ).toStrictEqual([]);
  expect(
    probeDiagnostics("api", "export const probe = document.title;").some(
      (diagnostic) => diagnostic.code === 2584,
    ),
  ).toBeTruthy();
});

test("Vue config allows browser globals but excludes Node globals", () => {
  expect(
    probeDiagnostics("web", "export const probe: string = document.title;"),
  ).toStrictEqual([]);
  expect(
    probeDiagnostics("web", "export const probe = process.release.name;").some(
      (diagnostic) => diagnostic.code === 2591,
    ),
  ).toBeTruthy();
});

test("Oxlint applies TypeScript rules to backend and Vue script setup", () => {
  const workspace = probeWorkspace();
  const sources = [
    ["apps/api/src/probe.ts", "export const probe: any = 1;"],
    [
      "apps/web/src/ProbeComponent.vue",
      '<script setup lang="ts">const probe: any = 1;</script><template><span>{{ probe }}</span></template>',
    ],
  ];
  for (const [filePath, source] of sources) {
    workspace.write(filePath, source);
    const result = runTool(
      "oxlint",
      ["--format=json", filePath],
      workspace.cwd,
    );
    expect(result.status).toBe(1);
    const diagnostics = JSON.parse(result.stdout).diagnostics;
    expect(
      diagnostics.some((diagnostic) => /no-explicit-any/.test(diagnostic.code)),
      result.stdout,
    ).toBeTruthy();
    expect(
      diagnostics.every((diagnostic) => !/parse/.test(diagnostic.code)),
    ).toBeTruthy();
    workspace.write(filePath, source.replace(": any", ": number"));
    expect(runTool("oxlint", [filePath], workspace.cwd).status).toBe(0);
  }
});

test("Oxlint rejects unused variables and unknown Node globals", () => {
  const workspace = probeWorkspace();
  for (const [file, source, rule] of [
    ["apps/api/src/probe.ts", "const unused = 1;", "no-unused-vars"],
    ["tests/probe.mjs", "console.log(unknownGlobal);", "no-undef"],
  ]) {
    workspace.write(file, source);
    const result = runTool("oxlint", ["--format=json", file], workspace.cwd);
    expect(result.status).toBe(1);
    expect(
      JSON.parse(result.stdout).diagnostics.some((diagnostic) =>
        diagnostic.code.includes(rule),
      ),
    ).toBeTruthy();
  }
  workspace.write("tests/probe.mjs", "console.log(process.version);");
  expect(runTool("oxlint", ["tests/probe.mjs"], workspace.cwd).status).toBe(0);
});

test("Oxlint rejects invalid Vue script setup exports", () => {
  const workspace = probeWorkspace();
  const file = "apps/web/src/Probe.vue";
  workspace.write(
    file,
    '<script setup lang="ts">export const probe = 1;</script>',
  );
  const result = runTool("oxlint", ["--format=json", file], workspace.cwd);
  expect(result.status).toBe(1);
  expect(
    JSON.parse(result.stdout).diagnostics.some((diagnostic) =>
      /no-export-in-script-setup/.test(diagnostic.code),
    ),
  ).toBeTruthy();
});

test("lint and formatting ignore generated files and user-owned docs", () => {
  const workspace = probeWorkspace();
  for (const file of [
    "apps/api/dist/probe.js",
    "apps/web/coverage/probe.js",
    "node_modules/probe/index.js",
    "docs/probe.js",
    "AGENTS.md",
    "apps/api/probe.tsbuildinfo",
    "pnpm-lock.yaml",
  ]) {
    const source = "const unused:any=1";
    workspace.write(file, source);
    for (const [tool, args] of [
      ["oxlint", ["--no-error-on-unmatched-pattern", file]],
      ["oxfmt", ["--write", "--no-error-on-unmatched-pattern", file]],
    ]) {
      const result = runTool(tool, args, workspace.cwd);
      expect(result.status, `${tool}: ${file}: ${result.stderr}`).toBe(0);
    }
    expect(readFileSync(path.join(workspace.cwd, file), "utf8")).toBe(source);
  }
});

test("Oxfmt enforces the shared style for TypeScript and Vue", () => {
  const workspace = probeWorkspace();
  for (const [file, source] of [
    ["apps/api/src/probe.ts", "export const probe='value'"],
    [
      "apps/web/src/Probe.vue",
      "<script setup lang='ts'>const probe='value'</script><template><span>{{probe}}</span></template>",
    ],
  ]) {
    workspace.write(file, source);
    expect(runTool("oxfmt", ["--check", file], workspace.cwd).status).toBe(1);
    expect(runTool("oxfmt", ["--write", file], workspace.cwd).status).toBe(0);
    expect(readFileSync(path.join(workspace.cwd, file), "utf8")).toMatch(
      /probe = "value";/,
    );
    expect(runTool("oxfmt", ["--check", file], workspace.cwd).status).toBe(0);
  }
});

test("quality scripts use only Oxlint and Oxfmt", () => {
  const pkg = readJson("package.json");
  expect(pkg.scripts.lint).toBe(
    "pnpm -r lint && pnpm lint:root && pnpm format:check",
  );
  expect(pkg.scripts["lint:root"]).toBe(
    "oxlint --deny-warnings tests vitest.config.mjs",
  );
  expect(pkg.scripts.format).toBe("oxfmt --write .");
  expect(pkg.scripts["format:check"]).toBe("oxfmt --check .");
  expect(pkg.devDependencies.oxlint).toBeTruthy();
  expect(pkg.devDependencies.oxfmt).toBeTruthy();
  for (const dependency of Object.keys(pkg.devDependencies)) {
    expect(dependency).not.toMatch(/eslint|prettier/);
  }
  for (const file of [
    "eslint.config.mjs",
    ".prettierrc.json",
    ".prettierignore",
  ]) {
    expect(existsSync(path.join(root, file))).toBe(false);
  }
});
