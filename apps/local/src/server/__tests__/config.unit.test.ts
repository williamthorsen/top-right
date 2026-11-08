import { describe, expect, it } from 'vitest';

import { parseConfig, readConfig, resolveAbbreviations } from '../config.ts';
import { StartupError } from '../startup-error.ts';

const PATH = '/repo/apps/local/config.local.json';

describe(parseConfig, () => {
  it('returns the configured repositories', () => {
    const config = parseConfig('{"repos":[{"repo":"williamthorsen/top-right","abbreviation":"tr"}]}', PATH);

    expect(config.repos).toStrictEqual([{ repo: 'williamthorsen/top-right', abbreviation: 'tr' }]);
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

describe(resolveAbbreviations, () => {
  it('keys abbreviations by owner/name, defaulting to the first letter', () => {
    const abbreviations = resolveAbbreviations({
      repos: [{ repo: 'williamthorsen/top-right' }, { repo: 'williamthorsen/codeassembly', abbreviation: 'ca' }],
    });

    expect(abbreviations).toStrictEqual({ 'williamthorsen/top-right': 't', 'williamthorsen/codeassembly': 'ca' });
  });

  it.each([
    { case: 'two defaults match', repos: [{ repo: 'w/codeassembly' }, { repo: 'w/configs.macos' }] },
    {
      case: 'abbreviations match case-insensitively',
      repos: [{ repo: 'w/a', abbreviation: 'C' }, { repo: 'w/configs' }],
    },
  ])('if $case, throws a StartupError that names both repositories', ({ repos }) => {
    const resolve = () => resolveAbbreviations({ repos });

    expect(resolve).toThrow(StartupError);
    for (const { repo } of repos) expect(resolve).toThrow(repo);
  });
});
