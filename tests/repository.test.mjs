import assert from "node:assert/strict";
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
import test from "node:test";
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
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
}

function probeWorkspace(t) {
  const cwd = mkdtempSync(path.join(tmpdir(), "storyteller-quality-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
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
        assert.fail(
          ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
        );
      },
    },
  );
  assert.ok(config);
  assert.deepEqual(config.errors, []);
  assert.ok(config.fileNames.length > 0);
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
  assert.equal(pkg.private, true);
  assert.match(pkg.packageManager, /^pnpm@12\./);
  assert.equal(pkg.scripts.dev, "pnpm -r --parallel dev");
  for (const command of ["build", "typecheck"]) {
    assert.equal(pkg.scripts[command], `pnpm -r ${command}`);
  }
  assert.equal(
    pkg.scripts.validate,
    "pnpm lint && pnpm typecheck && pnpm test && pnpm build",
  );
  const workspace = readFileSync(
    path.join(root, "pnpm-workspace.yaml"),
    "utf8",
  );
  assert.match(workspace, /- apps\/\*/);
  assert.match(workspace, /- packages\/\*/);
  for (const app of ["api", "web"]) {
    const appPackage = readJson(`apps/${app}/package.json`);
    assert.equal(appPackage.private, true);
    assert.equal(
      appPackage.devDependencies["@storyteller/config"],
      "workspace:*",
    );
    assert.equal(
      appPackage.scripts.lint,
      app === "web"
        ? "oxlint --deny-warnings src vite.config.mts"
        : "oxlint --deny-warnings src",
    );
    assert.equal(
      appPackage.scripts.typecheck,
      app === "web" ? "vue-tsc && tsc -p tsconfig.node.json" : "tsc",
    );
  }
});

test("Vite serves and bundles the Vue tooling probe", async () => {
  const webRoot = path.join(root, "apps/web");
  const pkg = readJson("apps/web/package.json");
  assert.equal(pkg.scripts.dev, "vite");
  assert.equal(pkg.scripts.build, "pnpm typecheck && vite build");
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
    assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;
    const html = await fetch(origin);
    assert.equal(html.status, 200);
    assert.match(await html.text(), /\/src\/main\.ts/);
    const main = await fetch(`${origin}/src/main.ts`);
    assert.equal(main.status, 200);
    assert.match(await main.text(), /ToolingCheck\.vue/);
    const component = await fetch(`${origin}/src/ToolingCheck.vue`);
    assert.equal(component.status, 200);
    const componentCode = await component.text();
    assert.match(componentCode, /toolingCheck/);
    assert.match(componentCode, /render/);
  } finally {
    await server.close();
  }
  const result = await build({ ...config, build: { write: false } });
  assert.ok(!Array.isArray(result) && "output" in result);
  assert.ok(result.output.some((file) => file.fileName === "index.html"));
  assert.ok(
    result.output.some(
      (file) => file.type === "chunk" && file.isEntry && /web/.test(file.code),
    ),
  );
});

test("workspace orchestration needs no Turbo dependency or configuration", () => {
  const pkg = readJson("package.json");
  assert.equal(pkg.devDependencies.turbo, undefined);
  assert.equal(existsSync(path.join(root, "turbo.json")), false);
  const lockfile = readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8");
  assert.doesNotMatch(lockfile, /turbo/);
});

for (const app of ["api", "web"]) {
  test(`${app} inherits strict settings and rejects nullable string assignment`, () => {
    const { options } = appConfig(app);
    assert.equal(options.strict, true);
    assert.equal(options.noEmit, true);
    assert.equal(options.target, ts.ScriptTarget.ES2022);
    assert.equal(
      options.moduleResolution,
      app === "api"
        ? ts.ModuleResolutionKind.NodeNext
        : ts.ModuleResolutionKind.Bundler,
    );
    assert.ok(
      probeDiagnostics(app, "export const probe: string = undefined;").some(
        (diagnostic) => diagnostic.code === 2322,
      ),
    );
  });
}

test("Node config allows Node globals but excludes browser globals", () => {
  assert.deepEqual(
    probeDiagnostics(
      "api",
      "export const probe: string = process.release.name;",
    ),
    [],
  );
  assert.ok(
    probeDiagnostics("api", "export const probe = document.title;").some(
      (diagnostic) => diagnostic.code === 2584,
    ),
  );
});

