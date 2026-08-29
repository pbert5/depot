import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button, SectionHeader } from '@/components/ui';
import { downloadFile, isoTimestamp } from '@/utils/file';

type BackupFormat = 'json' | 'yaml';

const BACKUPS: Array<{ format: BackupFormat; label: string; path: string; type: string }> = [
  { format: 'json', label: 'Export all data as JSON', path: '/api/export', type: 'application/json;charset=utf-8' },
  { format: 'yaml', label: 'Export all data as YAML', path: '/api/export.yaml', type: 'application/yaml;charset=utf-8' }
];

const BackupPanel = () => {
  const [busy, setBusy] = useState<BackupFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportBackup = async (backup: (typeof BACKUPS)[number]) => {
    setBusy(backup.format);
    setError(null);
    try {
      const response = await fetch(backup.path);
      if (!response.ok) throw new Error(`Export failed (${response.status})`);
      const content = await response.text();
      downloadFile(`depot-backup-${isoTimestamp()}.${backup.format}`, content, backup.type);
    } catch (cause) {
      console.error('Failed to export Depot backup', cause);
      setError('The backup could not be downloaded. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="flex flex-col gap-2">
      <SectionHeader title="Backups" />
      <div className="surface-card flex flex-col gap-3 p-3">
        <p className="text-sm text-body">
          Download all rosters and collections as a portable backup.
        </p>
        <div className="flex flex-wrap gap-2">
          {BACKUPS.map((backup) => (
            <Button
              key={backup.format}
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy !== null}
              onClick={() => void exportBackup(backup)}
              data-testid={`export-backup-${backup.format}`}
            >
              <Download size={16} />
              {busy === backup.format ? 'Exporting…' : backup.label}
            </Button>
          ))}
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </section>
  );
};

export default BackupPanel;
