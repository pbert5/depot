import { useState } from 'react';
import { Download, Upload, TriangleAlert } from 'lucide-react';
import { Alert, Button, Drawer, SectionHeader } from '@/components/ui';
import ImportButton from '@/components/shared/import-button';
import { downloadFile, isoTimestamp } from '@/utils/file';
import {
  getBackupFormat,
  getConflictIds,
  parseBackup,
  type BackupFormat,
  type BackupPreview,
  type ConflictPolicy
} from '@/utils/backup-import';

const BACKUPS: Array<{ format: BackupFormat; label: string; path: string; type: string }> = [
  { format: 'json', label: 'Export all data as JSON', path: '/api/export', type: 'application/json;charset=utf-8' },
  { format: 'yaml', label: 'Export all data as YAML', path: '/api/export.yaml', type: 'application/yaml;charset=utf-8' }
];

const errorMessage = (cause: unknown) => (cause instanceof Error ? cause.message : 'The backup could not be imported.');

const BackupPanel = () => {
  const [busy, setBusy] = useState<BackupFormat | 'import' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [policy, setPolicy] = useState<ConflictPolicy>('create');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const exportBackup = async (backup: (typeof BACKUPS)[number]) => {
    setBusy(backup.format); setError(null);
    try {
      const response = await fetch(backup.path);
      if (!response.ok) throw new Error('Export failed');
      downloadFile(`depot-backup-${isoTimestamp()}.${backup.format}`, await response.text(), backup.type);
    } catch (cause) {
      console.error('Failed to export Depot backup', cause);
      setError('The backup could not be downloaded. Please try again.');
    } finally { setBusy(null); }
  };

  const inspectFile = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setBusy('import'); setError(null); setPreview(null);
    try {
      const format = getBackupFormat(file);
      if (!format) throw new Error('Choose a .json, .yaml, or .yml Depot backup.');
      const bundle = parseBackup(await file.text(), format);
      const [rostersResponse, collectionsResponse] = await Promise.all([fetch('/api/rosters'), fetch('/api/collections')]);
      if (!rostersResponse.ok || !collectionsResponse.ok) throw new Error('Could not check existing data. Please try again.');
      const existing = [...(await rostersResponse.json()), ...(await collectionsResponse.json())] as Array<{ id: string }>;
      setPreview({ bundle, format, version: bundle.formatVersion, rosters: bundle.rosters.length, collections: bundle.collections.length, conflicts: getConflictIds(bundle, new Set(existing.map(({ id }) => id))).size });
    } catch (cause) {
      console.error('Failed to inspect Depot backup', cause);
      setError(errorMessage(cause));
    } finally { setBusy(null); }
  };

  const importBackup = async () => {
    if (!preview) return;
    setBusy('import'); setError(null);
    try {
      const response = await fetch(`/api/import?conflict=${policy}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(preview.bundle)
      });
      const result = (await response.json()) as { error?: string; rosters?: number; collections?: number };
      if (!response.ok) throw new Error(result.error || 'The backup could not be imported.');
      setPreview(null); setConfirmOpen(false);
      window.dispatchEvent(new CustomEvent('depot:user-data-changed'));
      setError(`Imported ${result.rosters ?? 0} roster${result.rosters === 1 ? '' : 's'} and ${result.collections ?? 0} collection${result.collections === 1 ? '' : 's'}.`);
    } catch (cause) {
      console.error('Failed to import Depot backup', cause);
      setError(errorMessage(cause));
    } finally { setBusy(null); }
  };

  const submitImport = () => {
    if (!preview) return;
    if (policy === 'replace' && preview.conflicts > 0) setConfirmOpen(true);
    else void importBackup();
  };

  return (
    <section className="flex flex-col gap-2">
      <SectionHeader title="Backups" />
      <div className="surface-card flex flex-col gap-3 p-3">
        <p className="text-sm text-body">Download all rosters and collections as a portable backup, or restore one after reviewing it.</p>
        <div className="flex flex-wrap gap-2">
          {BACKUPS.map((backup) => <Button key={backup.format} type="button" variant="secondary" size="sm" disabled={busy !== null} onClick={() => void exportBackup(backup)} data-testid={`export-backup-${backup.format}`}><Download size={16} />{busy === backup.format ? 'Exporting…' : backup.label}</Button>)}
          <ImportButton label={busy === 'import' ? 'Reading…' : 'Import backup'} disabled={busy !== null} onFilesSelected={(files) => void inspectFile(files)} buttonTestId="import-backup-button" inputTestId="import-backup-input" />
        </div>
        {preview && <div className="flex flex-col gap-3 border-t border-border pt-3" data-testid="backup-preview">
          <p className="text-sm font-medium text-foreground">Backup preview</p>
          <dl className="grid grid-cols-2 gap-2 text-sm text-body"><div><dt className="text-subtle">Format</dt><dd>{preview.format.toUpperCase()}</dd></div><div><dt className="text-subtle">Version</dt><dd>{preview.version}</dd></div><div><dt className="text-subtle">Rosters</dt><dd>{preview.rosters}</dd></div><div><dt className="text-subtle">Collections</dt><dd>{preview.collections}</dd></div></dl>
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground" htmlFor="backup-policy">When an ID already exists</label>
          <select id="backup-policy" className="h-11 rounded-sm border border-border-strong bg-surface-card px-2 text-sm" value={policy} onChange={(event) => setPolicy(event.target.value as ConflictPolicy)}><option value="create">Create only (keep existing)</option><option value="replace">Replace existing</option></select>
          {preview.conflicts > 0 && <p className="text-sm text-warning-fg">{policy === 'create' ? `${preview.conflicts} matching item${preview.conflicts === 1 ? '' : 's'} already exist. Create will keep them and the API will reject this import.` : `${preview.conflicts} existing item${preview.conflicts === 1 ? '' : 's'} will be replaced.`}</p>}
          <Button type="button" size="sm" disabled={busy !== null} onClick={submitImport} data-testid="confirm-backup-import"><Upload size={16} />Import backup</Button>
        </div>}
        {error && <p className="text-sm text-body" role="status">{error}</p>}
      </div>
      <Drawer isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} position="bottom" data-testid="backup-replace-confirmation" aria-label="Replace existing data confirmation">
        <div className="flex flex-col gap-4 p-5"><Alert variant="warning" title="Replace existing data"><p className="text-sm">This will overwrite {preview?.conflicts ?? 0} existing item{preview?.conflicts === 1 ? '' : 's'}. This cannot be undone.</p></Alert><div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)}>Cancel</Button><Button variant="error" size="sm" onClick={() => void importBackup()} data-testid="confirm-backup-replace"><TriangleAlert size={16} />Replace and import</Button></div></div>
      </Drawer>
    </section>
  );
};

export default BackupPanel;
