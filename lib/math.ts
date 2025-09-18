// /lib/math.ts
export const lastVal = <T extends { value: number }>(arr: T[]) =>
  arr.at(-1)?.value ?? null;
