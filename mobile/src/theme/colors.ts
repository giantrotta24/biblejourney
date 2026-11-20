import { useColorScheme } from 'react-native';

export type Palette = {
  paper: string;
  under: string;
  binding: string;
  ink: string;
  ink2: string;
  ink3: string;
  rule: string;
  blue: string;
  blueInk: string;
  onBlue: string;
  ruled: string;
  field: string;
  danger: string;
};

export const light: Palette = {
  paper: '#f7f7f3',
  under: '#e7e7e0',
  binding: '#d3d3cb',
  ink: '#20201d',
  ink2: '#5a5a54',
  ink3: '#8a8a83',
  rule: '#d6d6ce',
  blue: '#2747a5',
  blueInk: '#2747a5',
  onBlue: '#ffffff',
  ruled: '#b3b3aa',
  field: '#ebebe5',
  danger: '#c4342b',
};

export const dark: Palette = {
  paper: '#171715',
  under: '#0d0d0c',
  binding: '#2b2b27',
  ink: '#ecebe5',
  ink2: '#b3b2ab',
  ink3: '#85847e',
  rule: '#34342f',
  blue: '#3f60c8',
  blueInk: '#9cb1f3',
  onBlue: '#ffffff',
  ruled: '#4a4a45',
  field: '#292926',
  danger: '#ff6b5f',
};

export function useColors(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}