test("Vue config allows browser globals but excludes Node globals", () => {
  assert.deepEqual(
    probeDiagnostics("web", "export const probe: string = document.title;"),
    [],
  );
  assert.ok(
    probeDiagnostics("web", "export const probe = process.release.name;").some(
      (diagnostic) => diagnostic.code === 2591,
    ),
  );
});

test("Oxlint applies TypeScript rules to backend and Vue script setup", (t) => {
  const workspace = probeWorkspace(t);
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
    assert.equal(result.status, 1);
    const diagnostics = JSON.parse(result.stdout).diagnostics;
    assert.ok(
      diagnostics.some((diagnostic) => /no-explicit-any/.test(diagnostic.code)),
      result.stdout,
    );
    assert.ok(
      diagnostics.every((diagnostic) => !/parse/.test(diagnostic.code)),
    );
    workspace.write(filePath, source.replace(": any", ": number"));
    assert.equal(runTool("oxlint", [filePath], workspace.cwd).status, 0);
  }
});

test("Oxlint rejects unused variables and unknown Node globals", (t) => {
  const workspace = probeWorkspace(t);
  for (const [file, source, rule] of [
    ["apps/api/src/probe.ts", "const unused = 1;", "no-unused-vars"],
    ["tests/probe.mjs", "console.log(unknownGlobal);", "no-undef"],
  ]) {
    workspace.write(file, source);
    const result = runTool("oxlint", ["--format=json", file], workspace.cwd);
    assert.equal(result.status, 1);
    assert.ok(
      JSON.parse(result.stdout).diagnostics.some((diagnostic) =>
        diagnostic.code.includes(rule),
      ),
    );
  }
  workspace.write("tests/probe.mjs", "console.log(process.version);");
  assert.equal(runTool("oxlint", ["tests/probe.mjs"], workspace.cwd).status, 0);
});

test("Oxlint rejects invalid Vue script setup exports", (t) => {
  const workspace = probeWorkspace(t);
  const file = "apps/web/src/Probe.vue";
  workspace.write(
    file,
    '<script setup lang="ts">export const probe = 1;</script>',
  );
  const result = runTool("oxlint", ["--format=json", file], workspace.cwd);
  assert.equal(result.status, 1);
  assert.ok(
    JSON.parse(result.stdout).diagnostics.some((diagnostic) =>
      /no-export-in-script-setup/.test(diagnostic.code),
    ),
  );
});

test("lint and formatting ignore generated files and user-owned docs", (t) => {
  const workspace = probeWorkspace(t);
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
      assert.equal(result.status, 0, `${tool}: ${file}: ${result.stderr}`);
    }
    assert.equal(readFileSync(path.join(workspace.cwd, file), "utf8"), source);
  }
});

test("Oxfmt enforces the shared style for TypeScript and Vue", (t) => {
  const workspace = probeWorkspace(t);
  for (const [file, source] of [
    ["apps/api/src/probe.ts", "export const probe='value'"],
    [
      "apps/web/src/Probe.vue",
      "<script setup lang='ts'>const probe='value'</script><template><span>{{probe}}</span></template>",
    ],
  ]) {
    workspace.write(file, source);
    assert.equal(runTool("oxfmt", ["--check", file], workspace.cwd).status, 1);
    assert.equal(runTool("oxfmt", ["--write", file], workspace.cwd).status, 0);
    assert.match(
      readFileSync(path.join(workspace.cwd, file), "utf8"),
      /probe = "value";/,
    );
    assert.equal(runTool("oxfmt", ["--check", file], workspace.cwd).status, 0);
  }
});

test("quality scripts use only Oxlint and Oxfmt", () => {
  const pkg = readJson("package.json");
  assert.equal(
    pkg.scripts.lint,
    "pnpm -r lint && pnpm lint:root && pnpm format:check",
  );
  assert.equal(pkg.scripts["lint:root"], "oxlint --deny-warnings tests");
  assert.equal(pkg.scripts.format, "oxfmt --write .");
  assert.equal(pkg.scripts["format:check"], "oxfmt --check .");
  assert.ok(pkg.devDependencies.oxlint);
  assert.ok(pkg.devDependencies.oxfmt);
  for (const dependency of Object.keys(pkg.devDependencies)) {
    assert.doesNotMatch(dependency, /eslint|prettier/);
  }
  for (const file of [
    "eslint.config.mjs",
    ".prettierrc.json",
    ".prettierignore",
  ]) {
    assert.equal(existsSync(path.join(root, file)), false);
  }
});
