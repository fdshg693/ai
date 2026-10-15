import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildPublication } from "../scripts/build-catalog.mjs";
import {
  AI_INDEX_SCHEMA_VERSION,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  attachSkillEmbeddings,
  buildEmbeddingText,
  hashEmbeddingText,
} from "../scripts/build-skill-embeddings.mjs";
import { discoverSkills, parseSkillDocument, skillBundleFolder, zipFileName } from "../scripts/publication-core.mjs";
import { REPO_TOOLS_REGISTRY } from "../scripts/repo-tools-registry.mjs";
import { validatePublication, zipEntries } from "../scripts/validate-publication.mjs";

/** Deterministic stub so publication tests never call OpenRouter. */
async function stubAttachEmbeddings(skills) {
  return skills.map((skill) => {
    const text = buildEmbeddingText(skill);
    return {
      path: skill.path,
      name: skill.name,
      description: skill.description,
      tool: skill.tool,
      plugin: skill.plugin,
      status: { key: skill.status.key },
      embedding: Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => (i === 0 ? 1 : 0)),
      embeddingHash: hashEmbeddingText(text),
    };
  });
}

function publicationOptions(fixture, output) {
  return {
    repoRoot: fixture.root,
    registry: fixture.registry,
    generatedRoot: path.join(output, "generated"),
    downloadRoot: path.join(output, "downloads"),
    aiIndexPath: path.join(output, "ai-index.json"),
    searchIndexPath: path.join(output, "search-index.json"),
    attachEmbeddings: stubAttachEmbeddings,
  };
}

async function fixtureRepo() {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "skill-site-test-"));
  const skillRoot = path.join(root, "tool", "plugin", "skills");
  await fs.promises.mkdir(path.join(skillRoot, "parent", "child"), { recursive: true });
  await fs.promises.mkdir(path.join(skillRoot, "duplicate"), { recursive: true });
  await fs.promises.writeFile(path.join(skillRoot, "parent", "SKILL.md"), "---\nname: same-name\ndescription: parent\nmeta:\n  status: stable\n---\n# Parent\n");
  await fs.promises.writeFile(path.join(skillRoot, "parent", "child", "SKILL.md"), "---\nname: same-name\ndescription: child\nmeta:\n  status: experimental\n---\n# Child\n");
  await fs.promises.writeFile(path.join(skillRoot, "parent", ".env"), "SECRET=true\n");
  await fs.promises.writeFile(path.join(skillRoot, "parent", ".ENV"), "SECRET=true\n");
  await fs.promises.writeFile(path.join(skillRoot, "parent", ".env.example"), "SECRET=false\n");
  await fs.promises.writeFile(path.join(skillRoot, "parent", "reference.md"), "reference");
  await fs.promises.writeFile(path.join(skillRoot, "duplicate", "SKILL.md"), "---\nname: same-name\ndescription: duplicate\nmeta:\n  status: future\n---\n");
  return { root, registry: [{ id: "fixture", tool: "Fixture Tool", plugin: "fixture", root: "tool/plugin/skills" }] };
}

test("parses known, unset, and unknown status values", () => {
  assert.equal(parseSkillDocument("---\nname: a\ndescription: b\n---\nbody", "a").status.key, "unset");
  assert.equal(
    parseSkillDocument("---\nname: a\ndescription: b\nmeta:\n  status: stable\n---\nbody", "a").status.key,
    "stable",
  );
  assert.equal(
    parseSkillDocument("---\nname: a\ndescription: b\nmeta:\n  status: future\n---\nbody", "a").status.key,
    "unknown",
  );
});

test("normalizes the meta block to always have all 9 keys, backfilling defaults", () => {
  const noMeta = parseSkillDocument("---\nname: a\ndescription: b\n---\nbody", "a").meta;
  assert.deepEqual(Object.keys(noMeta).sort(), [
    "dependencies",
    "description",
    "requiresEnv",
    "requiresHooks",
    "requiresInstall",
    "requiresRepoTools",
    "requiresSkills",
    "status",
    "version",
  ]);
  assert.equal(noMeta.status, "draft");
  assert.equal(noMeta.requiresSkills, "none");

  const withMeta = parseSkillDocument(
    "---\nname: a\ndescription: b\nmeta:\n  status: stable\n  requires_skills: ms-learn, aim-cli\n  requires_repo_tools: tools/aim\n---\nbody",
    "a",
  ).meta;
  assert.equal(withMeta.status, "stable");
  assert.equal(withMeta.requiresSkills, "ms-learn, aim-cli");
  assert.equal(withMeta.requiresRepoTools, "tools/aim");
});

