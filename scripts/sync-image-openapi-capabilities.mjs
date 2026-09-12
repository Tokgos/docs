import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function load(name) {
  const filename = path.join(root, "zh", "apis", "images", name);
  return { filename, document: JSON.parse(fs.readFileSync(filename, "utf8")) };
}

function save({ filename, document }) {
  fs.writeFileSync(filename, `${JSON.stringify(document, null, 2)}\n`);
}

function schema(operation, contentType = "application/json") {
  return operation.requestBody.content[contentType].schema;
}

function replaceStrings(value, replacements) {
  if (typeof value === "string") return replacements.get(value) ?? value;
  if (Array.isArray(value)) return value.map((item) => replaceStrings(item, replacements));
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      value[key] = replaceStrings(item, replacements);
    }
  }
  return value;
}

function setStringModel(property, values, description) {
  delete property.const;
  property.type = "string";
  property.enum = values;
  property.description = description;
}

function setResponseFormat(property, description = "响应格式。b64_json 返回 Base64；url 返回临时图片链接；默认 b64_json。") {
  property.type = "string";
  property.enum = ["b64_json", "url"];
  property.default = "b64_json";
  property.description = description;
}

function setCompatibleImageResponse(operation, example) {
  const content = operation.responses["200"].content["application/json"];
  const result = content.schema.properties.data.items;
  delete result.required;
  result.type = "object";
  result.additionalProperties = false;
  result.properties = {
    index: { type: "integer", minimum: 0, description: "结果索引。" },
    b64_json: { type: "string", minLength: 1, description: "Base64 编码图片；response_format=b64_json 时返回。" },
    url: { type: "string", format: "uri", description: "临时图片链接；response_format=url 时返回。" },
  };
  result.oneOf = [{ required: ["b64_json"] }, { required: ["url"] }];
  content.example = example;
}

