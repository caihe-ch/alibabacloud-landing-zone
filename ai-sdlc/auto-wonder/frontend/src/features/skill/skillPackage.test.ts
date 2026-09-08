import { describe, expect, it } from 'vitest';
import {
  buildPackageTree,
  buildSkillZip,
  formatBytes,
  parseSkillFrontmatter,
  readSkillDirectory,
} from './skillPackage';
import type { SkillPackageEntryKind, SkillPackageFile } from './api';

function file(path: string, content: string) {
  const f = new File([content], path.split('/').pop() || path, { type: 'text/plain' });
  Object.defineProperty(f, 'webkitRelativePath', { value: path });
  return f;
}

function entry(path: string, kind: SkillPackageEntryKind = 'TEXT', size = 10): SkillPackageFile {
  const segments = path.split('/');
  return {
    path,
    name: segments[segments.length - 1],
    dir: kind === 'DIR',
    size: kind === 'DIR' ? 0 : size,
    kind,
  };
}

describe('skillPackage', () => {
  it('parses name and block description from SKILL.md frontmatter', () => {
    const meta = parseSkillFrontmatter(`---
name: custom-skill
description: |
  First line.
  Second line.
---
# Custom Skill
`);

    expect(meta).toEqual({
      name: 'custom-skill',
      description: 'First line.\nSecond line.',
    });
  });

  it('reads selected directory metadata from root SKILL.md', async () => {
    const result = await readSkillDirectory([
      file('custom-skill/SKILL.md', '---\nname: custom-skill\ndescription: Demo skill\n---\n'),
      file('custom-skill/scripts/run.sh', 'echo run'),
    ]);

    expect(result.metadata.name).toBe('custom-skill');
    expect(result.metadata.description).toBe('Demo skill');
    expect(result.rootName).toBe('custom-skill');
  });

  it('builds a zip file for upload', async () => {
    const result = await readSkillDirectory([
      file('custom-skill/SKILL.md', '---\nname: custom-skill\ndescription: Demo skill\n---\n'),
    ]);

    const zip = await buildSkillZip(result);

    expect(zip.name).toBe('custom-skill.zip');
    expect(zip.size).toBeGreaterThan(0);
    expect(zip.type).toBe('application/zip');
  });
});

describe('formatBytes', () => {
  it('formats byte and scaled units with one decimal', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1048576)).toBe('1.0 MB');
    expect(formatBytes(1073741824)).toBe('1.0 GB');
  });

  it('falls back to 0 B for empty, negative and non-finite sizes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(-5)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('0 B');
  });
});

describe('buildPackageTree', () => {
  it('returns an empty tree when the package has no entries', () => {
    expect(buildPackageTree([])).toEqual([]);
  });

  it('nests flat slash paths and marks files as leaves', () => {
    const tree = buildPackageTree([entry('SKILL.md', 'TEXT', 2048)]);

    expect(tree).toHaveLength(1);
    expect(tree[0]).toEqual({
      title: 'SKILL.md  2.0 KB',
      key: 'SKILL.md',
      isLeaf: true,
    });
  });

  it('creates missing parent directories from a deep file path', () => {
    const tree = buildPackageTree([entry('a/b/c.md', 'TEXT', 10)]);

    expect(tree).toHaveLength(1);
    expect(tree[0].key).toBe('a');
    expect(tree[0].title).toBe('a');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children![0].key).toBe('a/b');
    expect(tree[0].children![0].children).toHaveLength(1);
    expect(tree[0].children![0].children![0].key).toBe('a/b/c.md');
    expect(tree[0].children![0].children![0].isLeaf).toBe(true);
  });

  it('does not duplicate an explicit DIR record already created implicitly', () => {
    const tree = buildPackageTree([
      entry('references/guide.md', 'TEXT', 2048),
      entry('references', 'DIR'),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].key).toBe('references');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children![0].key).toBe('references/guide.md');
  });

  it('keeps an explicit DIR record that has no files inside it', () => {
    const tree = buildPackageTree([entry('empty-dir', 'DIR')]);

    expect(tree).toEqual([{ title: 'empty-dir', key: 'empty-dir', children: [] }]);
  });

  it('sorts directories before files at every level by last path segment', () => {
    const tree = buildPackageTree([
      entry('SKILL.md', 'TEXT', 2048),
      entry('references/guide.md', 'TEXT', 2048),
      entry('assets/logo.png', 'IMAGE', 2048),
      entry('bin/tool', 'BINARY', 1024),
      entry('scripts/run.sh', 'TEXT', 1024),
    ]);

    expect(tree.map((node) => node.key)).toEqual(['assets', 'bin', 'references', 'scripts', 'SKILL.md']);
    expect(tree[2].children!.map((node) => node.key)).toEqual(['references/guide.md']);
  });

  it('sorts nested directories before nested files', () => {
    const tree = buildPackageTree([
      entry('pkg/zoo.md', 'TEXT', 10),
      entry('pkg/nested/b.md', 'TEXT', 10),
      entry('pkg/alpha.md', 'TEXT', 10),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].children!.map((node) => node.key)).toEqual([
      'pkg/nested',
      'pkg/alpha.md',
      'pkg/zoo.md',
    ]);
  });

  it('drops a file entry whose path collides with a directory key', () => {
    // 退化包里 a 与 a/b 并存：antd Tree 不允许重复 key，冲突的叶子必须让位给目录
    const tree = buildPackageTree([entry('a', 'TEXT', 10), entry('a/b.md', 'TEXT', 10)]);

    expect(tree).toHaveLength(1);
    expect(tree[0].key).toBe('a');
    expect(tree[0].isLeaf).toBeUndefined();
    expect(tree[0].children!.map((node) => node.key)).toEqual(['a/b.md']);
  });

  it('registers every ancestor of a deep explicit DIR record exactly once', () => {
    const tree = buildPackageTree([entry('a/b/c/d.md', 'TEXT', 10), entry('a/b', 'DIR')]);

    expect(tree.map((node) => node.key)).toEqual(['a']);
    expect(tree[0].children!.map((node) => node.key)).toEqual(['a/b']);
    expect(tree[0].children![0].children!.map((node) => node.key)).toEqual(['a/b/c']);
    expect(tree[0].children![0].children![0].children!.map((node) => node.key)).toEqual(['a/b/c/d.md']);
  });
});