test("publishes nested skills independently and excludes only .env files", async () => {
  const fixture = await fixtureRepo();
  const output = path.join(fixture.root, "output");
  const result = await buildPublication(publicationOptions(fixture, output));
  assert.equal(result.catalog.skills.length, 3);
  assert.equal(new Set(result.catalog.skills.map((skill) => skill.id)).size, 3);
  const parent = result.catalog.skills.find((skill) => skill.name === "same-name" && skill.description === "parent");
  assert.ok(parent.files.some((file) => file.path === ".env.example"));
  assert.ok(!parent.files.some((file) => file.path.toLowerCase() === ".env"));
  const archive = await fs.promises.readFile(path.join(output, parent.download));
  assert.match(archive.toString("binary"), /PK\x03\x04/);
  assert.equal((await discoverSkills({ repoRoot: fixture.root, registry: fixture.registry })).warnings.length, 1);

  assert.equal(result.aiIndex.schemaVersion, AI_INDEX_SCHEMA_VERSION);
  assert.equal(result.aiIndex.embeddingModel, EMBEDDING_MODEL);
  assert.equal(result.aiIndex.embeddingDimensions, EMBEDDING_DIMENSIONS);
  assert.equal(result.aiIndex.skills.length, 3);
  const aiParent = result.aiIndex.skills.find((skill) => skill.name === "same-name" && skill.description === "parent");
  assert.deepEqual(Object.keys(aiParent).sort(), [
    "description",
    "embedding",
    "embeddingHash",
    "name",
    "path",
    "plugin",
    "status",
    "tool",
  ]);
  assert.equal(aiParent.path, parent.path);
  assert.equal(aiParent.tool, parent.tool);
  assert.equal(aiParent.plugin, parent.plugin);
  assert.deepEqual(aiParent.status, { key: parent.status.key });
  assert.equal(aiParent.embedding.length, EMBEDDING_DIMENSIONS);
  assert.equal(aiParent.embeddingHash, hashEmbeddingText(buildEmbeddingText(aiParent)));
});

test("rejects malformed frontmatter", () => {
  assert.throws(() => parseSkillDocument("---\nname: [broken\n---\n", "broken"), /invalid YAML frontmatter/);
});

test("ignores SKILL.md files outside registered roots instead of erroring", async () => {
  const fixture = await fixtureRepo();
  await fs.promises.mkdir(path.join(fixture.root, "unregistered"), { recursive: true });
  await fs.promises.writeFile(path.join(fixture.root, "unregistered", "SKILL.md"), "---\nname: x\ndescription: y\n---\n");
  const { skills } = await discoverSkills({ repoRoot: fixture.root, registry: fixture.registry });
  assert.equal(skills.length, 3);
  assert.ok(!skills.some((skill) => skill.id.startsWith("unregistered")));
});

test("overrides can exclude a registered skill or an entire registered source", async () => {
  const fixture = await fixtureRepo();
  const excludedSkill = await discoverSkills({
    repoRoot: fixture.root,
    registry: fixture.registry,
    overrides: { excludeSkills: ["tool/plugin/skills/duplicate/SKILL.md"] },
  });
  assert.equal(excludedSkill.skills.length, 2);
  assert.ok(!excludedSkill.skills.some((skill) => skill.id === "tool/plugin/skills/duplicate/SKILL.md"));

  const excludedSource = await discoverSkills({
    repoRoot: fixture.root,
    registry: fixture.registry,
    overrides: { excludeSources: ["fixture"] },
  });
  assert.equal(excludedSource.skills.length, 0);
});

