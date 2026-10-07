import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ESLint } from "eslint";
import * as prettier from "prettier";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const readJson = (file) =>
  JSON.parse(readFileSync(path.join(root, file), "utf8"));
const eslint = new ESLint({ cwd: root });

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
  for (const command of ["dev", "build", "lint", "typecheck"]) {
    assert.match(pkg.scripts[command], new RegExp(`turbo run ${command}`));
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
      app === "web" ? "eslint src vite.config.mts" : "eslint src",
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

test("Turbo tracks generated output and shared configuration", () => {
  const turbo = readJson("turbo.json");
  assert.deepEqual(turbo.tasks.build.outputs, ["dist/**"]);
  assert.equal(turbo.tasks.dev.persistent, true);
  assert.equal(turbo.tasks.dev.cache, false);
  for (const file of [
    "packages/config/**",
    "eslint.config.mjs",
    ".prettierrc.json",
  ]) {
    assert.ok(turbo.globalDependencies.includes(file));
  }
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

test("ESLint applies TypeScript rules to backend and Vue script setup", async () => {
  const sources = [
    ["apps/api/src/probe.ts", "export const probe: any = 1;"],
    [
      "apps/web/src/ProbeComponent.vue",
      '<script setup lang="ts">const probe: any = 1;</script><template><span>{{ probe }}</span></template>',
    ],
  ];
  for (const [filePath, source] of sources) {
    const [result] = await eslint.lintText(source, { filePath });
    assert.ok(
      result.messages.some(
        (message) => message.ruleId === "@typescript-eslint/no-explicit-any",
      ),
    );
    assert.equal(result.fatalErrorCount, 0);
  }
});

test("lint and formatting ignore generated files and user-owned docs", async () => {
  for (const file of [
    "apps/api/dist/probe.js",
    "apps/web/coverage/probe.js",
    ".turbo/probe.json",
    "node_modules/probe/index.js",
    "docs/development/ROADMAP.md",
    "AGENTS.md",
  ]) {
    assert.equal(await eslint.isPathIgnored(path.join(root, file)), true, file);
    const info = await prettier.getFileInfo(path.join(root, file), {
      ignorePath: path.join(root, ".prettierignore"),
    });
    assert.equal(info.ignored, true, file);
  }
});
