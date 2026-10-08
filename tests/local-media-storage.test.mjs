import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { expect, onTestFinished, test } from "vitest";
import { createLocalMediaStorage } from "../apps/api/src/media/local-storage.ts";

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "storyteller-media-"));
  onTestFinished(() => rm(directory, { recursive: true, force: true }));
  return {
    directory,
    storage: createLocalMediaStorage({
      MEDIA_STORAGE_DIRECTORY: join(directory, "media"),
    }),
  };
}

async function bytes(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

test("local media storage saves streams under unique opaque keys, reads and deletes files", async () => {
  const { directory, storage } = await fixture();
  const first = await storage.save(
    Readable.from([Buffer.from("hello "), Buffer.from("world")]),
  );
  const second = await storage.save(Readable.from([Buffer.from("other")]));
  expect(first).toMatch(/^[0-9a-f-]{36}$/);
  expect(second).not.toBe(first);
  expect(first).not.toContain(directory);
  expect(await bytes(await storage.get(first))).toEqual(
    Buffer.from("hello world"),
  );
  expect(await readFile(join(directory, "media", second))).toEqual(
    Buffer.from("other"),
  );
  await storage.delete(first);
  expect(await readdir(join(directory, "media"))).toEqual([second]);
  await expect(storage.get(first)).rejects.toMatchObject({ code: "ENOENT" });
  await expect(storage.delete(first)).rejects.toMatchObject({ code: "ENOENT" });
});

test.each([
  "../outside",
  "../../outside",
  "/tmp/outside",
  "media/key",
  "..\\outside",
  "",
  ".",
  "key\0bad",
])(
  "local media storage rejects unsafe keys %j before read or delete",
  async (key) => {
    const { directory, storage } = await fixture();
    const outside = join(directory, "outside");
    await writeFile(outside, "untouched");
    await expect(storage.get(key)).rejects.toThrow(
      "Invalid media storage key.",
    );
    await expect(storage.delete(key)).rejects.toThrow(
      "Invalid media storage key.",
    );
    expect(await readFile(outside, "utf8")).toBe("untouched");
  },
);

test("local media storage does not read a symlink at a valid key", async () => {
  const { directory, storage } = await fixture();
  const key = await storage.save(Readable.from([Buffer.from("original")]));
  const outside = join(directory, "outside");
  await writeFile(outside, "private");
  await storage.delete(key);
  await symlink(outside, join(directory, "media", key));
  await expect(storage.get(key)).rejects.toMatchObject({ code: "ELOOP" });
  expect(await readFile(outside, "utf8")).toBe("private");
});

test("failed stream writes remove incomplete media files", async () => {
  const { directory, storage } = await fixture();
  async function* broken() {
    yield Buffer.from("partial");
    throw new Error("stream failed");
  }
  await expect(storage.save(broken())).rejects.toThrow("stream failed");
  expect(await readdir(join(directory, "media"))).toEqual([]);
});
