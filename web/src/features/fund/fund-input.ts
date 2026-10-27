/** Digits of a money text box ("12.500.000" → "12500000"); money stays an integer string end to end. */
export const digitsOf = (value: string): string => value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');

/** An integer VND string shown in a money text box ("12500000" → "12.500.000"). */
export const groupDigits = (amountVnd: string | null | undefined): string =>
  amountVnd ? amountVnd.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
