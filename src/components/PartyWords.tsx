import { PARTY } from "../lib/colors";

const WORD: Record<string, string> = { Democrats: PARTY.D, Republicans: PARTY.R };

/** A sentence with the party names set in their colors: "Democrats win the House" with "Democrats" in blue. */
export function PartyWords({ text }: { text: string }) {
  return (
    <>
      {text.split(/(Democrats|Republicans)/).map((part, i) =>
        WORD[part] ? (
          <span key={i} className="party-word" style={{ color: WORD[part] }}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
