import { runEventsCommand } from './events-cli';
import { runPeopleCommand } from './people-cli';

function usage(): void {
  console.error(`用法：
  npm run people:check
  npm run people:format
  npm run people:new -- <topic> <id>
  npm run events:check
  npm run events:format
  npm run events:new -- <id>`);
  process.exit(1);
}

const [domain, ...rest] = process.argv.slice(2);
if (domain === 'people') runPeopleCommand(rest);
else if (domain === 'events') runEventsCommand(rest);
else usage();
