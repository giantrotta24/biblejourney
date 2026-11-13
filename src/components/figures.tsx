import { Fragment } from "react";

const FIGURES = /(\d+(?:[:–-]\d+)*)/;

export function Figures({ text }: { text: string }) {
  return text.split(FIGURES).map((part, index) =>
    index % 2 === 1 ? (
      <span key={index} className="figures">
        {part}
      </span>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}