// OpenAI / GPT Image
{
  const file = load("gpt-openapi.json");
  const generation = file.document.paths["/v1/images/generations"].post;
  const edit = file.document.paths["/v1/images/edits"].post;
  const generationSchema = schema(generation);
  const editSchema = schema(edit);
  const gptModels = [
    "gpt-image-2.5-sunburst",
    "gpt-image-2.5-sunburst-2026-09-08",
    "gpt-image-2.5-flare",
    "gpt-image-2.5-flare-2026-09-08",
    "gpt-image-2",
    "gpt-image-2-2026-04-21",
    "gpt-image-1.5",
    "gpt-image-1",
    "gpt-image-1-mini",
    "dall-e-2",
    "dall-e-3",
  ];
  generationSchema.required = ["model", "prompt"];
  setStringModel(
    generationSchema.properties.model,
    gptModels,
    "必填。图片生成模型。网关不会采用 OpenAI 的 dall-e-2 默认值，必须显式传 model。",
  );
  generationSchema.properties.quality.enum = [
    "auto",
    "low",
    "medium",
    "high",
    "xhigh",
    "max",
    "standard",
    "hd",
    null,
  ];
  generationSchema.properties.quality.description =
    "图像质量。GPT Image 支持 auto/low/medium/high；GPT Image 2.5 额外支持 xhigh/max；dall-e-3 支持 standard/hd；dall-e-2 仅支持 standard。";
  generationSchema.properties.size.description =
    "图像尺寸。GPT Image 2/2.5 支持 WIDTHxHEIGHT：宽高均为 16 的倍数、比例 1:3～3:1，最高 3840x2160；其他 GPT Image 使用 auto、1024x1024、1536x1024 或 1024x1536；dall-e-2 支持 256x256、512x512、1024x1024；dall-e-3 支持 1024x1024、1792x1024、1024x1792。";
  generationSchema.properties.response_format.description =
    "仅 dall-e-2 和 dall-e-3 支持 url 或 b64_json。GPT Image 模型始终返回 Base64，不支持此上游参数。";
  generation.description = [
    "网关要求显式传入 `model`。不同模型只支持下表中的参数组合。",
    "",
    "| 模型 | 尺寸 | 质量 | 模型专属参数 |",
    "| --- | --- | --- | --- |",
    "| `gpt-image-2.5-sunburst` / `flare`（含快照） | 任意 `WIDTHxHEIGHT`（16 倍数、1:3～3:1、最高 3840x2160） | `auto/low/medium/high/xhigh/max` | `background`、`moderation`、`output_format`、`output_compression`、`stream`、`partial_images` |",
    "| `gpt-image-2`（含快照） | 同上 | `auto/low/medium/high` | 同上；透明背景仍为预览能力 |",
    "| `gpt-image-1` / `1.5` / `1-mini` | `auto`、1024×1024、1536×1024、1024×1536 | `auto/low/medium/high` | `background`、`moderation`、`output_format`、`output_compression`、`stream`、`partial_images` |",
    "| `dall-e-3` | 1024×1024、1792×1024、1024×1792 | `standard/hd` | `n` 只能为 1；支持 `style`、`response_format` |",
    "| `dall-e-2` | 256×256、512×512、1024×1024 | `standard` | 支持 `n=1..10`、`response_format` |",
  ].join("\n");
  generation["x-model-capabilities"] = {
    "gpt-image-2.5-*": ["background", "moderation", "n", "output_compression", "output_format", "partial_images", "quality", "size", "stream", "user"],
    "gpt-image-2*": ["background", "moderation", "n", "output_compression", "output_format", "partial_images", "quality", "size", "stream", "user"],
    "gpt-image-1*": ["background", "moderation", "n", "output_compression", "output_format", "partial_images", "quality", "size", "stream", "user"],
    "dall-e-3": ["n", "quality", "response_format", "size", "style", "user"],
    "dall-e-2": ["n", "quality", "response_format", "size", "user"],
  };

  editSchema.required = ["model", "images", "prompt"];
  setStringModel(
    editSchema.properties.model,
    [
      "gpt-image-2.5-sunburst",
      "gpt-image-2.5-sunburst-2026-09-08",
      "gpt-image-2.5-flare",
      "gpt-image-2.5-flare-2026-09-08",
      "gpt-image-2",
      "gpt-image-2-2026-04-21",
      "gpt-image-1.5",
      "gpt-image-1",
      "gpt-image-1-mini",
      "chatgpt-image-latest",
      "dall-e-2",
    ],
    "必填。用于图片编辑的模型。dall-e-3 不支持图片编辑。",
  );
  editSchema.properties.quality.enum = ["low", "medium", "high", "xhigh", "max", "auto", null];
  editSchema.properties.quality.description =
    "输出质量。GPT Image 支持 low/medium/high/auto；GPT Image 2.5 额外支持 xhigh/max。";
  editSchema.properties.size.description = generationSchema.properties.size.description;
  editSchema.properties.response_format.description =
    "dall-e-2 可用 url 或 b64_json。GPT Image 模型固定返回 Base64。";
  edit.description = [
    "网关要求显式传入 `model`、`images` 和 `prompt`。GPT Image 最多接收 16 张参考图；`dall-e-2` 只接收单张 PNG 输入；`dall-e-3` 不支持编辑。",
    "",
    "GPT Image 2/2.5 支持任意合规 `WIDTHxHEIGHT`，其他 GPT Image 使用标准三档尺寸。`input_fidelity`、`background`、`moderation`、`output_format`、`output_compression`、`stream` 和 `partial_images` 仅用于 GPT Image 系列。",
  ].join("\n");
  edit["x-model-capabilities"] = {
    "gpt-image-*": ["images", "prompt", "background", "input_fidelity", "mask", "moderation", "n", "output_compression", "output_format", "partial_images", "quality", "size", "stream", "user"],
    "dall-e-2": ["images", "prompt", "mask", "n", "response_format", "size", "user"],
    "dall-e-3": [],
  };
  save(file);
}

