import { describe, expect, it } from 'vitest';

import { formatAbbreviationNotice, parseConfig, readConfig } from '../config.ts';
import { StartupError } from '../startup-error.ts';

const PATH = '/repo/apps/local/config.local.json';

describe(parseConfig, () => {
  it('returns the configured repositories', () => {
    const config = parseConfig('{"repos":[{"repo":"w/codeassembly"},{"repo":"w/configs.macos"}]}', PATH);

    expect(config).toStrictEqual({ repos: ['w/codeassembly', 'w/configs.macos'], reposWithAbbreviation: [] });
  });

  it('reports the repositories whose entry still sets an abbreviation', () => {
    const config = parseConfig('{"repos":[{"repo":"w/top-right","abbreviation":"tr"},{"repo":"w/other"}]}', PATH);

    expect(config.reposWithAbbreviation).toStrictEqual(['w/top-right']);
  });

  it.each([
    { case: 'is not JSON', text: '{', message: 'not valid JSON' },
    { case: 'names a repository without an owner', text: '{"repos":[{"repo":"top-right"}]}', message: 'owner/name' },
    { case: 'lists no repositories', text: '{"repos":[]}', message: 'invalid' },
  ])('if the file $case, throws a StartupError that names the file', ({ text, message }) => {
    const parse = () => parseConfig(text, PATH);

    expect(parse).toThrow(StartupError);
    expect(parse).toThrow(message);
    expect(parse).toThrow(PATH);
  });
});

describe(readConfig, () => {
  it('if the file is missing, throws a StartupError that names the example file', async () => {
    await expect(readConfig('/nonexistent/config.local.json')).rejects.toThrow(/config\.example\.json/);
  });
});

describe(formatAbbreviationNotice, () => {
  it('names each repository whose entry sets an abbreviation, and Settings', () => {
    const notice = formatAbbreviationNotice({ repos: ['w/a', 'w/b'], reposWithAbbreviation: ['w/a', 'w/b'] });

    expect(notice).toContain('w/a, w/b');
    expect(notice).toContain('Settings');
  });

  it('returns undefined when no entry sets an abbreviation', () => {
    expect(formatAbbreviationNotice({ repos: ['w/a'], reposWithAbbreviation: [] })).toBeUndefined();
  });
});