test("resolves requires_skills to unique/none/multiple matches, and requires_repo_tools to existing/missing paths", async () => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "skill-site-test-"));
  const skillRoot = path.join(root, "tool", "plugin", "skills");
  await fs.promises.mkdir(path.join(skillRoot, "target"), { recursive: true });
  await fs.promises.mkdir(path.join(skillRoot, "dup-a"), { recursive: true });
  await fs.promises.mkdir(path.join(skillRoot, "dup-b"), { recursive: true });
  await fs.promises.mkdir(path.join(skillRoot, "consumer"), { recursive: true });
  await fs.promises.mkdir(path.join(root, "tools", "aim"), { recursive: true });
  await fs.promises.writeFile(path.join(root, "tools", "aim", "README.md"), "existing repo tool\n");

  await fs.promises.writeFile(
    path.join(skillRoot, "target", "SKILL.md"),
    "---\nname: target-skill\ndescription: target\n---\n",
  );
  await fs.promises.writeFile(
    path.join(skillRoot, "dup-a", "SKILL.md"),
    "---\nname: dup-skill\ndescription: dup a\n---\n",
  );
  await fs.promises.writeFile(
    path.join(skillRoot, "dup-b", "SKILL.md"),
    "---\nname: dup-skill\ndescription: dup b\n---\n",
  );
  await fs.promises.writeFile(
    path.join(skillRoot, "consumer", "SKILL.md"),
    [
      "---",
      "name: consumer-skill",
      "description: consumer",
      "meta:",
      "  requires_skills: target-skill, dup-skill, missing-skill",
      "  requires_hooks: none",
      "  requires_repo_tools: tools/aim, does/not/exist",
      "---",
      "",
    ].join("\n"),
  );

  const registry = [{ id: "fixture", tool: "Fixture Tool", plugin: "fixture", root: "tool/plugin/skills" }];
  const output = path.join(root, "output");
  const result = await buildPublication({
    repoRoot: root,
    registry,
    generatedRoot: path.join(output, "generated"),
    downloadRoot: path.join(output, "downloads"),
    aiIndexPath: path.join(output, "ai-index.json"),
    searchIndexPath: path.join(output, "search-index.json"),
    attachEmbeddings: stubAttachEmbeddings,
  });

  const consumer = result.catalog.skills.find((skill) => skill.name === "consumer-skill");
  assert.deepEqual(consumer.meta.requiresSkills, [
    { name: "target-skill", path: "tool/plugin/skills/target/SKILL.md" },
    { name: "dup-skill", path: null },
    { name: "missing-skill", path: null },
  ]);
  assert.equal(consumer.meta.requiresHooks, null);
  assert.deepEqual(consumer.meta.requiresRepoTools, [
    { text: "tools/aim", href: "https://github.com/fdshg693/AI/tree/main/tools/aim" },
    { text: "does/not/exist", href: null },
  ]);

  const target = result.catalog.skills.find((skill) => skill.name === "target-skill");
  assert.deepEqual(target.meta.requiresSkills, []);
  assert.equal(target.meta.requiresHooks, null);
});

test("wraps a set requires_hooks value into a single link to the hook scenarios", async () => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "skill-site-test-"));
  const skillRoot = path.join(root, "tool", "plugin", "skills");
  await fs.promises.mkdir(path.join(skillRoot, "hooked"), { recursive: true });
  await fs.promises.writeFile(
    path.join(skillRoot, "hooked", "SKILL.md"),
    "---\nname: hooked-skill\ndescription: hooked\nmeta:\n  requires_hooks: 'PreToolUse: Bash差し戻し'\n---\n",
  );
  const registry = [{ id: "fixture", tool: "Fixture Tool", plugin: "fixture", root: "tool/plugin/skills" }];
  const output = path.join(root, "output");
  const result = await buildPublication({
    repoRoot: root,
    registry,
    generatedRoot: path.join(output, "generated"),
    downloadRoot: path.join(output, "downloads"),
    aiIndexPath: path.join(output, "ai-index.json"),
    searchIndexPath: path.join(output, "search-index.json"),
    attachEmbeddings: stubAttachEmbeddings,
  });
  const hooked = result.catalog.skills.find((skill) => skill.name === "hooked-skill");
  assert.deepEqual(hooked.meta.requiresHooks, {
    text: "PreToolUse: Bash差し戻し",
    href: "https://github.com/fdshg693/AI/tree/main/agent-tooling/agent_tooling/hooks/scenarios",
  });
});

test("validates generated catalog and archives", async () => {
  const fixture = await fixtureRepo();
  const output = path.join(fixture.root, "output");
  await buildPublication(publicationOptions(fixture, output));
  const result = await validatePublication({
    repoRoot: fixture.root,
    registry: fixture.registry,
    generatedRoot: path.join(output, "generated"),
    downloadRoot: path.join(output, "downloads"),
    aiIndexPath: path.join(output, "ai-index.json"),
    searchIndexPath: path.join(output, "search-index.json"),
  });
  assert.equal(result.count, 3);
});

test("embeds repo-tools.yaml's registry in catalog.json with GitHub folder links, no install instructions", async () => {
  const fixture = await fixtureRepo();
  const output = path.join(fixture.root, "output");
  const result = await buildPublication(publicationOptions(fixture, output));

  assert.ok(REPO_TOOLS_REGISTRY.length > 0);
  assert.deepEqual(result.catalog.repoTools, REPO_TOOLS_REGISTRY);
  for (const tool of result.catalog.repoTools) {
    assert.equal(tool.githubUrl, `https://github.com/fdshg693/AI/tree/main/${tool.path}`);
    assert.equal(Object.keys(tool).sort().join(","), "githubUrl,name,path");
  }
});

