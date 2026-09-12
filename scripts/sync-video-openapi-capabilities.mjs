#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const videosDirectory = join(scriptDirectory, "..", "zh", "apis", "videos");
const base = JSON.parse(
  await readFile(join(videosDirectory, "seedance-openapi.json"), "utf8"),
);

const zhPrompts = {
  text: "一只金毛寻回犬在日落时分的海滩上奔跑，镜头平稳跟随，画面具有自然细腻的电影质感。",
  image: "保持首帧中的人物外观与服装一致，让人物自然向前行走，镜头缓慢推进。",
  frames: "从首帧自然过渡到尾帧，保持主体、构图与视觉风格连贯。",
  reference: "保持参考素材中的人物身份与视觉风格，生成一段连贯的电影感短片。",
  extend: "延续原视频的镜头运动、主体动作与光线，让场景自然向后发展。",
};

const configurations = [
  {
    file: "seedance-openapi.json",
    name: "Seedance",
    provider: "字节跳动",
    defaultModel: "bytedance/seedance-2.5",
    source: "https://www.volcengine.com/docs/82379/1520758?lang=zh",
    sourceLabel: "火山方舟视频生成 API",
    capabilities: [
      {
        model: "bytedance/seedance-2.5",
        resolution: "480p / 720p / 1080p",
        duration: "4–30 秒；编辑/延长可用 -1 智能时长",
        modes: "文生、首帧、首尾帧、全模态参考、编辑、延长",
        audio: "支持",
        references: "最多 50 个参考项",
      },
      {
        model: "bytedance/seedance-2.0",
        resolution: "480p / 720p / 1080p / 4K",
        duration: "4–15 秒；编辑/延长可用 -1 智能时长",
        modes: "文生、首帧、首尾帧、全模态参考、编辑、延长",
        audio: "支持",
        references: "最多 15 个参考项",
      },
      {
        model: "bytedance/seedance-2.0-mini",
        resolution: "480p / 720p",
        duration: "4–15 秒",
        modes: "文生、首帧、首尾帧",
        audio: "支持",
        references: "不支持全模态参考、编辑或延长",
      },
    ],
    resolutions: ["480p", "720p", "1080p", "4K"],
    ratios: ["adaptive", "16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    duration: {
      oneOf: [
        { type: "integer", minimum: -1, maximum: 30 },
        { type: "string", pattern: "^(?:-1|[4-9]|[12][0-9]|30)$" },
      ],
      description: "视频时长（秒）。2.0 Mini 为 4–15；2.0 为 4–15；2.5 为 4–30。编辑或延长任务可传 -1 让模型按输入素材决定时长。",
    },
    frames: { maxItems: 2, types: ["first_frame", "last_frame"] },
    references: {
      maxItems: 50,
      fields: ["image_url", "video_url", "audio_url"],
      roles: ["reference_image", "reference_video", "reference_audio", "source_video", "first_clip"],
      description: "全模态参考素材。2.0 Mini 不支持；2.0 最多 15 项；2.5 最多 50 项。参考模式不能与首尾帧模式混用。",
    },
    supportsAudio: "支持生成音频；是否默认开启由模型与上游账号配置决定。",
    supportsSeed: true,
    extraBody: {
      description: "Seedance 上游扩展参数。",
      properties: {
        camera_fixed: { type: "boolean", description: "是否固定摄像头。" },
        watermark: { type: "boolean", description: "是否添加水印。" },
        return_last_frame: { type: "boolean", description: "是否在结果中返回最后一帧。" },
        omni_reference_task_type: {
          type: "string",
          enum: ["auto", "reference", "edit", "extend"],
          description: "全模态参考任务类型；编辑和延长由网关自动设置。",
        },
        output_format: { type: "string", enum: ["mp4", "mov"], default: "mp4" },
        service_tier: { type: "string", enum: ["default", "flex"] },
        priority: { type: "integer", minimum: 0, maximum: 9 },
      },
    },
    examples: [
      ["文生视频", { model: "bytedance/seedance-2.5", prompt: zhPrompts.text, duration: 8, resolution: "1080p", aspect_ratio: "16:9", generate_audio: true }],
      ["首帧生视频", { model: "bytedance/seedance-2.0-mini", prompt: zhPrompts.image, duration: 5, resolution: "720p", frame_images: [{ type: "first_frame", image_url: "https://example.com/assets/first-frame.jpg" }] }],
      ["首尾帧生视频", { model: "bytedance/seedance-2.0", prompt: zhPrompts.frames, duration: 8, resolution: "1080p", frame_images: [{ type: "first_frame", image_url: "https://example.com/assets/first-frame.jpg" }, { type: "last_frame", image_url: "https://example.com/assets/last-frame.jpg" }] }],
      ["全模态参考", { model: "bytedance/seedance-2.5", prompt: zhPrompts.reference, duration: 10, resolution: "720p", input_references: [{ image_url: "https://example.com/assets/character.jpg", role: "reference_image" }, { video_url: "https://example.com/assets/style.mp4", role: "reference_video" }, { audio_url: "https://example.com/assets/voice.mp3", role: "reference_audio" }] }],
    ],
  },
  {
    file: "wan-openapi.json",
    name: "Wan",
    provider: "阿里云百炼",
    defaultModel: "alibaba/wan-3.0",
    source: "https://help.aliyun.com/zh/model-studio/use-video-generation",
    sourceLabel: "阿里云视频生成模型总览",
    capabilities: [
      {
        model: "alibaba/wan-3.0",
        resolution: "480p / 720p / 1080p",
        duration: "2–30 秒或 -1 智能时长",
        modes: "文生、首帧、首尾帧、全模态参考",
        audio: "支持，默认开启",
        references: "10 图 / 5 视频 / 5 音频；另可传 1 个文件或链接",
      },
      {
        model: "alibaba/wan-2.7",
        resolution: "720p / 1080p",
        duration: "生成 2–15 秒；参考/编辑 2–10 秒",
        modes: "文生、首帧、首尾帧、续写、参考、编辑",
        audio: "支持",
        references: "模式相关",
      },
      {
        model: "alibaba/wan-2.6",
        resolution: "720p / 1080p",
        duration: "生成 2–15 秒；参考 2–10 秒",
        modes: "文生、首帧、参考；首尾帧/编辑使用兼容模型",
        audio: "支持；兼容模式可能无声",
        references: "参考生视频 1–5 个图片/视频",
      },
    ],
    modelEnum: ["alibaba/wan-3.0", "alibaba/wan3.0-video", "alibaba/wan-2.7", "alibaba/wan-2.6"],
    resolutions: ["480p", "720p", "1080p"],
    ratios: ["adaptive", "16:9", "9:16", "1:1", "4:3", "3:4"],
    duration: {
      oneOf: [
        { type: "integer", minimum: -1, maximum: 30 },
        { type: "string", pattern: "^(?:-1|[2-9]|[12][0-9]|30)$" },
      ],
      description: "视频时长（秒）。Wan 3.0 为 2–30 或 -1；Wan 2.7/2.6 的上限随生成模式变化，详见模型能力表。",
    },
    size: "仅 alibaba/wan-2.6 支持精确像素尺寸；其他 Wan 模型请使用 resolution + aspect_ratio。",
    negativePrompt: "Wan 2.6/2.7 可用。Wan 3.0 不支持顶层 negative_prompt；如上游扩展已支持，请放入 extra_body。",
    frames: { maxItems: 2, types: ["first_frame", "last_frame"] },
    references: {
      maxItems: 21,
      fields: ["image_url", "video_url", "audio_url", "file_url", "link_url"],
      roles: ["reference_image", "reference_video", "reference_audio", "source_video", "first_clip", "driving_audio", "file", "link"],
      description: "Wan 参考素材。不同模型和模式的数量限制不同；Wan 3.0 的参考素材不能与首尾帧混用，file 与 link 互斥。",
    },
    supportsAudio: "是否生成音频。Wan 3.0 默认开启；Wan 2.6/2.7 的具体行为由模式决定。",
    supportsSeed: true,
    extraBody: {
      description: "阿里云百炼视频模型扩展参数。字段会合并到上游 parameters。",
      properties: {
        prompt_extend: { type: "boolean", description: "是否开启提示词改写。" },
        shot_type: { type: "string", enum: ["single", "multi"], description: "单镜头或多镜头。" },
        watermark: { type: "boolean", description: "是否添加水印。" },
        audio_setting: { type: "string", enum: ["auto", "origin"], description: "视频编辑时的音频处理方式。" },
      },
    },
    examples: [
      ["文生视频", { model: "alibaba/wan-3.0", prompt: zhPrompts.text, duration: 8, resolution: "1080p", aspect_ratio: "16:9", generate_audio: true }],
      ["首尾帧生视频", { model: "alibaba/wan-3.0", prompt: zhPrompts.frames, duration: 8, resolution: "720p", aspect_ratio: "adaptive", frame_images: [{ type: "first_frame", image_url: "https://example.com/assets/first-frame.jpg" }, { type: "last_frame", image_url: "https://example.com/assets/last-frame.jpg" }] }],
      ["全模态参考", { model: "alibaba/wan-3.0", prompt: zhPrompts.reference, duration: 10, resolution: "720p", input_references: [{ image_url: "https://example.com/assets/character.jpg", role: "reference_image" }, { video_url: "https://example.com/assets/style.mp4", role: "reference_video" }, { audio_url: "https://example.com/assets/voice.mp3", role: "reference_audio" }] }],
    ],
  },
  {
    file: "happy-horse-openapi.json",
    name: "HappyHorse",
    provider: "阿里云百炼",
    defaultModel: "alibaba/happyhorse-1.1",
    source: "https://help.aliyun.com/en/model-studio/video-generate-edit-model/",
    sourceLabel: "阿里云视频生成与编辑模型",
    capabilities: [
      {
        model: "alibaba/happyhorse-1.1",
        resolution: "480p / 720p / 1080p",
        duration: "3–15 秒",
        modes: "文生、首帧图生、1–9 图参考",
        audio: "上游生成有声视频；无开关",
        references: "不支持尾帧、视频编辑或延长",
      },
      {
        model: "alibaba/happyhorse-1.0",
        resolution: "480p / 720p / 1080p；编辑仅 720p / 1080p",
        duration: "3–15 秒；编辑跟随输入视频",
        modes: "文生、首帧图生、1–9 图参考、视频编辑",
        audio: "无 generate_audio；编辑可用 audio_setting",
        references: "不支持尾帧或视频延长",
      },
    ],
    resolutions: ["480p", "720p", "1080p"],
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "4:5", "5:4", "21:9", "9:21"],
    duration: { type: "integer", minimum: 3, maximum: 15, description: "输出时长为 3–15 秒。视频编辑忽略该字段并沿用输入视频时长。" },
    frames: { maxItems: 1, types: ["first_frame"], description: "仅支持一张首帧图，不支持尾帧或首尾帧插值。" },
    references: {
      maxItems: 9,
      fields: ["image_url", "video_url"],
      roles: ["reference_image", "source_video"],
      description: "参考生视频仅接受 1–9 张 reference_image。happyhorse-1.0 视频编辑接受 1 个 source_video 和最多 5 张 reference_image。",
    },
    supportsSeed: true,
    extraBody: {
      description: "HappyHorse 上游扩展参数。",
      properties: {
        watermark: { type: "boolean", description: "是否添加 HappyHorse 水印。" },
        audio_setting: { type: "string", enum: ["auto", "origin"], description: "仅视频编辑：自动处理音频或保留原音频。" },
      },
    },
    examples: [
      ["文生视频", { model: "alibaba/happyhorse-1.1", prompt: zhPrompts.text, duration: 5, resolution: "1080p", aspect_ratio: "16:9" }],
      ["首帧生视频", { model: "alibaba/happyhorse-1.1", prompt: zhPrompts.image, duration: 5, resolution: "720p", frame_images: [{ type: "first_frame", image_url: "https://example.com/assets/first-frame.jpg" }] }],
      ["参考生视频", { model: "alibaba/happyhorse-1.1", prompt: zhPrompts.reference, duration: 8, resolution: "720p", input_references: [{ image_url: "https://example.com/assets/character-front.jpg", role: "reference_image" }, { image_url: "https://example.com/assets/character-side.jpg", role: "reference_image" }] }],
      ["视频编辑", { model: "alibaba/happyhorse-1.0", prompt: "把人物服装替换成参考图中的外套，保持原视频动作和镜头不变。", resolution: "720p", input_references: [{ video_url: "https://example.com/assets/source.mp4", role: "source_video" }, { image_url: "https://example.com/assets/coat.jpg", role: "reference_image" }], extra_body: { audio_setting: "origin", watermark: false } }],
    ],
  },
  {
    file: "minimax-openapi.json",
    name: "MiniMax H3",
    provider: "MiniMax",
    defaultModel: "minimax/minimax-h3",
    source: "https://platform.minimax.io/docs/api-reference/video-generation-v2-create",
    sourceLabel: "MiniMax H3 视频生成 V2 API",
    capabilities: [
      {
        model: "minimax/minimax-h3",
        resolution: "768p / 2K",
        duration: "4–15 秒",
        modes: "文生、首帧、尾帧、首尾帧、全模态参考",
        audio: "原生有声输出；无 generate_audio 开关",
        references: "9 图 / 3 视频 / 3 音频",
      },
    ],
    resolutions: ["768p", "768P", "2k", "2K"],
    ratios: ["adaptive", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    duration: { type: "integer", minimum: 4, maximum: 15, description: "必填。MiniMax H3 支持 4–15 秒整数时长。" },
    frames: { maxItems: 2, types: ["first_frame", "last_frame"] },
    references: {
      maxItems: 15,
      fields: ["image_url", "video_url", "audio_url"],
      roles: ["reference_image", "reference_video", "reference_audio"],
      description: "全模态参考素材：最多 9 张图、3 段视频和 3 段音频。参考模式与首/尾帧模式互斥。",
    },
    extraBody: {
      description: "MiniMax H3 扩展参数。",
      properties: { watermark: { type: "boolean", description: "是否添加水印。" } },
    },
    additionalRequired: ["prompt", "duration", "resolution"],
    examples: [
      ["文生视频", { model: "minimax/minimax-h3", prompt: zhPrompts.text, duration: 5, resolution: "2K", aspect_ratio: "16:9" }],
      ["首尾帧生视频", { model: "minimax/minimax-h3", prompt: zhPrompts.frames, duration: 8, resolution: "768p", aspect_ratio: "adaptive", frame_images: [{ type: "first_frame", image_url: "https://example.com/assets/first-frame.jpg" }, { type: "last_frame", image_url: "https://example.com/assets/last-frame.jpg" }] }],
      ["全模态参考", { model: "minimax/minimax-h3", prompt: zhPrompts.reference, duration: 10, resolution: "768p", aspect_ratio: "16:9", input_references: [{ image_url: "https://example.com/assets/character.jpg", role: "reference_image" }, { video_url: "https://example.com/assets/camera.mp4", role: "reference_video" }, { audio_url: "https://example.com/assets/music.mp3", role: "reference_audio" }] }],
    ],
  },
  {
    file: "veo-openapi.json",
    name: "Veo",
    provider: "Google（经 TTAPI）",
    defaultModel: "google/veo-3.1-fast",
    source: "https://ai.google.dev/gemini-api/docs/veo?hl=en",
    sourceLabel: "Google Veo 3.1 API",
    routeSource: "https://ttapi.io/models/gemini-veo-3.1-fast",
    capabilities: [
      {
        model: "google/veo-3.1-fast",
        resolution: "720p / 1080p",
        duration: "当前网关固定 8 秒",
        modes: "文生、首帧、首尾帧、最多 3 图参考",
        audio: "始终生成，不能关闭",
        references: "不支持视频输入/延长的统一入口",
      },
      {
        model: "google/veo-3.1-quality",
        resolution: "720p / 1080p",
        duration: "当前网关固定 8 秒",
        modes: "文生、首帧、首尾帧、最多 3 图参考",
        audio: "始终生成，不能关闭",
        references: "不支持视频输入/延长的统一入口",
      },
      {
        model: "google/veo-3.1-lite",
        resolution: "720p / 1080p",
        duration: "当前网关固定 8 秒",
        modes: "文生、首帧、首尾帧；不支持普通参考图模式",
        audio: "始终生成，不能关闭",
        references: "不支持视频输入/延长的统一入口",
      },
    ],
    resolutions: ["720p", "1080p"],
    ratios: ["16:9", "9:16"],
    duration: { oneOf: [{ type: "integer", const: 8 }, { type: "string", const: "8" }], description: "当前 Tikway 路由固定生成 8 秒视频。Google 原生 Veo 3.1 还支持 4 秒和 6 秒，但当前网关尚未开放。" },
    frames: { maxItems: 2, types: ["first_frame", "last_frame"] },
    references: {
      maxItems: 3,
      fields: ["image_url"],
      roles: ["reference_image"],
      description: "最多 3 张参考图。Veo 3.1 Lite 不支持普通参考图模式；首帧和尾帧请使用 frame_images。",
    },
    extraBody: {
      description: "TTAPI Veo 扩展参数。通常无需设置，网关会根据 frame_images 或 input_references 自动选择 generation_type。",
      properties: { generation_type: { type: "string", enum: ["frame", "reference"] } },
    },
    additionalRequired: ["prompt"],
    examples: [
      ["文生视频", { model: "google/veo-3.1-fast", prompt: zhPrompts.text, duration: 8, resolution: "1080p", aspect_ratio: "16:9" }],
      ["首尾帧生视频", { model: "google/veo-3.1-quality", prompt: zhPrompts.frames, duration: 8, resolution: "1080p", aspect_ratio: "16:9", frame_images: [{ type: "first_frame", image_url: "https://example.com/assets/first-frame.jpg" }, { type: "last_frame", image_url: "https://example.com/assets/last-frame.jpg" }] }],
      ["参考生视频", { model: "google/veo-3.1-quality", prompt: zhPrompts.reference, duration: 8, resolution: "720p", aspect_ratio: "9:16", input_references: [{ image_url: "https://example.com/assets/character.jpg", role: "reference_image" }, { image_url: "https://example.com/assets/product.jpg", role: "reference_image" }] }],
    ],
  },
  {
    file: "grok-openapi.json",
    name: "Grok Imagine Video",
    provider: "xAI（经 TTAPI）",
    defaultModel: "x-ai/grok-imagine-video-1.5-fast",
    source: "https://docs.x.ai/developers/model-capabilities/video/generation",
    sourceLabel: "xAI 视频生成文档",
    routeSource: "https://ttapi.io/models/grok-imagine-video",
    capabilities: [
      {
        model: "x-ai/grok-imagine-video-1.5-fast",
        resolution: "480p / 720p",
        duration: "6–30 秒",
        modes: "文生、最多 7 图参考、首尾帧",
        audio: "上游默认有声；当前统一字段不能关闭",
        references: "非官方高速通道",
      },
      {
        model: "x-ai/grok-imagine-video-1.5",
        resolution: "480p / 720p / 1080p",
        duration: "1–15 秒",
        modes: "当前网关要求恰好 1 张图；可带最多 3 个预设音色",
        audio: "默认有声；当前统一字段不能关闭",
        references: "不支持尾帧",
      },
      {
        model: "x-ai/grok-imagine-video",
        resolution: "480p / 720p",
        duration: "生成 1–15 秒；延长 1–10 秒",
        modes: "文生、多图参考、视频延长",
        audio: "上游默认有声；当前统一字段不能关闭",
        references: "不支持尾帧",
      },
    ],
    resolutions: ["480p", "720p", "1080p"],
    ratios: ["2:3", "3:2", "1:1", "9:16", "16:9"],
    duration: { type: "integer", minimum: 1, maximum: 30, description: "模型相关：1.5 Fast 为 6–30 秒；1.5 和基础版为 1–15 秒；基础版视频延长为 1–10 秒。" },
    frames: { maxItems: 2, types: ["first_frame", "last_frame"], description: "1.5 Fast 支持首尾帧；1.5 与基础版仅能把一张图作为首帧，不能传 last_frame。" },
    references: {
      maxItems: 7,
      fields: ["image_url", "video_url", "audio_url"],
      roles: ["reference_image", "source_video", "first_clip", "reference_audio"],
      description: "图片参考最多 7 张；1.5 当前路由要求恰好 1 张图。视频仅供基础版延长。1.5 可传最多 3 个 reference_audio，并在 reference_voice 中填写预设 voice_id；audio_url 仅作统一协议占位。",
    },
    extraBody: {
      description: "Grok TTAPI 扩展参数。建议优先使用统一字段。",
      properties: {},
    },
    additionalRequired: ["prompt"],
    examples: [
      ["快速文生视频", { model: "x-ai/grok-imagine-video-1.5-fast", prompt: zhPrompts.text, duration: 10, resolution: "720p", aspect_ratio: "16:9" }],
      ["1080p 首帧生视频", { model: "x-ai/grok-imagine-video-1.5", prompt: zhPrompts.image, duration: 10, resolution: "1080p", aspect_ratio: "16:9", frame_images: [{ type: "first_frame", image_url: "https://example.com/assets/first-frame.jpg" }] }],
      ["首尾帧生视频", { model: "x-ai/grok-imagine-video-1.5-fast", prompt: zhPrompts.frames, duration: 10, resolution: "720p", aspect_ratio: "16:9", frame_images: [{ type: "first_frame", image_url: "https://example.com/assets/first-frame.jpg" }, { type: "last_frame", image_url: "https://example.com/assets/last-frame.jpg" }] }],
      ["视频延长", { model: "x-ai/grok-imagine-video", prompt: zhPrompts.extend, duration: 6, resolution: "720p", input_references: [{ video_url: "https://example.com/assets/source.mp4", role: "first_clip" }] }],
    ],
  },
  {
    file: "flux-openapi.json",
    name: "FLUX 3 Video",
    provider: "Black Forest Labs（经 TTAPI）",
    defaultModel: "black-forest-labs/flux-3-video",
    source: "https://ttapi.io/models/flux-3-video",
    sourceLabel: "TTAPI FLUX 3 Video",
    capabilities: [
      {
        model: "black-forest-labs/flux-3-video",
        resolution: "HD / FHD（统一字段映射 480p/720p → HD，1080p → FHD）",
        duration: "5–20 秒或 auto",
        modes: "文生、1–10 关键帧、视频续写、草稿增强",
        audio: "支持，默认开启",
        references: "不支持普通音频/视频风格参考",
      },
    ],
    resolutions: ["480p", "720p", "1080p"],
    ratios: ["auto", "21:9", "2:1", "16:9", "4:3", "1:1", "3:4", "9:16"],
    duration: {
      oneOf: [{ type: "integer", minimum: 5, maximum: 20 }, { type: "string", enum: ["auto"] }],
      description: "5–20 秒整数，或 auto 让模型按内容决定时长。",
    },
    frames: { maxItems: 2, types: ["first_frame", "last_frame"], description: "首帧/尾帧快捷写法。更多关键帧请通过 input_references 传 1–10 张 reference_image，或在 extra_body.keyframes 中指定带时间点的关键帧。" },
    references: {
      maxItems: 10,
      fields: ["image_url", "video_url"],
      roles: ["reference_image", "source_video", "first_clip"],
      description: "图生视频可传 1–10 张 reference_image 作为关键帧；视频续写必须且只能传 1 个 source_video 或 first_clip。",
    },
    supportsAudio: "是否生成同步音频，默认 true。",
    extraBody: {
      description: "FLUX 3 Video 原生扩展参数。",
      properties: {
        mode: { type: "string", enum: ["text_to_video", "image_to_video", "video_to_video", "draft_enhance"] },
        keyframes: { oneOf: [{ type: "string" }, { type: "array", items: {} }], description: "1–10 张图片，或按 [秒数, 图片 URL] 排列的定时关键帧。" },
        start_video: { type: "string", format: "uri", description: "视频续写输入。" },
        draft_cache: { type: "string", description: "草稿增强所需的缓存 URL 或 Base64。" },
        version: { type: "string", enum: ["latest"] },
        safety_tolerance: { type: "integer", minimum: 0, maximum: 4, default: 2 },
        draft: { type: "boolean", default: false, description: "是否先生成低成本 HD 草稿。" },
      },
    },
    examples: [
      ["文生视频", { model: "black-forest-labs/flux-3-video", prompt: zhPrompts.text, duration: 8, resolution: "1080p", aspect_ratio: "16:9", generate_audio: true }],
      ["首尾帧生视频", { model: "black-forest-labs/flux-3-video", prompt: zhPrompts.frames, duration: 10, resolution: "720p", frame_images: [{ type: "first_frame", image_url: "https://example.com/assets/first-frame.jpg" }, { type: "last_frame", image_url: "https://example.com/assets/last-frame.jpg" }] }],
      ["多关键帧", { model: "black-forest-labs/flux-3-video", prompt: "按三个关键画面生成连续的电影分镜。", duration: 12, resolution: "720p", input_references: [{ image_url: "https://example.com/assets/keyframe-1.jpg", role: "reference_image" }, { image_url: "https://example.com/assets/keyframe-2.jpg", role: "reference_image" }, { image_url: "https://example.com/assets/keyframe-3.jpg", role: "reference_image" }] }],
      ["视频续写", { model: "black-forest-labs/flux-3-video", prompt: zhPrompts.extend, duration: 8, resolution: "1080p", input_references: [{ video_url: "https://example.com/assets/source.mp4", role: "first_clip" }] }],
    ],
  },
];

