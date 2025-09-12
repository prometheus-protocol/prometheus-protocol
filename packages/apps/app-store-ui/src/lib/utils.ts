import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * A type guard that filters out null and undefined values from an array.
 * @example
 * const values: (string | null)[] = ['a', null, 'b'];
 * const validValues: string[] = values.filter(isDefined); // ['a', 'b']
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

// A helper function to make the principal ID more readable
export const truncatePrincipal = (principal: string) => {
  if (!principal) return '';
  const parts = principal.split('-');
  if (parts.length <= 2) return principal;
  return `${parts[0]}...${parts[parts.length - 1]}`;
};