test("ZIP bundles each skill under a single {skill-name} folder with no deep nesting", async () => {
  const fixture = await fixtureRepo();
  const output = path.join(fixture.root, "output");
  const options = publicationOptions(fixture, output);
  await buildPublication(options);

  const { skills } = await discoverSkills({ repoRoot: fixture.root, registry: fixture.registry });
  // The fixture deliberately puts three skills named "same-name" in different
  // directories; each ZIP must still extract to a single top-level folder named
  // after the skill, with all bundled files nested exactly one level deep.
  for (const skill of skills) {
    const zipPath = path.join(options.downloadRoot, zipFileName(skill.path));
    const entries = zipEntries(zipPath);
    const folder = skillBundleFolder(skill.name, skill.path);
    assert.ok(entries.length > 0, `${skill.path}: ZIP has no entries`);
    for (const entry of entries) {
      // Top-level folder is exactly the skill name, never a "SKILL.md" folder
      // or a mirror of the deep repo-relative path.
      assert.ok(
        entry.startsWith(`${folder}/`),
        `${skill.path}: entry '${entry}' does not live under the ${folder}/ bundle folder`,
      );
      assert.ok(!entry.includes("SKILL.md/"), `${skill.path}: entry '${entry}' nests a SKILL.md folder`);
      const remainder = entry.slice(folder.length + 1);
      assert.ok(!remainder.startsWith("/"), `${skill.path}: entry '${entry}' nests too deeply`);
      assert.ok(!remainder.includes(".."), `${skill.path}: entry '${entry}' escapes the bundle folder`);
    }
    // SKILL.md itself must be present at the top level of the bundle folder.
    assert.ok(entries.includes(`${folder}/SKILL.md`), `${skill.path}: SKILL.md missing from bundle root`);
  }
});

test("skillBundleFolder rejects names that would nest or escape the bundle folder", () => {
  assert.equal(skillBundleFolder("agy-cli-docs", "x"), "agy-cli-docs");
  assert.throws(() => skillBundleFolder("", "x"), /not a valid bundle folder name/);
  assert.throws(() => skillBundleFolder("foo/bar", "x"), /not a valid bundle folder name/);
  assert.throws(() => skillBundleFolder("foo\\bar", "x"), /not a valid bundle folder name/);
});

test("fails embedding attach when OPENROUTER_API_KEY is missing and reuse is unavailable", async () => {
  await assert.rejects(
    () =>
      attachSkillEmbeddings(
        [
          {
            path: "tool/plugin/skills/a/SKILL.md",
            name: "a",
            description: "desc",
            tool: "Tool",
            plugin: "plugin",
            status: { key: "stable" },
          },
        ],
        { apiKey: "", previousIndex: null },
      ),
    /OPENROUTER_API_KEY が解決できません/,
  );
});

test("reuses previous embeddings when embeddingHash matches", async () => {
  const skill = {
    path: "tool/plugin/skills/a/SKILL.md",
    name: "a",
    description: "desc",
    tool: "Tool",
    plugin: "plugin",
    status: { key: "stable" },
  };
  const text = buildEmbeddingText(skill);
  const embeddingHash = hashEmbeddingText(text);
  const previousEmbedding = Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => i * 0.001);
  let fetchCalled = false;
  const result = await attachSkillEmbeddings([skill], {
    apiKey: "",
    previousIndex: {
      schemaVersion: AI_INDEX_SCHEMA_VERSION,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      skills: [{ ...skill, embedding: previousEmbedding, embeddingHash }],
    },
    fetchEmbeddingsFn: async () => {
      fetchCalled = true;
      return [];
    },
  });
  assert.equal(fetchCalled, false);
  assert.equal(result[0].embeddingHash, embeddingHash);
  assert.equal(result[0].embedding, previousEmbedding);
});

test("zipFileName escapes a leading dot so the file isn't dropped by Azure SWA's dotfile filtering", () => {
  const name = zipFileName(".claude/skills/foo/SKILL.md");
  assert.ok(!name.startsWith("."));
  assert.match(name, /^dot-claude--skills--foo--SKILL\.md--[0-9a-f]{12}\.zip$/);
  assert.equal(zipFileName("claude-plugins/meta/skills/foo/SKILL.md").startsWith("."), false);
});