function clone(value) {
  return structuredClone(value);
}

function modelEnum(configuration) {
  return configuration.modelEnum ?? configuration.capabilities.map(({ model }) => model);
}

function capabilityDescription(configuration) {
  const lines = [
    `通过统一的 \`POST /v1/videos\` 创建 ${configuration.name} 视频任务。模型能力以当前 Tikway 网关实际可调用范围为准。`,
    "",
    "| 模型 | 分辨率 | 时长 | 支持模式 | 音频 | 参考限制 |",
    "| --- | --- | --- | --- | --- | --- |",
    ...configuration.capabilities.map(
      (item) => `| \`${item.model}\` | ${item.resolution} | ${item.duration} | ${item.modes} | ${item.audio} | ${item.references} |`,
    ),
    "",
    `来源：[${configuration.sourceLabel}](${configuration.source})${configuration.routeSource ? `、[当前上游路由](${configuration.routeSource})` : ""}。官网能力与当前网关未开放能力之间的差异见本次审计报告。`,
  ];
  return lines.join("\n");
}

function urlProperty(label) {
  return {
    type: "string",
    minLength: 1,
    format: "uri",
    description: `${label} URL 字符串。`,
  };
}

function referenceSchema(configuration) {
  const labels = {
    image_url: "图片",
    video_url: "视频",
    audio_url: "音频",
    file_url: "文件",
    link_url: "网页",
  };
  const properties = {
    type: {
      type: "string",
      enum: configuration.references.fields,
      description: "可选。素材类型；若提供，必须与对应 URL 字段一致。",
    },
    role: {
      type: "string",
      enum: configuration.references.roles,
      description: "素材用途。省略时按 URL 字段推断为普通参考素材。",
    },
  };
  for (const field of configuration.references.fields) {
    properties[field] = urlProperty(labels[field]);
  }
  if (configuration.references.roles.includes("reference_audio")) {
    properties.reference_voice = {
      type: "string",
      minLength: 1,
      description: "预设音色 ID；仅部分支持音色参考的模型使用。",
    };
  }
  return {
    type: "array",
    maxItems: configuration.references.maxItems,
    description: configuration.references.description,
    items: {
      type: "object",
      oneOf: configuration.references.fields.map((field) => ({ required: [field] })),
      properties,
      additionalProperties: false,
    },
  };
}

