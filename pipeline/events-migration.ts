import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkLegacyEventManifest, writeMigrationManifest } from './event-migration';

const pipelineRoot = dirname(fileURLToPath(import.meta.url));
const command = process.argv[2] ?? 'check';

if (command === 'write') {
  const manifest = writeMigrationManifest(pipelineRoot);
  console.log(`已写入 pipeline/events-migration-manifest.json（${manifest.entries.length} 条）`);
} else if (command === 'check') {
  const problems = checkLegacyEventManifest(pipelineRoot);
  if (problems.length > 0) {
    console.error(problems.map((problem) => `error pipeline/events-migration-manifest.json: ${problem}`).join('\n'));
    process.exit(1);
  }
  console.log('events migration check passed：旧 inline 输入与 manifest 逐条一致');
} else {
  console.error('用法：tsx pipeline/events-migration.ts check|write');
  process.exit(1);
}
