"use client";

/**
 * The market-stall sketch from the design review — hand-drawn line art, redrawn as an
 * inline SVG so it's crisp at any size and free to theme. The reference was drawn for a
 * light/cream page; this one uses currentColor so a wrapping text color controls it,
 * because the live hero is dark.
 */
export function DukaIllustration({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 520 380"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {/* sign */}
        <path d="M138,22 L294,17 L291,61 L136,65 Z" />
        <text
          x="213"
          y="48"
          textAnchor="middle"
          fill="currentColor"
          stroke="none"
          fontSize="20"
          fontWeight="700"
          letterSpacing="3"
          fontFamily="var(--font-display), ui-sans-serif, sans-serif"
        >
          DUKA
        </text>

        {/* posts */}
        <path d="M150,64 L112,190" />
        <path d="M281,60 L321,190" />

        {/* scalloped canopy */}
        <path d="M112,190 L141,165 L160,190 L190,165 L211,190 L240,165 L261,190 L290,165 L321,190" />
        <path d="M118,188 L128,176" />
        <path d="M131,188 L141,176" />
        <path d="M144,188 L154,176" />
        <path d="M157,188 L167,176" />
        <path d="M170,188 L180,176" />
        <path d="M183,188 L193,176" />
        <path d="M196,188 L206,176" />
        <path d="M209,188 L219,176" />
        <path d="M222,188 L232,176" />
        <path d="M235,188 L245,176" />
        <path d="M248,188 L258,176" />
        <path d="M261,188 L271,176" />
        <path d="M274,188 L284,176" />
        <path d="M287,188 L297,176" />
        <path d="M300,188 L310,176" />

        {/* counter */}
        <path d="M90,190 L300,190 L300,262 L90,262 Z" />
        <g opacity="0.6">
          <path d="M96,260 L136,220" />
          <path d="M107,260 L147,220" />
          <path d="M118,260 L158,220" />
          <path d="M129,260 L169,220" />
          <path d="M140,260 L180,220" />
          <path d="M151,260 L191,220" />
          <path d="M162,260 L202,220" />
          <path d="M173,260 L213,220" />
          <path d="M184,260 L224,220" />
          <path d="M195,260 L235,220" />
          <path d="M206,260 L246,220" />
          <path d="M217,260 L257,220" />
          <path d="M228,260 L268,220" />
          <path d="M239,260 L279,220" />
          <path d="M250,260 L290,220" />
          <path d="M261,260 L300,221" />
          <path d="M272,260 L300,232" />
          <path d="M283,260 L300,243" />
          <path d="M294,260 L300,254" />
        </g>

        {/* doorway */}
        <path d="M251,100 L296,100 L296,190 L251,190 Z" opacity="0.7" />

        {/* shopkeeper */}
        <circle cx="195" cy="150" r="18" />
        <path d="M168,190 C168,163 222,163 222,190" />
        <path d="M206,180 c-3,-6 -12,-4 -12,3 c0,6 8,10 12,13 c4,-3 12,-7 12,-13 c0,-7 -9,-9 -12,-3 Z" />

        {/* customers */}
        <circle cx="390" cy="228" r="22" />
        <path d="M364,340 L369,254 L411,254 L416,340 Z" />
        <path d="M368,272 L300,253" />

        <circle cx="452" cy="244" r="17" />
        <path d="M431,340 L434,266 L470,266 L473,340 Z" />

        {/* attention marks */}
        <path d="M472,150 L483,139" />
        <path d="M483,161 L496,152" />
        <path d="M490,177 L505,171" />

        {/* ground */}
        <path d="M40,340 L480,340" />
        <g opacity="0.7">
          <path d="M46,340 L41,330" />
        <path d="M61,340 L56,330" />
        <path d="M76,340 L71,330" />
        <path d="M91,340 L86,330" />
        <path d="M106,340 L101,330" />
        <path d="M121,340 L116,330" />
        <path d="M136,340 L131,330" />
        <path d="M151,340 L146,330" />
        <path d="M166,340 L161,330" />
        <path d="M181,340 L176,330" />
        <path d="M196,340 L191,330" />
        <path d="M211,340 L206,330" />
        <path d="M226,340 L221,330" />
        <path d="M241,340 L236,330" />
        <path d="M256,340 L251,330" />
        <path d="M271,340 L266,330" />
        <path d="M286,340 L281,330" />
        <path d="M301,340 L296,330" />
        <path d="M316,340 L311,330" />
        <path d="M331,340 L326,330" />
        <path d="M346,340 L341,330" />
        <path d="M361,340 L356,330" />
        <path d="M376,340 L371,330" />
        <path d="M391,340 L386,330" />
        <path d="M406,340 L401,330" />
        <path d="M421,340 L416,330" />
        <path d="M436,340 L431,330" />
        <path d="M451,340 L446,330" />
        <path d="M466,340 L461,330" />
        </g>
      </g>
    </svg>
  );
}
