#!/usr/bin/env node
/**
 * CLI Tool for Video Automation Studio
 * Command-line interface for script processing and slide generation
 */

import { Command } from "commander";
import * as fs from "fs/promises";
import * as path from "path";
import { createScript, normalizeScript, segmentScript } from "../services/scriptService";
import { loadTemplates, planSlides, generateMarpMarkdown, saveSlideSpecs } from "../services/slideService";
import { startServer } from "../api/server";

const program = new Command();

/**
 * LLM Client placeholder
 * TODO: Replace with actual LLM client implementation
 */
async function llmClient(prompt: string): Promise<string> {
  console.warn("⚠️  LLM client not configured. Please implement llmClient function.");
  throw new Error("LLM client not implemented");
}

/**
 * studio:ingest - Ingest a new script from markdown file
 */
program
  .command("studio:ingest")
  .description("Ingest a new script from markdown file")
  .argument("<file>", "Path to markdown file")
  .option("-t, --title <title>", "Script title")
  .option("-a, --author <author>", "Script author")
  .option("-o, --output <path>", "Output path for script JSON", "./data/scripts")
  .action(async (file: string, options: any) => {
    try {
      const markdown = await fs.readFile(file, "utf-8");
      const title = options.title || path.basename(file, ".md");

      const script = createScript(title, markdown, {
        author: options.author,
      });

      const outputDir = options.output;
      await fs.mkdir(outputDir, { recursive: true });

      const outputPath = path.join(outputDir, `${script.id}.json`);
      await fs.writeFile(outputPath, JSON.stringify(script, null, 2));

      console.log(`✅ Script ingested successfully`);
      console.log(`   ID: ${script.id}`);
      console.log(`   Title: ${script.title}`);
      console.log(`   Output: ${outputPath}`);
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * studio:normalize - Normalize a script
 */
program
  .command("studio:normalize")
  .description("Normalize a script using LLM")
  .argument("<scriptFile>", "Path to script JSON file")
  .option("-o, --output <path>", "Output path for normalized script")
  .action(async (scriptFile: string, options: any) => {
    try {
      const content = await fs.readFile(scriptFile, "utf-8");
      const script = JSON.parse(content);

      console.log("🤖 Normalizing script with LLM...");
      const normalized = await normalizeScript(script, llmClient);

      const outputPath = options.output || scriptFile;
      await fs.writeFile(outputPath, JSON.stringify(normalized, null, 2));

      console.log(`✅ Script normalized successfully`);
      console.log(`   Output: ${outputPath}`);
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * studio:segment - Segment a script into sections
 */
program
  .command("studio:segment")
  .description("Segment a normalized script into sections")
  .argument("<scriptFile>", "Path to script JSON file")
  .option("-o, --output <path>", "Output path for sections JSON")
  .action(async (scriptFile: string, options: any) => {
    try {
      const content = await fs.readFile(scriptFile, "utf-8");
      const script = JSON.parse(content);

      if (!script.normalized_markdown) {
        throw new Error("Script must be normalized before segmentation");
      }

      console.log("🤖 Segmenting script with LLM...");
      const sections = await segmentScript(script, llmClient);

      const outputPath = options.output || `./data/sections/${script.id}.json`;
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, JSON.stringify({ sections }, null, 2));

      console.log(`✅ Script segmented successfully`);
      console.log(`   Sections: ${sections.length}`);
      console.log(`   Output: ${outputPath}`);
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * slides:plan - Plan slides from sections
 */
program
  .command("slides:plan")
  .description("Plan slides from sections using LLM")
  .argument("<sectionsFile>", "Path to sections JSON file")
  .option("-t, --templates <path>", "Path to templates JSON")
  .option("-o, --output <path>", "Output path for slide specs JSON")
  .action(async (sectionsFile: string, options: any) => {
    try {
      const content = await fs.readFile(sectionsFile, "utf-8");
      const { sections } = JSON.parse(content);

      const templates = await loadTemplates(options.templates);

      console.log("🤖 Planning slides with LLM...");
      const slideSpecs = await planSlides(sections, templates, llmClient);

      const outputPath = options.output || "./data/slides/specs.json";
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await saveSlideSpecs(slideSpecs, outputPath);

      console.log(`✅ Slides planned successfully`);
      console.log(`   Specs: ${slideSpecs.length}`);
      console.log(`   Output: ${outputPath}`);
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * slides:render - Render slides to Marp markdown
 */
program
  .command("slides:render")
  .description("Render slides to Marp markdown")
  .argument("<specsFile>", "Path to slide specs JSON file")
  .option("-t, --templates <path>", "Path to templates JSON")
  .option("-o, --output <path>", "Output path for Marp markdown", "./output/slides.md")
  .action(async (specsFile: string, options: any) => {
    try {
      const content = await fs.readFile(specsFile, "utf-8");
      const { specs } = JSON.parse(content);

      const templates = await loadTemplates(options.templates);

      console.log("📝 Generating Marp markdown...");
      const markdown = generateMarpMarkdown(specs, templates);

      const outputPath = options.output;
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, markdown);

      console.log(`✅ Slides rendered successfully`);
      console.log(`   Output: ${outputPath}`);
      console.log(`   Use Marp CLI to convert to PDF/PNG:`);
      console.log(`   npx @marp-team/marp-cli ${outputPath} -o output.pdf`);
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * server:start - Start API server
 */
program
  .command("server:start")
  .description("Start the API server")
  .option("-p, --port <port>", "Port number", "3000")
  .action((options: any) => {
    const port = parseInt(options.port, 10);
    startServer(port);
  });

/**
 * info - Display system information
 */
program
  .command("info")
  .description("Display system information")
  .action(async () => {
    console.log("📊 Video Automation Studio");
    console.log("   Version: 1.0.0");
    console.log("   Node:", process.version);
    console.log("");
    console.log("Available commands:");
    console.log("   studio:ingest    - Ingest markdown script");
    console.log("   studio:normalize - Normalize script with LLM");
    console.log("   studio:segment   - Segment script into sections");
    console.log("   slides:plan      - Plan slides from sections");
    console.log("   slides:render    - Render slides to Marp markdown");
    console.log("   server:start     - Start API server");
  });

// Parse command line arguments
program.parse();
