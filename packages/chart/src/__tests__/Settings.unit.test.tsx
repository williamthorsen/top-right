import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import {
  type CollectionSettings,
  DEFAULT_SCORE_LABEL_MAPPING,
  DEFAULT_WORK_TYPE_MAPPING,
  EMPTY_COLLECTION_SETTINGS,
  type WorkTypeMapping,
} from '@top-right/model';
import { describe, expect, it, vi } from 'vitest';

import { Settings, type SettingsProps } from '../Settings.tsx';
import { SettingsSection } from '../SettingsSection.tsx';

const REPOS = ['w/codeassembly', 'w/configs.macos', 'w/top-right'];

describe(Settings, () => {
  it("shows the host's sections after its own, each as a region named by its heading", () => {
    renderSettings({
      children: (
        <SettingsSection heading="Repositories" hint="Edit the config file.">
          <p>w/top-right</p>
        </SettingsSection>
      ),
    });

    const section = screen.getByRole('region', { name: 'Repositories' });
    expect(section).toHaveTextContent('RepositoriesEdit the config file.w/top-right');
    expect(getSection('Repo abbreviations').compareDocumentPosition(section)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("does not link to the chart, which the host's own navigation reaches", () => {
    renderSettings();

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
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
      expect(getLevelField('Value', 'Must have')).toHaveValue('value:must-have');
      expect(getLevelField('Effort', '13 points')).toHaveValue('effort:13');
      expect(getLevelField('Effort', '1 point')).toHaveValue('effort:1');
    });

    it('saves the labels of each effort', async () => {
      const onSaveScoreLabelMapping = vi.fn<SettingsProps['onSaveScoreLabelMapping']>(() => Promise.resolve(undefined));
      renderSettings({ onSaveScoreLabelMapping });

      const user = userEvent.setup();
      await user.clear(getLevelField('Effort', '3 points'));
      await user.type(getLevelField('Effort', '3 points'), 'size:m, effort:3');
      await user.click(within(getSection('Score labels')).getByRole('button', { name: 'Save' }));

      expect(onSaveScoreLabelMapping).toHaveBeenCalledWith({
        ...DEFAULT_SCORE_LABEL_MAPPING,
        effort: { ...DEFAULT_SCORE_LABEL_MAPPING.effort, 3: ['size:m', 'effort:3'] },
      });
    });

    it('refuses a label under an effort and a level without saving', async () => {
      const onSaveScoreLabelMapping = vi.fn<SettingsProps['onSaveScoreLabelMapping']>(() => Promise.resolve(undefined));
      renderSettings({ onSaveScoreLabelMapping });

      const user = userEvent.setup();
      await user.type(getLevelField('Effort', '8 points'), ', Value:Must-Have');
      await user.click(within(getSection('Score labels')).getByRole('button', { name: 'Save' }));

      expect(onSaveScoreLabelMapping).not.toHaveBeenCalled();
      expect(within(getSection('Score labels')).getByRole('alert')).toHaveTextContent(
        '"value:must-have" is under value must-have and effort 8. Keep it under one level.',
      );
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
      expect(getField('Repo abbreviations', 'w/configs.macos')).toHaveAttribute('placeholder', 'C');
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

  describe('collections', () => {
    const SAVED: CollectionSettings = {
      collections: [
        { id: 'c1', name: 'Core', repos: ['w/top-right'] },
        { id: 'c2', name: 'Tools', repos: ['w/codeassembly', 'w/configs.macos'] },
      ],
      defaultCollectionId: 'c2',
    };

    it('shows the empty state without collections', () => {
      renderSettings();

      expect(getSection('Collections')).toHaveTextContent('No collections');
      expect(getDefaultSelect()).toHaveDisplayValue('None (all repos)');
    });

    it('shows each collection with its repositories checked, sorted by name, and the default', () => {
      renderSettings({ collections: SAVED });

      const tools = getCollection('Tools');
      expect(within(tools).getByRole('textbox', { name: 'Name' })).toHaveValue('Tools');
      expect(
        within(tools)
          .getAllByRole('checkbox')
          .map((box) => box.closest('label')?.textContent),
      ).toEqual(['w/codeassembly', 'w/configs.macos', 'w/top-right']);
      expect(within(tools).getByRole('checkbox', { name: 'w/codeassembly' })).toBeChecked();
      expect(within(tools).getByRole('checkbox', { name: 'w/top-right' })).not.toBeChecked();
      expect(getDefaultSelect()).toHaveDisplayValue('Tools');
    });

    it('leaves unchecked a saved repository that the config no longer lists, and drops it on save', async () => {
      const onSaveCollections = vi.fn<SettingsProps['onSaveCollections']>(() => Promise.resolve(undefined));
      renderSettings({
        collections: {
          collections: [{ id: 'c1', name: 'Core', repos: ['w/gone', 'w/top-right'] }],
          defaultCollectionId: undefined,
        },
        onSaveCollections,
      });

      await userEvent.setup().click(getSaveButton());

      expect(onSaveCollections).toHaveBeenCalledWith({
        collections: [{ id: 'c1', name: 'Core', repos: ['w/top-right'] }],
        defaultCollectionId: undefined,
      });
    });

    it('creates a collection and sets it as the default', async () => {
      const onSaveCollections = vi.fn<SettingsProps['onSaveCollections']>(() => Promise.resolve(undefined));
      renderSettings({ onSaveCollections });

      const user = userEvent.setup();
      await user.click(within(getSection('Collections')).getByRole('button', { name: 'Add collection' }));
      const draft = getCollection('New collection');
      await user.type(within(draft).getByRole('textbox', { name: 'Name' }), ' Work ');
      await user.click(within(getCollection('Work')).getByRole('checkbox', { name: 'w/top-right' }));
      await user.selectOptions(getDefaultSelect(), 'Work');
      await user.click(getSaveButton());

      expect(onSaveCollections).toHaveBeenCalledWith({
        collections: [{ id: expect.any(String), name: 'Work', repos: ['w/top-right'] }],
        defaultCollectionId: expect.any(String),
      });
      const [saved] = onSaveCollections.mock.calls[0] ?? [];
      expect(saved?.defaultCollectionId).toBe(saved?.collections[0]?.id);
      expect(screen.getByRole('status')).toHaveTextContent('Saved.');
    });

    it('renames a collection and edits its repositories, keeping its id', async () => {
      const onSaveCollections = vi.fn<SettingsProps['onSaveCollections']>(() => Promise.resolve(undefined));
      renderSettings({ collections: SAVED, onSaveCollections });

      const user = userEvent.setup();
      const name = within(getCollection('Core')).getByRole('textbox', { name: 'Name' });
      await user.clear(name);
      await user.type(name, 'Product');
      await user.click(within(getCollection('Product')).getByRole('checkbox', { name: 'w/codeassembly' }));
      await user.click(within(getCollection('Product')).getByRole('checkbox', { name: 'w/top-right' }));
      await user.click(getSaveButton());

      expect(onSaveCollections).toHaveBeenCalledWith({
        collections: [{ id: 'c1', name: 'Product', repos: ['w/codeassembly'] }, SAVED.collections[1]],
        defaultCollectionId: 'c2',
      });
    });

    it('deletes a collection, clearing the default when it was the default', async () => {
      const onSaveCollections = vi.fn<SettingsProps['onSaveCollections']>(() => Promise.resolve(undefined));
      renderSettings({ collections: SAVED, onSaveCollections });

      const user = userEvent.setup();
      await user.click(within(getCollection('Tools')).getByRole('button', { name: 'Delete' }));

      expect(getDefaultSelect()).toHaveDisplayValue('None (all repos)');
      await user.click(getSaveButton());
      expect(onSaveCollections).toHaveBeenCalledWith({
        collections: [SAVED.collections[0]],
        defaultCollectionId: undefined,
      });
    });

    it('clears the default', async () => {
      const onSaveCollections = vi.fn<SettingsProps['onSaveCollections']>(() => Promise.resolve(undefined));
      renderSettings({ collections: SAVED, onSaveCollections });

      const user = userEvent.setup();
      await user.selectOptions(getDefaultSelect(), 'None (all repos)');
      await user.click(getSaveButton());

      expect(onSaveCollections).toHaveBeenCalledWith({ ...SAVED, defaultCollectionId: undefined });
    });

    it.each([
      { case: 'an empty name', name: '', message: 'Give every collection a name.' },
      { case: 'a duplicate name', name: 'core', message: 'More than one collection is named "core".' },
    ])('refuses $case without saving', async ({ name, message }) => {
      const onSaveCollections = vi.fn<SettingsProps['onSaveCollections']>(() => Promise.resolve(undefined));
      renderSettings({ collections: SAVED, onSaveCollections });

      const user = userEvent.setup();
      const field = within(getCollection('Tools')).getByRole('textbox', { name: 'Name' });
      await user.clear(field);
      if (name !== '') await user.type(field, name);
      await user.click(getSaveButton());

      expect(onSaveCollections).not.toHaveBeenCalled();
      expect(within(getSection('Collections')).getByRole('alert')).toHaveTextContent(message);
    });

    it('refuses a collection without repositories without saving', async () => {
      const onSaveCollections = vi.fn<SettingsProps['onSaveCollections']>(() => Promise.resolve(undefined));
      renderSettings({ collections: SAVED, onSaveCollections });

      const user = userEvent.setup();
      await user.click(within(getCollection('Core')).getByRole('checkbox', { name: 'w/top-right' }));
      await user.click(getSaveButton());

      expect(onSaveCollections).not.toHaveBeenCalled();
      expect(within(getSection('Collections')).getByRole('alert')).toHaveTextContent(
        '"Core" does not include any repository.',
      );
    });

    it('shows the refusal that the save returns', async () => {
      renderSettings({ onSaveCollections: () => Promise.resolve('Not saved: the host did not respond. Try again.') });

      await userEvent.setup().click(getSaveButton());

      expect(within(getSection('Collections')).getByRole('alert')).toHaveTextContent(
        'Not saved: the host did not respond. Try again.',
      );
    });
  });
});

// region | Helpers
const MAPPING: WorkTypeMapping = { bug: ['defect'], feature: ['story'], ops: ['ops'], task: ['chore'] };

function getCollection(name: string): HTMLElement {
  return within(getSection('Collections')).getByRole('group', { name });
}

function getDefaultSelect(): HTMLElement {
  return within(getSection('Collections')).getByRole('combobox', { name: 'Default collection' });
}

function getField(section: string, label: string): HTMLElement {
  return within(getSection(section)).getByRole('textbox', { name: label });
}

function getLevelField(dimension: string, level: string): HTMLElement {
  const group = within(getSection('Score labels')).getByRole('group', { name: dimension });
  return within(group).getByRole('textbox', { name: level });
}

function getSaveButton(): HTMLElement {
  return within(getSection('Collections')).getByRole('button', { name: 'Save' });
}

function getSection(name: string): HTMLElement {
  return screen.getByRole('form', { name });
}

function renderSettings(overrides: Partial<SettingsProps> = {}): void {
  render(
    <Settings
      abbreviations={{}}
      collections={EMPTY_COLLECTION_SETTINGS}
      onSaveAbbreviations={() => Promise.resolve(undefined)}
      onSaveCollections={() => Promise.resolve(undefined)}
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
