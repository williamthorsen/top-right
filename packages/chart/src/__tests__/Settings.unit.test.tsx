import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { DEFAULT_WORK_TYPE_MAPPING, type WorkTypeMapping } from '@top-right/model';
import { describe, expect, it, vi } from 'vitest';

import { Settings, type SettingsProps } from '../Settings.tsx';

const REPOS = ['w/codeassembly', 'w/configs.macos', 'w/top-right'];

describe(Settings, () => {
  it('links back to the chart', () => {
    renderSettings({ chartHref: '/?item=w%2Ftop-right%2312' });

    expect(screen.getByRole('link', { name: 'Chart' })).toHaveAttribute('href', '/?item=w%2Ftop-right%2312');
  });

  describe('work types', () => {
    it('shows the default labels while the user keeps the default', () => {
      renderSettings();

      expect(getField('Work types', 'Bug')).toHaveValue(DEFAULT_WORK_TYPE_MAPPING.bug.join(', '));
    });

    it('saves the comma-separated labels of each type, trimmed', async () => {
      const onSaveWorkTypeMapping = vi.fn<SettingsProps['onSaveWorkTypeMapping']>(() => Promise.resolve(undefined));
      renderSettings({ workTypeMapping: MAPPING, onSaveWorkTypeMapping });

      const user = userEvent.setup();
      await user.clear(getField('Work types', 'Ops'));
      await user.type(getField('Work types', 'Ops'), ' infra , admin,');
      await user.click(within(getSection('Work types')).getByRole('button', { name: 'Save' }));

      expect(onSaveWorkTypeMapping).toHaveBeenCalledWith({ ...MAPPING, ops: ['infra', 'admin'] });
      expect(screen.getByRole('status')).toHaveTextContent('Saved.');
    });

    it('refuses a label in two types without saving', async () => {
      const onSaveWorkTypeMapping = vi.fn<SettingsProps['onSaveWorkTypeMapping']>(() => Promise.resolve(undefined));
      renderSettings({ workTypeMapping: MAPPING, onSaveWorkTypeMapping });

      const user = userEvent.setup();
      await user.type(getField('Work types', 'Task'), ', Defect');
      await user.click(within(getSection('Work types')).getByRole('button', { name: 'Save' }));

      expect(onSaveWorkTypeMapping).not.toHaveBeenCalled();
      expect(within(getSection('Work types')).getByRole('alert')).toHaveTextContent(
        '"defect" is in Bug and Task. Keep it in one type.',
      );
    });

    it('restores the default mapping', async () => {
      const onSaveWorkTypeMapping = vi.fn<SettingsProps['onSaveWorkTypeMapping']>(() => Promise.resolve(undefined));
      renderSettings({ workTypeMapping: MAPPING, onSaveWorkTypeMapping });

      await userEvent.setup().click(screen.getByRole('button', { name: 'Restore defaults' }));

      expect(onSaveWorkTypeMapping).toHaveBeenCalledWith(undefined);
      expect(getField('Work types', 'Bug')).toHaveValue(DEFAULT_WORK_TYPE_MAPPING.bug.join(', '));
    });

    it('shows the refusal that the save returns', async () => {
      renderSettings({ onSaveWorkTypeMapping: () => Promise.resolve('The host did not respond.') });

      await userEvent.setup().click(within(getSection('Work types')).getByRole('button', { name: 'Save' }));

      expect(within(getSection('Work types')).getByRole('alert')).toHaveTextContent('The host did not respond.');
    });
  });

  describe('repo abbreviations', () => {
    it('shows each stored abbreviation, with the first letter as the placeholder', () => {
      renderSettings({ abbreviations: { 'w/codeassembly': 'ca' } });

      expect(getField('Repo abbreviations', 'w/codeassembly')).toHaveValue('ca');
      expect(getField('Repo abbreviations', 'w/configs.macos')).toHaveValue('');
      expect(getField('Repo abbreviations', 'w/configs.macos')).toHaveAttribute('placeholder', 'c');
    });

    it('reports nothing on load once the stored abbreviations resolve every clash', () => {
      renderSettings({ abbreviations: { 'w/codeassembly': 'ca' } });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('reports on load the clash of two first letters', () => {
      renderSettings();

      expect(screen.getByRole('alert')).toHaveTextContent('"c" is used by w/codeassembly and w/configs.macos.');
    });

    it('saves every repository’s abbreviation, empty for its default', async () => {
      const onSaveAbbreviations = vi.fn<SettingsProps['onSaveAbbreviations']>(() => Promise.resolve(undefined));
      renderSettings({ onSaveAbbreviations });

      const user = userEvent.setup();
      await user.type(getField('Repo abbreviations', 'w/codeassembly'), ' ca ');
      await user.click(within(getSection('Repo abbreviations')).getByRole('button', { name: 'Save' }));

      expect(onSaveAbbreviations).toHaveBeenCalledWith({
        'w/codeassembly': 'ca',
        'w/configs.macos': '',
        'w/top-right': '',
      });
      expect(getField('Repo abbreviations', 'w/codeassembly')).toHaveValue('ca');
    });

    it.each([
      { case: 'leaves two repositories sharing an abbreviation', value: 'C', message: '"c" is used by' },
      { case: 'contains a dot', value: 'c.a', message: 'not a valid abbreviation for w/codeassembly' },
    ])('refuses a value that $case without saving', async ({ value, message }) => {
      const onSaveAbbreviations = vi.fn<SettingsProps['onSaveAbbreviations']>(() => Promise.resolve(undefined));
      renderSettings({ abbreviations: { 'w/configs.macos': 'cm' }, onSaveAbbreviations });

      const user = userEvent.setup();
      await user.type(getField('Repo abbreviations', 'w/codeassembly'), value);
      await user.type(getField('Repo abbreviations', 'w/configs.macos'), '{Backspace}{Backspace}');
      await user.click(within(getSection('Repo abbreviations')).getByRole('button', { name: 'Save' }));

      expect(onSaveAbbreviations).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent(message);
    });
  });
});

// region | Helpers
const MAPPING: WorkTypeMapping = { bug: ['defect'], feature: ['story'], ops: ['ops'], task: ['chore'] };

function getField(section: string, label: string): HTMLElement {
  return within(getSection(section)).getByRole('textbox', { name: label });
}

function getSection(name: string): HTMLElement {
  return screen.getByRole('form', { name });
}

function renderSettings(overrides: Partial<SettingsProps> = {}): void {
  render(
    <Settings
      abbreviations={{}}
      chartHref="/"
      onSaveAbbreviations={() => Promise.resolve(undefined)}
      onSaveWorkTypeMapping={() => Promise.resolve(undefined)}
      repos={REPOS}
      workTypeMapping={undefined}
      {...overrides}
    />,
  );
}
// endregion | Helpers
