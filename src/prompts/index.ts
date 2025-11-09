/**
 * LLM Prompt Management System
 * Provides structured prompts for each automation task
 */

import { LLMTaskRequest, Section, TemplateDef } from "../types";

/**
 * Build prompt for script normalization
 */
export function buildNormalizePrompt(scriptMarkdown: string): string {
  return `あなたは動画台本の校正AIです。
ルール:
- 文体: です・ます調に統一
- 誤変換/タイプミスの修正
- カタカナ外来語は原則そのまま。固有名は正式表記 (例: Remotion, Marp, Canva)
- 改行は意味段落ごと。1文は80字以内
- 相槌や言い淀みは残すが、重複は1回に圧縮

入力Markdown:
${scriptMarkdown}

出力は**Markdownのみ**。余計な説明は不要。`;
}

/**
 * Build prompt for section segmentation
 */
export function buildSegmentPrompt(normalizedMarkdown: string): string {
  return `あなたは台本のセクション分割AIです。
方針: 見出し・句点・話題転換・長さ(300〜600字)で分割。各セクションにintentsを付与（"summary","procedure","tip","caution","example"など）。
入出力はJSONのみ。

入力:
\`\`\`markdown
${normalizedMarkdown}
\`\`\`

出力(JSON):
{
  "sections": Section[]
}

Section型定義:
{
  "id": "sec-001",
  "scriptId": "script-id",
  "order": 1,
  "text": "セクション本文",
  "intents": ["summary", "procedure"]
}

必ず有効なJSONのみを返してください。`;
}

/**
 * Build prompt for slide specification
 */
export function buildSlideSpecPrompt(
  sections: Section[],
  templates: TemplateDef[]
): string {
  return `あなたはスライド構成AIです。テンプレ一覧のみ使用してSlideSpecを作成。
制約:

1スライドのテキストは行18文字×最大3行相当。

技術語は省略しない。

テンプレ外レイアウト禁止。

テンプレ(JSON):
${JSON.stringify({ templates }, null, 2)}

入力(JSON):
${JSON.stringify({ sections }, null, 2)}

出力(JSON):
{ "specs": SlideSpec[] }

SlideSpec型定義:
{
  "section_id": "sec-001",
  "slides": [
    {
      "template": "bullet-hero",
      "vars": {
        "title": "見出し",
        "bullets": ["要点1", "要点2", "要点3"]
      },
      "assets": []
    }
  ]
}

必ず有効なJSONのみを返してください。`;
}

/**
 * Build prompt for Remotion code generation
 */
export function buildRemotionPrompt(request: {
  script: any;
  slidesManifest: any;
  audioCatalog: any;
}): string {
  return `あなたは動画オーケストレーターAIです。
入力:

Script(JSON):
${JSON.stringify(request.script, null, 2)}

Slide manifest(JSON):
${JSON.stringify(request.slidesManifest, null, 2)}

SFX/BGMカタログ(JSON):
${JSON.stringify(request.audioCatalog, null, 2)}

ポーズ規則: 文継続=0.1s, トピック転換=0.3~0.4s, セクション区切り=0.5s

要件:

各発話を字幕として描画（日本語ルビ不要）

対応スライド画像の切替

BGMは-10dB基準、発話時は-16dBにダッキング

効果音は「SE:{キーワード}」が台本にある時のみ挿入

口パ・目パは amplitude ベースの擬似ロジック呼び出し

出力:

/src/compositions/Video.tsx のTypeScriptコード（コードブロック）

/src/timing/offsets.json のJSON（コードブロック）

Violation List（あれば）

必ず以下のフォーマットで返してください:

\`\`\`typescript
// Video.tsx
export const Video = () => {
  // ... your code
};
\`\`\`

\`\`\`json
[
  {"lineId": "l001", "startSec": 0.0, "endSec": 3.2, "gapAfterSec": 0.3}
]
\`\`\``;
}

/**
 * Build LLM request based on task type
 */
export function buildLLMRequest(request: LLMTaskRequest): string {
  switch (request.task) {
    case "normalize":
      if (!request.script_markdown) {
        throw new Error("script_markdown is required for normalize task");
      }
      return buildNormalizePrompt(request.script_markdown);

    case "segment":
      if (!request.script_markdown) {
        throw new Error("script_markdown is required for segment task");
      }
      return buildSegmentPrompt(request.script_markdown);

    case "slidespec":
      if (!request.sections_json || !request.templates_json) {
        throw new Error(
          "sections_json and templates_json are required for slidespec task"
        );
      }
      return buildSlideSpecPrompt(
        request.sections_json.sections,
        request.templates_json.templates
      );

    case "remotion":
      if (
        !request.script_json ||
        !request.slides_manifest_json ||
        !request.audio_catalog_json
      ) {
        throw new Error(
          "script_json, slides_manifest_json, and audio_catalog_json are required for remotion task"
        );
      }
      return buildRemotionPrompt({
        script: request.script_json,
        slidesManifest: request.slides_manifest_json,
        audioCatalog: request.audio_catalog_json,
      });

    default:
      throw new Error(`Unknown task type: ${request.task}`);
  }
}

/**
 * Parse LLM response based on task type
 */
export function parseLLMResponse(task: string, response: string): any {
  switch (task) {
    case "normalize":
      // Return as-is for normalized markdown
      return response.trim();

    case "segment":
    case "slidespec":
      // Parse JSON response
      try {
        // Extract JSON from code blocks if present
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[1]);
        }
        // Try parsing the entire response as JSON
        return JSON.parse(response);
      } catch (error) {
        throw new Error(
          `Failed to parse JSON response for ${task}: ${error}`
        );
      }

    case "remotion":
      // Extract both TypeScript and JSON code blocks
      const tsxMatch = response.match(
        /```(?:typescript|tsx)\s*([\s\S]*?)\s*```/
      );
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);

      if (!tsxMatch || !jsonMatch) {
        throw new Error(
          "Failed to extract TypeScript and JSON from remotion response"
        );
      }

      return {
        tsx: tsxMatch[1].trim(),
        offsets: JSON.parse(jsonMatch[1]),
      };

    default:
      return response;
  }
}