function requestSchema(configuration) {
  const properties = {
    model: {
      type: "string",
      enum: modelEnum(configuration),
      description: `${configuration.name} 模型 ID。`,
    },
    prompt: { type: "string", minLength: 1, description: "视频生成或编辑提示词。" },
  };
  if (configuration.negativePrompt) {
    properties.negative_prompt = { type: "string", description: configuration.negativePrompt };
  }
  if (configuration.size) {
    properties.size = {
      type: "string",
      pattern: "^[1-9][0-9]*[x*][1-9][0-9]*$",
      description: configuration.size,
    };
  }
  properties.duration = clone(configuration.duration);
  properties.aspect_ratio = {
    type: "string",
    enum: configuration.ratios,
    description: "视频宽高比。图生视频时，部分模型会按输入素材自动决定比例。",
  };
  properties.resolution = {
    type: "string",
    enum: configuration.resolutions,
    description: "输出分辨率。不同模型或模式的可用值见模型能力表。",
  };
  if (configuration.frames) {
    properties.frame_images = {
      type: "array",
      maxItems: configuration.frames.maxItems,
      description: configuration.frames.description ?? "首帧或尾帧参考图；同一类型最多一张。",
      items: {
        type: "object",
        required: ["type", "image_url"],
        properties: {
          type: { type: "string", enum: configuration.frames.types, description: "参考帧位置。" },
          image_url: urlProperty("参考图"),
        },
        additionalProperties: false,
      },
    };
  }
  if (configuration.references) {
    properties.input_references = referenceSchema(configuration);
  }
  if (configuration.supportsAudio) {
    properties.generate_audio = { type: "boolean", description: configuration.supportsAudio };
  }
  if (configuration.supportsSeed) {
    properties.seed = {
      type: "integer",
      minimum: -1,
      maximum: 2147483647,
      description: "随机种子。固定种子只能提高可复现性，不保证输出完全一致。",
    };
  }
  properties.callback_url = {
    type: "string",
    format: "uri",
    pattern: "^https://",
    description: "用户任务回调地址。由 Tikway 在任务状态变化后调用，不直接传给模型上游。",
  };
  properties.extra_body = {
    type: "object",
    description: configuration.extraBody.description,
    properties: configuration.extraBody.properties,
    additionalProperties: false,
  };
  return {
    title: `${configuration.name}VideoCreateRequest`,
    description: `创建 ${configuration.name} 视频任务。参数按当前 Tikway 网关能力收窄；模型之间的差异见 operation 描述与 x-model-capabilities。`,
    type: "object",
    required: [...new Set(["model", ...(configuration.additionalRequired ?? [])])],
    properties,
    additionalProperties: false,
    "x-model-capabilities": configuration.capabilities,
  };
}

