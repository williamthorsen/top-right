import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { DEFAULT_SCORE_LABEL_MAPPING, DEFAULT_WORK_TYPE_MAPPING, type WorkTypeMapping } from '@top-right/model';
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

      await userEvent.setup().click(within(getSection('Work types')).getByRole('button', { name: 'Restore defaults' }));

      expect(onSaveWorkTypeMapping).toHaveBeenCalledWith(undefined);
      expect(getField('Work types', 'Bug')).toHaveValue(DEFAULT_WORK_TYPE_MAPPING.bug.join(', '));
    });

    it('shows the refusal that the save returns', async () => {
      renderSettings({ onSaveWorkTypeMapping: () => Promise.resolve('The host did not respond.') });

      await userEvent.setup().click(within(getSection('Work types')).getByRole('button', { name: 'Save' }));

      expect(within(getSection('Work types')).getByRole('alert')).toHaveTextContent('The host did not respond.');
    });
  });

  describe('score labels', () => {
    it('shows the default label of each level while the user keeps the default', () => {
      renderSettings();

      expect(getLevelField('Urgency', 'High')).toHaveValue('urgency:high');
      expect(getLevelField('Value', 'Must-have')).toHaveValue('value:must-have');
    });

    it('saves the comma-separated labels of each level, trimmed', async () => {
      const onSaveScoreLabelMapping = vi.fn<SettingsProps['onSaveScoreLabelMapping']>(() => Promise.resolve(undefined));
      renderSettings({ onSaveScoreLabelMapping });

      const user = userEvent.setup();
      await user.type(getLevelField('Urgency', 'High'), ', priority:high ,');
      await user.click(within(getSection('Score labels')).getByRole('button', { name: 'Save' }));

      expect(onSaveScoreLabelMapping).toHaveBeenCalledWith({
        ...DEFAULT_SCORE_LABEL_MAPPING,
        urgency: { ...DEFAULT_SCORE_LABEL_MAPPING.urgency, high: ['urgency:high', 'priority:high'] },
      });
      expect(within(getSection('Score labels')).getByRole('status')).toHaveTextContent('Saved.');
    });

    it('refuses a label under two levels without saving', async () => {
      const onSaveScoreLabelMapping = vi.fn<SettingsProps['onSaveScoreLabelMapping']>(() => Promise.resolve(undefined));
      renderSettings({ onSaveScoreLabelMapping });

      const user = userEvent.setup();
      await user.type(getLevelField('Value', 'Questionable'), ', Urgency:Low');
      await user.click(within(getSection('Score labels')).getByRole('button', { name: 'Save' }));

      expect(onSaveScoreLabelMapping).not.toHaveBeenCalled();
      expect(within(getSection('Score labels')).getByRole('alert')).toHaveTextContent(
        '"urgency:low" is under urgency low and value questionable. Keep it under one level.',
      );
    });

    it('restores the default mapping', async () => {
      const onSaveScoreLabelMapping = vi.fn<SettingsProps['onSaveScoreLabelMapping']>(() => Promise.resolve(undefined));
      renderSettings({
        scoreLabelMapping: {
          ...DEFAULT_SCORE_LABEL_MAPPING,
          urgency: { ...DEFAULT_SCORE_LABEL_MAPPING.urgency, high: ['priority:high'] },
        },
        onSaveScoreLabelMapping,
      });
      expect(getLevelField('Urgency', 'High')).toHaveValue('priority:high');

      await userEvent
        .setup()
        .click(within(getSection('Score labels')).getByRole('button', { name: 'Restore defaults' }));

      expect(onSaveScoreLabelMapping).toHaveBeenCalledWith(undefined);
      expect(getLevelField('Urgency', 'High')).toHaveValue('urgency:high');
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

function getLevelField(dimension: string, level: string): HTMLElement {
  const group = within(getSection('Score labels')).getByRole('group', { name: dimension });
  return within(group).getByRole('textbox', { name: level });
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
      onSaveScoreLabelMapping={() => Promise.resolve(undefined)}
      onSaveWorkTypeMapping={() => Promise.resolve(undefined)}
      repos={REPOS}
      scoreLabelMapping={undefined}
      workTypeMapping={undefined}
      {...overrides}
    />,
  );
}
// endregion | Helpers
