export function Mark() {
  return (
    <svg
      viewBox="0 0 48 48"
      width="44"
      height="44"
      fill="none"
      aria-hidden="true"
    >
      <path d="M24 5a19 19 0 1 0 0 38V5Z" fill="currentColor" />
      <path
        d="M24 9a15 15 0 1 1 0 30"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="m32 16 2.4 5.6L40 24l-5.6 2.4L32 32l-2.4-5.6L24 24l5.6-2.4Z"
        fill="currentColor"
      />
    </svg>
  );
}
export function PersonaArt({ kind = "moon", variant = "public" }) {
  const warm = variant === "familiar";
  const ink = warm ? "#7c4632" : "#315349";
  const fill = warm ? "#e7a461" : "#9ba998";
  return (
    <svg
      className="persona-art"
      viewBox="0 0 280 280"
      width="280"
      height="280"
      fill="none"
      aria-hidden="true"
    >
      <ellipse cx="142" cy="252" rx="87" ry="9" fill={ink} opacity=".08" />
      <path
        d="M45 208c-4-21 8-31 19-26M225 201c14-16 19-10 20-1M46 116l8-7m-10 27 10-2M229 81l5 10m10-6-10 6"
        stroke={ink}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M100 198 91 246h20l16-45m27 0 17 45h21l-10-54"
        fill={fill}
        stroke={ink}
        strokeWidth="1.5"
      />
      <path
        d="M87 199c-9-23-6-61 10-78 11-13 73-16 88 1 17 18 22 51 12 77-21 15-90 13-110 0Z"
        fill={fill}
        stroke={ink}
        strokeWidth="1.7"
      />
      {kind === "moon" ? (
        <>
          <path
            d="M174 49c-32-15-68 5-73 36-6 33 25 59 56 47 13-5 23-15 27-28-33 14-60-26-39-50 8-8 18-9 29-5Z"
            fill={warm ? "#f2cc84" : "#e9e5cb"}
            stroke={ink}
            strokeWidth="1.8"
          />
          <path
            d="m129 92 8 1m19 12 5-3"
            stroke={ink}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * Math.PI) / 6;
            return (
              <path
                key={i}
                d={`M${141 + Math.cos(a) * 58} ${85 + Math.sin(a) * 58}l${Math.cos(a) * 11} ${Math.sin(a) * 11}`}
                stroke={ink}
                strokeWidth="2"
                strokeLinecap="round"
              />
            );
          })}
          <circle
            cx="141"
            cy="85"
            r="45"
            fill={warm ? "#efbd68" : "#d6d3ac"}
            stroke={ink}
            strokeWidth="1.8"
          />
          <path
            d={
              kind === "spark"
                ? "m120 79 6-3 6 3m18 0 6-3 6 3"
                : "M124 78v5m31-5v5"
            }
            stroke={ink}
            strokeWidth="2.3"
            strokeLinecap="round"
          />
          <path
            d="M130 97q11 13 23-1"
            stroke={ink}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )}
      <path
        d={
          warm
            ? "M99 152c-24 16-30 13-42-2m125 3c19-6 27-18 29-30"
            : "M99 154c13 26 27 24 40 13m45-11c-9 12-20 16-31 10"
        }
        stroke={ink}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M136 189h15m-8-8v16"
        stroke={ink}
        strokeWidth="1.5"
        opacity=".5"
      />
      {warm ? (
        <>
          <path
            d="m226 42 3 10 10 3-10 3-3 10-3-10-10-3 10-3Z"
            fill="#b27147"
          />
          <path d="m61 70 2 7 7 2-7 2-2 7-2-7-7-2 7-2Z" fill="#b27147" />
        </>
      ) : (
        <>
          <circle cx="62" cy="78" r="3" fill={ink} />
          <path d="m221 39 2 7 7 2-7 2-2 7-2-7-7-2 7-2Z" fill={ink} />
        </>
      )}
    </svg>
  );
}
export function HeroArt() {
  return (
    <div className="hero-art" aria-label="初见时的月亮，熟人面前的小太阳插画">
      <div className="orbit-line" />
      <span className="art-spark">✳</span>
      <span className="art-note">
        SAME SOUL,
        <br />
        DIFFERENT SIDES.
      </span>
      <div className="persona-card card-public">
        <div className="card-caption">
          <span>01 / 初见限定</span>
          <span>◔</span>
        </div>
        <PersonaArt kind="moon" />
        <div className="art-label">
          安静一点，也很好。<small>THE FIRST IMPRESSION</small>
        </div>
      </div>
      <div className="persona-card card-familiar">
        <div className="card-caption">
          <span>02 / 熟人解锁</span>
          <span>✺</span>
        </div>
        <PersonaArt kind="sun" variant="familiar" />
        <div className="art-label">
          这一面，你见过吗？<small>THE INNER CIRCLE EDITION</small>
        </div>
      </div>
      <span className="art-sticker">
        两个你，
        <br />
        都成立。
      </span>
      <span className="art-footnote">A FIELD GUIDE TO YOUR OTHER SIDE ↗</span>
    </div>
  );
}