function examples(configuration) {
  return Object.fromEntries(
    configuration.examples.map(([summary, value]) => [summary, { summary, value }]),
  );
}

function replaceExampleModels(value, defaultModel) {
  if (Array.isArray(value)) {
    for (const item of value) replaceExampleModels(item, defaultModel);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (key === "model" && typeof child === "string") value[key] = defaultModel;
    else replaceExampleModels(child, defaultModel);
  }
}

for (const configuration of configurations) {
  const spec = clone(base);
  spec.info = {
    title: `Tikway ${configuration.name} 视频 API`,
    description: `${configuration.provider} ${configuration.name} 模型的 OpenAI 兼容异步视频生成接口。`,
    version: "1.1.0",
  };
  spec.tags = [{ name: "视频生成" }, { name: `视频生成/${configuration.name}` }];
  const create = spec.paths["/v1/videos"].post;
  const retrieve = spec.paths["/v1/videos/{id}"].get;
  create.tags = [`视频生成/${configuration.name}`];
  retrieve.tags = [`视频生成/${configuration.name}`];
  create.summary = `创建 ${configuration.name} 视频`;
  retrieve.summary = `查询 ${configuration.name} 视频任务`;
  create.description = capabilityDescription(configuration);
  create.requestBody.content["application/json"].schema = requestSchema(configuration);
  create.requestBody.content["application/json"].examples = examples(configuration);
  replaceExampleModels(create.responses, configuration.defaultModel);
  replaceExampleModels(retrieve.responses, configuration.defaultModel);
  await writeFile(
    join(videosDirectory, configuration.file),
    `${JSON.stringify(spec, null, 2)}\n`,
    "utf8",
  );
  console.log(`updated ${configuration.file}`);
}
