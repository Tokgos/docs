#!/usr/bin/env node
/**
 * 将路径末尾的临时 {xxx} 拆成独立 OpenAPI 文件，而不是合并。
 *
 * 这用于 Mintlify：同一个真实「方法 + URL」在同一个 OpenAPI 文件中只能有
 * 一个 operation；把每个协议变体放到独立 JSON 后，URL 可恢复真实值且不会
 * 在 Mintlify 中被去重。输出目录按 operation.tags 的 "一级/二级" 创建。
 *
 * 用法：
 *   node scripts/split-openapi-path-suffixes.mjs openapi.json api-reference
 */

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";

const HTTP_METHODS = new Set([
  "get", "put", "post", "delete", "options", "head", "patch", "trace",
]);
const SUFFIX_PATTERN = /^(.*)\{([A-Za-z0-9._ -]+)\}$/;
const SUFFIX_NAVIGATION = {
  gemini: { group: "图片生成", subgroup: "Nano Banana" },
  "gemini-edit": { group: "图片生成", subgroup: "Nano Banana" },
};
// 旧版合并工具已把这些没有发生碰撞的路径直接规范化，无法从 operation
// 元数据推回后缀。保留此表仅用于兼容已被该工具处理过一次的旧输入。
const RECOVERED_PATH_SUFFIXES = {
  "/v1/images/edtis": "gemini",
};

function slug(value) {
  return value
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "default";
}

function clone(value) {
  return structuredClone(value);
}

function pathSlug(path) {
  return slug(
    path
      .replace(/\{[^}]+\}/g, "model")
      .replace(/[^\p{L}\p{N}]+/gu, "-"),
  );
}

function navigationFromTag(tags) {
  const [first = "API Reference", second = "General"] = (tags?.[0] ?? "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  return { group: first, subgroup: second };
}

function navigationForSuffix(suffix, tags) {
  return SUFFIX_NAVIGATION[suffix] ?? navigationFromTag(tags);
}

function leafSchemas(schema) {
  if (!schema?.oneOf || !Array.isArray(schema.oneOf)) return [schema];
  return schema.oneOf.flatMap(leafSchemas);
}

function removeFakePathParameter(operation, suffix) {
  operation.parameters = (operation.parameters ?? []).filter(
    (parameter) => !(parameter?.in === "path" && parameter?.name === suffix),
  );
  if (operation.parameters.length === 0) delete operation.parameters;
}

function documentFor(spec, targetPath, method, operation, group, subgroup) {
  const tags = [...new Set([...(operation.tags ?? []), group])];
  operation.tags = tags;
  operation["x-group"] = subgroup;
  return {
    openapi: spec.openapi,
    info: clone(spec.info),
    servers: clone(spec.servers),
    security: clone(spec.security),
    tags: (spec.tags ?? []).filter((tag) => tags.includes(tag.name)),
    paths: { [targetPath]: { [method]: operation } },
    components: clone(spec.components),
  };
}

const [, , inputArg, outputArg] = process.argv;
if (!inputArg || !outputArg) {
  throw new Error("用法：node scripts/split-openapi-path-suffixes.mjs <输入 OpenAPI JSON> <输出目录>");
}

const inputPath = resolve(inputArg);
const outputDirectory = resolve(outputArg);
const spec = JSON.parse(await readFile(inputPath, "utf8"));
if (!spec.paths || typeof spec.paths !== "object") {
  throw new Error("输入文件缺少 paths object，不是有效 OpenAPI JSON。");
}

const candidates = [];
for (const [sourcePath, pathItem] of Object.entries(spec.paths)) {
  const match = sourcePath.match(SUFFIX_PATTERN);
  for (const [method, rawOperation] of Object.entries(pathItem)) {
    if (!HTTP_METHODS.has(method.toLowerCase())) continue;
    if (match) {
      const [, targetPath, suffix] = match;
      const operation = clone(rawOperation);
      removeFakePathParameter(operation, suffix);
      candidates.push({ sourcePath, targetPath, method, suffix, operation });
      continue;
    }

    // 支持从旧版合并工具的 x-forward-variants 中恢复：不会改源文件，
    // 仅把 oneOf 最后的各变体输出为独立规范文件。
    const variants = rawOperation["x-forward-variants"];
    const schema = rawOperation.requestBody?.content?.["application/json"]?.schema;
    if (Array.isArray(variants) && variants.length > 0 && schema) {
      const leaves = leafSchemas(schema);
      const variantSchemas = leaves.slice(-variants.length);
      variants.forEach((variant, index) => {
        const operation = clone(rawOperation);
        delete operation["x-forward-variants"];
        delete operation["x-forward-path-suffix"];
        operation.summary = variant.summary ?? operation.summary;
        operation.description = `由 ${sourcePath}{${variant.suffix}} 拆分出的协议变体。`;
        operation.requestBody.content["application/json"].schema = variantSchemas[index];
        candidates.push({
          sourcePath: `${sourcePath}{${variant.suffix}}`,
          targetPath: sourcePath,
          method,
          suffix: variant.suffix,
          operation,
        });
      });
    } else if (RECOVERED_PATH_SUFFIXES[sourcePath]) {
      const suffix = RECOVERED_PATH_SUFFIXES[sourcePath];
      candidates.push({
        sourcePath: `${sourcePath}{${suffix}}`,
        targetPath: sourcePath,
        method,
        suffix,
        operation: clone(rawOperation),
      });
    }
  }
}

if (candidates.length === 0) {
  throw new Error("未找到以 {xxx} 结尾的路径；没有生成任何 OpenAPI 文件。");
}

// 确认有内容后才清理旧输出，避免错误输入把现有产物目录清空。
await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
const manifest = { source: basename(inputPath), entries: [] };
for (const { sourcePath, targetPath, method, suffix, operation } of candidates) {
  const { group, subgroup } = navigationForSuffix(suffix, operation.tags);
  const directory = join(outputDirectory, slug(group), slug(subgroup));
  const filename = `${pathSlug(targetPath)}--${slug(suffix)}.json`;
  const filePath = join(directory, filename);
  await mkdir(directory, { recursive: true });
  await writeFile(
    filePath,
    `${JSON.stringify(documentFor(spec, targetPath, method, operation, group, subgroup), null, 2)}\n`,
    "utf8",
  );
  manifest.entries.push({
    group, subgroup, summary: operation.summary ?? `${method.toUpperCase()} ${targetPath}`,
    method: method.toUpperCase(), path: targetPath, sourcePath,
    openapi: relative(dirname(inputPath), filePath).replaceAll("\\", "/"),
  });
}
await writeFile(
  join(outputDirectory, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify(manifest, null, 2));