// Gemini / Nano Banana
{
  const file = load("nano-banana-openapi.json");
  const generation = file.document.paths["/v1/images/generations"].post;
  const native = file.document.paths["/v1beta/models/{model}:generateContent"].post;
  const request = schema(generation);
  const models = ["gemini-3.1-flash-image", "gemini-3-pro-image", "gemini-2.5-flash-image"];
  setStringModel(request.properties.model, models, "必填。Gemini 图片模型。不同模型的分辨率、搜索、思考和参考图限制见接口说明。 ");
  request.properties.images.minItems = 1;
  request.properties.images.maxItems = 14;
  request.properties.images.description =
    "可选。参考图数组；用于图片编辑时至少 1 张。可传 URL/data URL 字符串或含 image_url 的对象；不支持 file_id。模型上限见接口说明。";
  request.properties.size.description =
    "输出宽高比。网关把该字段约分并映射为 Gemini aspectRatio；它不是像素尺寸。极端比例 1:4、4:1、1:8、8:1 仅 gemini-3.1-flash-image 支持。";
  request.properties.quality.description =
    "输出分辨率映射：low→512px、standard→1K、medium→2K、high/hd→4K、auto/省略→不指定。gemini-2.5-flash-image 只支持 1K。";
  generation.description = [
    "统一 OpenAI 兼容入口。`size` 表示宽高比，`quality` 映射到 Gemini 的图片分辨率。",
    "",
    "| 模型 | 输出分辨率 | 参考图 | 搜索与思考 |",
    "| --- | --- | --- | --- |",
    "| `gemini-3.1-flash-image` | 512px、1K、2K、4K；支持 1:4/4:1/1:8/8:1 极端比例 | 最多 14 张（最多 10 个对象 + 4 个角色） | `google_search`、`image_search`、`thinking_level` |",
    "| `gemini-3-pro-image` | 1K、2K、4K | 最多 14 张（最多 6 个对象 + 5 个角色 + 3 个风格） | `google_search`、`thinking_level`；不支持图片搜索 |",
    "| `gemini-2.5-flash-image` | 固定 1K | 建议最多 3 张 | 不支持 Google Search、图片搜索和思考 |",
    "",
    "此入口不接受原生 `generationConfig`、`aspect_ratio` 或 `image_size`，请使用 `size` 和 `quality`。",
  ].join("\n");
  generation["x-model-capabilities"] = {
    "gemini-3.1-flash-image": ["prompt", "images", "size", "quality", "google_search", "image_search", "thinking_level", "response_format"],
    "gemini-3-pro-image": ["prompt", "images", "size", "quality", "google_search", "thinking_level", "response_format"],
    "gemini-2.5-flash-image": ["prompt", "images", "size", "quality", "response_format"],
  };
  request.examples = [
    {
      model: "gemini-3.1-flash-image",
      prompt: "电影感的上海雨夜街景，霓虹灯倒影，写实摄影",
      size: "16:9",
      quality: "medium",
    },
  ];
  generation.requestBody.content["application/json"].example = {
    model: "gemini-3-pro-image",
    prompt: "Generate a photorealistic red apple on a rustic wooden table.",
    size: "1:1",
    quality: "standard",
  };
  native.description =
    "Gemini 原生入口。gemini-2.5-flash-image 仅支持 aspectRatio；Gemini 3 图片模型还支持 imageSize。参考图和搜索/思考能力限制与统一入口的模型表一致。";
  native.responses["200"].content["application/json"].schema = {
    type: "object",
    required: ["candidates"],
    properties: {
      candidates: {
        type: "array",
        items: {
          type: "object",
          required: ["content"],
          properties: {
            content: {
              type: "object",
              required: ["parts"],
              properties: {
                parts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      text: { type: "string" },
                      inlineData: {
                        type: "object",
                        required: ["mimeType", "data"],
                        properties: {
                          mimeType: { type: "string" },
                          data: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
            finishReason: { type: "string" },
          },
        },
      },
      usageMetadata: { type: "object", additionalProperties: true },
    },
  };
  save(file);
}

// Qwen Image
{
  const file = load("qwen-openapi.json");
  const generation = file.document.paths["/v1/images/generations"].post;
  const request = schema(generation);
  request.properties.images.minItems = 1;
  request.properties.images.maxItems = 3;
  request.properties.images.description =
    "可选。图生图/编辑参考图，最多 3 张。每项提供 file_id 或 image_url；省略时为文生图。";
  request.properties.size.pattern = "^(auto|[1-9]\\d*x[1-9]\\d*)$";
  request.properties.size.description =
    "可选。输出尺寸，格式为 WIDTHxHEIGHT，例如 1024x1024。省略或传 auto 时，网关向上游发送 1024x1024；官方像素面积范围为 512×512 到 2048×2048，宽高比 1:8～8:1。";
  generation.description = [
    "`qwen-image-3.0-pro`（以及 `bailian/` 别名）在同一端点支持文生图和最多 3 张参考图的图生图。",
    "",
    "支持：`model`、`prompt`、`size`、`images`、`prompt_extend`、`prompt_extend_mode`、`enable_thinking`、`negative_prompt`、`seed`、`watermark`、`response_format`。",
    "",
    "官方兼容接口还支持 `n=1..6`，但当前网关会明确拒绝 Qwen 的 `n`，因此本规范不暴露该字段。`prompt_extend_mode=agent` 仅支持文生图；`enable_thinking` 仅在 `prompt_extend=true` 时生效。",
  ].join("\n");
  generation["x-model-capabilities"] = {
    "bailian/qwen-image-3.0-pro": ["prompt", "size", "images", "prompt_extend", "prompt_extend_mode", "enable_thinking", "negative_prompt", "seed", "watermark", "response_format"],
    "qwen-image-3.0-pro": ["prompt", "size", "images", "prompt_extend", "prompt_extend_mode", "enable_thinking", "negative_prompt", "seed", "watermark", "response_format"],
  };
  {
    const content = generation.responses["200"].content["application/json"];
    const item = content.schema.properties.data.items;
    delete item.oneOf;
    item.required = ["b64_json", "index"];
    item.properties = {
      b64_json: { type: "string", minLength: 1, contentEncoding: "base64", description: "网关下载并转换后的 Base64 图片。" },
      index: { type: "integer", minimum: 0, description: "结果索引。" },
    };
    content.example = {
      created: 1788451200,
      background: "opaque",
      data: [{ b64_json: "iVBORw0KGgoAAAANSUhEUgAA...", index: 0 }],
      output_format: "png",
      size: "1024x1024",
    };
  }
  save(file);
}

// Seedream
{
  const file = load("seedream-openapi.json");
  const generation = file.document.paths["/v1/images/generations"].post;
  const request = schema(generation);
  request.required = ["model", "prompt"];
  setStringModel(
    request.properties.model,
    ["volcengine/doubao-seedream-5.0-pro", "volcengine/doubao-seedream-4.5"],
    "必填。Forward 公开模型 ID。网关按 doubao/seedream 模型族转发到 OFOX OpenAI Images 兼容接口。",
  );
  setResponseFormat(request.properties.response_format);
  generation.description = [
    "Seedream 使用 `/v1/images/generations`。`model` 和 `prompt` 必填，`response_format` 可选。",
    "",
    "| 模型 | 尺寸 | 其他参数 |",
    "| --- | --- | --- |",
    "| `volcengine/doubao-seedream-5.0-pro` | 2K、3K 或合规 `WIDTHxHEIGHT` | `output_format`、`background`、`response_format`、`watermark`、`optimize_prompt_options` |",
    "| `volcengine/doubao-seedream-4.5` | 2K、4K 或合规 `WIDTHxHEIGHT` | `response_format`、`watermark`、`optimize_prompt_options`；透明背景能力以账户上游为准 |",
    "",
    "透明背景必须同时使用 `output_format=png`。当前规范没有暴露组图控制和参考图字段。",
  ].join("\n");
  generation["x-model-capabilities"] = {
    "volcengine/doubao-seedream-5.0-pro": ["prompt", "size", "output_format", "background", "response_format", "watermark", "optimize_prompt_options"],
    "volcengine/doubao-seedream-4.5": ["prompt", "size", "response_format", "watermark", "optimize_prompt_options"],
  };
  setCompatibleImageResponse(generation, {
    created: 1788920400,
    data: [{ index: 0, b64_json: "iVBORw0KGgoAAAANSUhEUgAA..." }],
    model: "volcengine/doubao-seedream-5.0-pro",
    size: "2048x2048",
  });
  save(file);
}

// Microsoft MAI Image through OFOX
{
  const file = load("mai-openapi.json");
  replaceStrings(
    file.document,
    new Map([
      ["volcengine/doubao-seedream-5.0-pro", "microsoft/mai-image-2.5-pro"],
      ["gpt-image-1.5", "microsoft/mai-image-2.5-pro"],
    ]),
  );
  const generation = file.document.paths["/v1/images/generations"].post;
  const edit = file.document.paths["/v1/images/edits"].post;
  const generationSchema = schema(generation);
  const editSchema = schema(edit);
  generationSchema.required = ["model", "prompt"];
  setStringModel(
    generationSchema.properties.model,
    ["microsoft/mai-image-2.5-pro"],
    "必填。MAI Image 2.5 Pro 的 Forward 模型 ID。",
  );
  generationSchema.properties.prompt.description = "必填。图片提示词，原生模型上下文上限 32,000 tokens。";
  generationSchema.properties.size = {
    type: "string",
    default: "1024x1024",
    pattern: "^[1-9]\\d*x[1-9]\\d*$",
    description: "OFOX 兼容尺寸 WIDTHxHEIGHT。MAI Image 2.5 Pro 的宽、高均至少 768，且总像素不超过 1,048,576。",
  };
  setResponseFormat(
    generationSchema.properties.response_format,
    "OFOX 兼容响应格式。MAI 原生输出始终为单张 PNG Base64；建议使用 b64_json。",
  );
  generation.description =
    "`microsoft/mai-image-2.5-pro` 支持文生图。当前网关暴露 `model`、`prompt`、`size` 和兼容 `response_format`；模型只生成 1 张 PNG。尺寸的宽、高均至少 768，总像素不超过 1,048,576。";
  generation["x-model-capabilities"] = {
    "microsoft/mai-image-2.5-pro": ["prompt", "size", "response_format"],
  };
  generationSchema.examples = [
    {
      model: "microsoft/mai-image-2.5-pro",
      prompt: "A cinematic mountain landscape at sunset.",
      size: "1024x1024",
      response_format: "b64_json",
    },
  ];
  setCompatibleImageResponse(generation, {
    created: 1788923928,
    data: [{ index: 0, b64_json: "iVBORw0KGgoAAAANSUhEUgAA..." }],
    model: "microsoft/mai-image-2.5-pro",
    output_format: "png",
    size: "1024x1024",
    usage: {
      input_tokens: 36,
      input_tokens_details: { text_tokens: 36 },
      output_tokens: 1024,
      output_tokens_details: { image_tokens: 1024 },
      total_tokens: 1060,
    },
  });

  editSchema.required = ["model", "images", "prompt"];
  setStringModel(editSchema.properties.model, ["microsoft/mai-image-2.5-pro"], "必填。MAI Image 2.5 Pro 的 Forward 模型 ID。");
  editSchema.properties.images.minItems = 1;
  editSchema.properties.images.maxItems = 1;
  editSchema.properties.images.description =
    "必填。单张 JPEG 或 PNG 源图。Forward JSON 兼容形式使用一项 file_id/image_url 对象。";
  editSchema.properties.size.description =
    "兼容输出尺寸。MAI 原生编辑接口不提供独立尺寸参数，是否生效取决于 OFOX 上游。";
  setResponseFormat(
    editSchema.properties.response_format,
    "OFOX 兼容响应格式。MAI 原生输出固定为单张 PNG Base64；建议使用 b64_json。",
  );
  edit.description =
    "`microsoft/mai-image-2.5-pro` 支持单张 JPEG/PNG 图片编辑。`model`、`images` 和 `prompt` 必填；输出固定为单张 PNG。";
  edit["x-model-capabilities"] = {
    "microsoft/mai-image-2.5-pro": ["images", "prompt", "size", "response_format"],
  };
  editSchema.examples = [
    {
      model: "microsoft/mai-image-2.5-pro",
      images: [{ image_url: "https://example.com/source-image.png" }],
      prompt: "Turn this image into a clean futuristic product shot.",
      size: "1024x1024",
      response_format: "b64_json",
    },
  ];
  save(file);
}

// NovelAI through TTAPI
{
  const file = load("novel-openapi.json");
  const generation = file.document.paths["/v1/images/generations"].post;
  const request = schema(generation);
  setStringModel(
    request.properties.model,
    ["nai-diffusion-4-5-full", "nai-diffusion-4-5-curated"],
    "必填。TTAPI 当前接入的 NovelAI Diffusion V4.5 模型。",
  );
  request.properties.images.maxItems = 16;
  request.properties.images.description =
    "可选。统一参考图数组。type=image（或省略）为单张图生图源图；type=vibe_transfer 为氛围参考；type=character_reference 为精确角色/风格参考。只能有 1 张普通图生图源图，vibe_transfer 与 character_reference 不能混用。";
  request.properties.hook_url = {
    type: "string",
    format: "uri",
    description: "可选。TTAPI 任务完成或失败时的回调地址。",
  };
  generation.description = [
    "`nai-diffusion-4-5-full` 与 `nai-diffusion-4-5-curated` 使用相同参数集：`prompt`、`images`、`negative_prompt`、`n`、`size`、`seed`、`steps`、`scale`、`quality_toggle`、`sampler`、`noise_schedule`、`character_prompts`、`hook_url` 和 `response_format`。",
    "",
    "`n` 为 1～4。普通图生图源图最多 1 张；`vibe_transfer` 与 `character_reference` 不能同时使用。NovelAI 没有独立 JSON 编辑端点，编辑仍通过本生成端点的 `images` 完成。",
  ].join("\n");
  generation["x-model-capabilities"] = {
    "nai-diffusion-4-5-full": ["prompt", "images", "negative_prompt", "n", "size", "seed", "steps", "scale", "quality_toggle", "sampler", "noise_schedule", "character_prompts", "hook_url", "response_format"],
    "nai-diffusion-4-5-curated": ["prompt", "images", "negative_prompt", "n", "size", "seed", "steps", "scale", "quality_toggle", "sampler", "noise_schedule", "character_prompts", "hook_url", "response_format"],
  };
  replaceStrings(
    file.document,
    new Map([
      ["diffusion-4-5-full", "nai-diffusion-4-5-full"],
      ["k_euler_ancestral", "Euler Ancestral"],
    ]),
  );
  save(file);
}

console.log("Synchronized image OpenAPI model capabilities.");
