import { SettingsSection } from '@top-right/chart';
import type { ReactElement } from 'react';

export interface RepositoriesSectionProps {
  /** The configured repositories, as `owner/name`. */
  repos: readonly string[];
  /** The absolute path of the config file from which the host read `repos`. */
  configPath: string;
}

/** The Settings section that lists the repositories that the host reads and says where they are configured. */
export function RepositoriesSection({ repos, configPath }: RepositoriesSectionProps): ReactElement {
  return (
    <SettingsSection
      heading="Repositories"
      hint={
        <>
          Edit <code>repos</code> in <code>{configPath}</code>, then restart the host.
        </>
      }
    >
      <ul className="host-repo-list">
        {repos.map((repo) => (
          <li key={repo}>{repo}</li>
        ))}
      </ul>
    </SettingsSection>
  );
}
