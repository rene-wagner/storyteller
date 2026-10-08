import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { expect, onTestFinished, test, vi } from "vitest";
import { createApp } from "../apps/api/src/app.ts";
import { createMediaService } from "../apps/api/src/media/service.ts";

const id = randomUUID();
const record = {
  id,
  name: "Theme",
  type: "background_music",
  fileName: "theme.wav",
  mimeType: "audio/wav",
  fileSize: 3n,
  storageKey: randomUUID(),
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};
const item = {
  id,
  name: "Theme",
  type: "background_music",
  fileName: "theme.wav",
  mimeType: "audio/wav",
  fileSize: "3",
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
};
const invalid = {
  error: {
    code: "VALIDATION_ERROR",
    message: "The request contains invalid data.",
    details: [],
  },
};
const failure = {
  error: {
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred.",
    details: [],
  },
};

function multipart(
  fields,
  file = {
    name: "file",
    filename: "theme.wav",
    mime: "audio/wav",
    data: "abc",
  },
) {
  const boundary = "media-boundary";
  const chunks = [];
  for (const entry of fields) {
    if (entry === "file") {
      chunks.push(
        `--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\nContent-Type: ${file.mime}\r\n\r\n${file.data}\r\n`,
      );
    } else {
      const [name, value] = entry;
      chunks.push(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      );
    }
  }
  chunks.push(`--${boundary}--\r\n`);
  return {
    payload: chunks.join(""),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}
function fixture() {
  const repo = {
    create: vi.fn().mockResolvedValue(record),
    list: vi.fn().mockResolvedValue([record]),
    find: vi.fn().mockResolvedValue(record),
    update: vi.fn().mockResolvedValue(record),
    delete: vi
      .fn()
      .mockResolvedValue({ kind: "deleted", storageKey: record.storageKey }),
  };
  const storage = {
    save: vi.fn(async (data) => {
      const chunks = [];
      for await (const chunk of data) chunks.push(chunk);
      return record.storageKey;
    }),
    delete: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(),
  };
  const app = createApp({ media: createMediaService(repo, storage) });
  onTestFinished(() => app.close());
  return { app, repo, storage };
}

test("upload streams one audio file, accepts fields in either order, and hides the storage key", async () => {
  const { app, repo, storage } = fixture();
  for (const fields of [
    ["file", ["name", "Theme"], ["type", "background_music"]],
    [["type", "background_music"], ["name", "Theme"], "file"],
  ]) {
    const response = await app.inject({
      method: "POST",
      url: "/media",
      ...multipart(fields),
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toStrictEqual(item);
  }
  expect(repo.create).toHaveBeenCalledWith({
    name: "Theme",
    type: "background_music",
    fileName: "theme.wav",
    mimeType: "audio/wav",
    fileSize: 3n,
    storageKey: record.storageKey,
  });
  expect(storage.save).toHaveBeenCalledTimes(2);
});

test("invalid uploads and metadata failures clean up saved bytes", async () => {
  const { app, repo, storage } = fixture();
  for (const fields of [
    ["file", ["name", "Theme"]],
    ["file", ["name", "Theme"], ["type", "invalid"]],
    ["file", ["name", `Theme${" ".repeat(251)}X`], ["type", "sound_effect"]],
    [
      "file",
      ["name", "Theme"],
      ["name", "Duplicate"],
      ["type", "sound_effect"],
    ],
  ]) {
    const response = await app.inject({
      method: "POST",
      url: "/media",
      ...multipart(fields),
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toStrictEqual(invalid);
  }
  expect(storage.delete).toHaveBeenCalledTimes(4);
  for (const file of [
    { name: "file", filename: "theme.txt", mime: "text/plain", data: "abc" },
    { name: "file", filename: "theme.wav", mime: "audio/wav", data: "" },
  ]) {
    const response = await app.inject({
      method: "POST",
      url: "/media",
      ...multipart(["file", ["name", "Theme"], ["type", "sound_effect"]], file),
    });
    expect(response.statusCode, response.body).toBe(400);
  }
  const extraFile = await app.inject({
    method: "POST",
    url: "/media",
    ...multipart(["file", ["name", "Theme"], ["type", "sound_effect"], "file"]),
  });
  expect(extraFile.statusCode).toBe(400);
  expect(storage.delete).toHaveBeenCalledTimes(7);
  repo.create.mockRejectedValueOnce(new Error("database private error"));
  const failed = await app.inject({
    method: "POST",
    url: "/media",
    ...multipart(["file", ["name", "Theme"], ["type", "sound_effect"]]),
  });
  expect(failed.statusCode).toBe(500);
  expect(failed.json()).toStrictEqual(failure);
  expect(storage.delete).toHaveBeenCalledTimes(8);
  expect(repo.create).toHaveBeenCalledTimes(1);
  const invalidJsonField = multipart([
    "file",
    ["name", "Theme"],
    ["type", "sound_effect"],
  ]);
  invalidJsonField.payload = invalidJsonField.payload.replace(
    'name="name"\r\n\r\nTheme',
    'name="name"\r\nContent-Type: application/json\r\n\r\n{bad',
  );
  const invalidJsonResponse = await app.inject({
    method: "POST",
    url: "/media",
    ...invalidJsonField,
  });
  expect(invalidJsonResponse.statusCode).toBe(400);
  expect(invalidJsonResponse.json()).toStrictEqual(invalid);
  const malformed = await app.inject({
    method: "POST",
    url: "/media",
    headers: { "content-type": "multipart/form-data; boundary=broken" },
    payload: "not multipart",
  });
  expect(malformed.statusCode).toBe(400);
  const notMultipart = await app.inject({
    method: "POST",
    url: "/media",
    payload: { name: "Theme" },
  });
  expect(notMultipart.statusCode).toBe(400);
  expect(
    await app.inject({
      method: "POST",
      url: "/media",
      ...multipart([["name", "Theme"]]),
    }),
  ).toMatchObject({ statusCode: 400 });
});

test("multipart upload rejects files beyond 25 MiB without persisting metadata", async () => {
  const { app, repo } = fixture();
  const response = await app.inject({
    method: "POST",
    url: "/media",
    ...multipart([["name", "Theme"], ["type", "sound_effect"], "file"], {
      name: "file",
      filename: "theme.wav",
      mime: "audio/wav",
      data: "a".repeat(25 * 1024 * 1024 + 1),
    }),
  });
  expect(response.statusCode).toBe(413);
  expect(repo.create).not.toHaveBeenCalled();
});

test("media CRUD validates input, filters by type, blocks referenced deletion and removes bytes after metadata", async () => {
  const { app, repo, storage } = fixture();
  expect(
    (await app.inject({ url: "/media?type=sound_effect" })).json(),
  ).toStrictEqual([item]);
  expect(repo.list).toHaveBeenCalledWith("sound_effect");
  expect((await app.inject({ url: `/media/${id}` })).json()).toStrictEqual(
    item,
  );
  const updated = await app.inject({
    method: "PATCH",
    url: `/media/${id}`,
    payload: { name: "New" },
  });
  expect(updated.statusCode).toBe(200);
  expect(repo.update).toHaveBeenCalledWith(id, { name: "New" });
  for (const url of ["/media?type=invalid", "/media?extra=1", "/media/bad"]) {
    expect((await app.inject({ url })).statusCode).toBe(400);
  }
  for (const payload of [
    {},
    { name: "" },
    { type: "sound_effect" },
    { fileName: "new" },
  ]) {
    expect(
      (await app.inject({ method: "PATCH", url: `/media/${id}`, payload }))
        .statusCode,
    ).toBe(400);
  }
  const usage = { sceneIds: [randomUUID()], cuePointIds: [randomUUID()] };
  repo.delete.mockResolvedValueOnce({ kind: "in_use", usage });
  const blocked = await app.inject({ method: "DELETE", url: `/media/${id}` });
  expect(blocked.statusCode).toBe(409);
  expect(blocked.json().error.usage).toStrictEqual(usage);
  expect(storage.delete).not.toHaveBeenCalled();
  expect(
    (await app.inject({ method: "DELETE", url: `/media/${id}` })).statusCode,
  ).toBe(204);
  expect(storage.delete).toHaveBeenCalledWith(record.storageKey);
  repo.delete.mockResolvedValueOnce({ kind: "not_found" });
  expect(
    (await app.inject({ method: "DELETE", url: `/media/${id}` })).statusCode,
  ).toBe(404);
  repo.find.mockResolvedValueOnce(undefined);
  expect((await app.inject({ url: `/media/${id}` })).statusCode).toBe(404);
  storage.delete.mockRejectedValueOnce(new Error("private storage path"));
  expect(
    (await app.inject({ method: "DELETE", url: `/media/${id}` })).json(),
  ).toStrictEqual(failure);
});

test("media upload service cleans bytes after repository failure", async () => {
  const { repo, storage } = fixture();
  repo.create.mockRejectedValueOnce(new Error("insert failed"));
  const media = createMediaService(repo, storage);
  await expect(
    media.upload(
      async () => ({
        name: "Theme",
        type: "background_music",
        fileName: "theme.wav",
        mimeType: "audio/wav",
      }),
      Readable.from([Buffer.from("abc")]),
    ),
  ).rejects.toThrow("insert failed");
  expect(storage.delete).toHaveBeenCalledWith(record.storageKey);
});
