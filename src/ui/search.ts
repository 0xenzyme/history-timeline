import type { Person, Topic } from '../types';
import { formatLifespan } from '../format';
import { esc } from '../timeline/svg';

export function searchPeople(topic: Topic, query: string): Person[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return topic.people
    .map((person) => ({ person, score: scorePerson(person, q) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.person.display.localeCompare(b.person.display, 'zh'))
    .slice(0, 8)
    .map((item) => item.person);
}

function scorePerson(person: Person, q: string): number {
  const display = person.display.toLowerCase();
  const name = person.name.toLowerCase();
  if (display === q || name === q) return 100;
  if (display.startsWith(q) || name.startsWith(q)) return 80;
  if (display.includes(q) || name.includes(q)) return 60;
  if (person.tags?.some((tag) => tag.toLowerCase().includes(q)) === true) return 40;
  if (person.title?.toLowerCase().includes(q) === true) return 20;
  return 0;
}

export function renderSearchResults(people: Person[], query: string): string {
  if (!query.trim()) return '';
  if (people.length === 0) {
    return `<p class="search-empty">没有匹配的人物</p>`;
  }
  return `<ul>${people
    .map(
      (person) =>
        `<li><button type="button" class="search-hit" data-search-hit="${esc(person.id)}">
          <span class="search-hit-name">${esc(person.display)}</span>
          <span class="search-hit-meta">${esc(person.name)} · ${esc(formatLifespan(person))}</span>
        </button></li>`,
    )
    .join('')}</ul>`;
}
