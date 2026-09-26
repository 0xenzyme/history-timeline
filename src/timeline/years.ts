/** 历史纪年没有公元 0 年。正数年份在比例尺上前移一年，使前 1 年与公元 1 年相邻。 */
export function toAxis(year: number): number {
  return year > 0 ? year - 1 : year;
}

/** toAxis 的逆。比例尺上 ≥ 0 的位置对应公元年份。 */
export function fromAxis(axis: number): number {
  return axis >= 0 ? axis + 1 : axis;
}

/** 两端都有年份时的跨度。跨过公元前后时去掉不存在的 0 年。 */
export function spannedYears(birth: number, death: number): number {
  const span = death - birth;
  return birth < 0 && death > 0 ? span - 1 : span;
}
