export function numeralSize(large: boolean): number {
  return large ? 112 : 128;
}

export function numeralLift(size: number): number {
  return Math.round(size * 0.08);
}

/** Space the numeral font reserves above its digits at lineHeight = fontSize (measured on device at 128pt). */
export function numeralTopInset(size: number): number {
  return Math.round(size * 0.17);
}
