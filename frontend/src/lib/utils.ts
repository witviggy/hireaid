import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ROMAN_NUMERALS = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export function formatRoundRoman(roundNumber?: number | null): string {
  if (!roundNumber || roundNumber < 1) return "Round I";
  if (roundNumber < ROMAN_NUMERALS.length) {
    return `Round ${ROMAN_NUMERALS[roundNumber]}`;
  }
  return `Round ${roundNumber}`;
}

export function formatRoundFraction(roundNumber?: number | null, totalRounds?: number | null): string {
  const current = roundNumber && roundNumber > 0 ? roundNumber : 1;
  const total = totalRounds && totalRounds >= current ? totalRounds : Math.max(current, 1);
  return `${current}/${total}`;
}


