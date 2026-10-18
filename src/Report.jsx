import { PersonaArt, Mark } from "./Art.jsx";
export const dateText = (date) =>
  new Date(date).toLocaleDateString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
function Section({ n, title, children }) {
  return (
    <section className="report-section">
      <div className="report-section-title">
        <span>{n}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}
export default function Report({ report: r, config, exporting = false }) {
  const [outerName, innerName] = r.profile.name.split(" · ");
  return (
    <article className={`report-paper ${exporting ? "export-paper" : ""}`}>
      <div className="report-topline">
        <span>
          <Mark />
          {config.brand} / 反差人格档案
        </span>
        <span>{dateText(r.createdAt)}</span>
      </div>
      <header className="report-cover">
        <p className="eyebrow">THE OTHER SIDE OF YOU</p>
        <p className="report-kicker">这次遇见的你，是</p>
        <h1>
          {outerName}
          <br />
          <em>{innerName || "留一点空间给未来"}</em>
        </h1>
        <div className="report-portraits">
          <div>
            <PersonaArt kind={r.profile.outer?.symbol || "moon"} />
            <span>初见限定版</span>
          </div>
          <b>×</b>
          <div>
            <PersonaArt
              kind={r.profile.inner?.symbol || "sun"}
              variant="familiar"
            />
            <span>熟人解锁版</span>
          </div>
        </div>
        <p className="report-tagline">{r.tagline}</p>
        <div className="tag-row">
          {r.profile.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </header>
      <div className="score-banner">
        <div>
          <small>情境切换幅度</small>
          <strong>
            {r.contrast ?? "—"}
            <span>/ 100</span>
          </strong>
        </div>
        <div>
          <b>{r.band}</b>
          <p>
            {r.contrast === null
              ? "经历不足的地方，诚实留白。"
              : "分数描述变化幅度，高低没有优劣。"}
          </p>
        </div>
      </div>
      <p className="report-intro">{r.explanation}</p>
      <Section n="01" title="同一个你，两种相处节奏">
        <div className="chart-legend">
          <span>
            <i className="dot public-dot" />
            不太熟的人面前
          </span>
          <span>
            <i className="dot familiar-dot" />
            放心的熟人面前
          </span>
        </div>
        <div className="dimension-list">
          {r.dimensions.map((d) => (
            <div className="dimension" key={d.key}>
              <div className="dimension-heading">
                <h3>{d.name}</h3>
                <span>
                  {d.valid
                    ? d.delta > 0
                      ? `熟人中 +${d.delta}`
                      : d.delta < 0
                        ? `公开中 +${Math.abs(d.delta)}`
                        : "两种情境相近"
                    : "有效经历不足"}
                </span>
              </div>
              <div className="bar">
                <i
                  className="public-bar"
                  style={{ width: `${d.publicValue ?? 0}%` }}
                />
                <b>{d.publicValue ?? "—"}</b>
              </div>
              <div className="bar">
                <i
                  className="familiar-bar"
                  style={{ width: `${d.familiarValue ?? 0}%` }}
                />
                <b>{d.familiarValue ?? "—"}</b>
              </div>
              <div className="dimension-scale">
                <span>{d.low}</span>
                <span>{d.high}</span>
              </div>
              <p>
                {d.description}{" "}
                <span className="muted">有效配对 {d.pairedCount}/5组。</span>
              </p>
            </div>
          ))}
        </div>
        <p className="small-note">
          0–100为回答频率的线性换算，不是能力得分或人群百分位。
        </p>
        {r.boundary && <p className="note-box">{r.boundary}</p>}
      </Section>
      {r.sufficient && (
        <Section n="02" title="两面，都有自己的理由">
          <div className="two-sides">
            <div>
              <small>初见时的你</small>
              <h3>{r.profile.outer.name}</h3>
              <p>{r.profile.outer.text}</p>
              <p className="strength-line">{r.profile.outer.strength}</p>
            </div>
            <div>
              <small>熟悉后的你</small>
              <h3>{r.profile.inner.name}</h3>
              <p>{r.profile.inner.text}</p>
              <p className="strength-line">相处提示：{r.profile.inner.need}</p>
            </div>
          </div>
          <div className="note-box">
            <b>一个值得留意的小地方</b>
            <p>{r.profile.outer.watch}</p>
          </div>
        </Section>
      )}
      <Section n="03" title="反差之外，你也需要被照顾">
        <div className="support-observation">
          <div>
            <small>他人反馈关注</small>
            <strong>
              {r.cue.value ?? "—"}
              <span>/100</span>
            </strong>
            <p>{r.cue.text}</p>
          </div>
          <div>
            <small>切换后的主观耗能</small>
            <strong>
              {r.cost.value ?? "—"}
              <span>/100</span>
            </strong>
            <p>{r.cost.text}</p>
          </div>
        </div>
        <p className="small-note">
          补充观察，每项至少3/4题有经历才出分；65分为初版文案展示分界，未经常模校准。
        </p>
      </Section>
      {r.evidence.length > 0 && (
        <Section n="04" title="你的选择里，藏着这些线索">
          <div className="evidence-list">
            {r.evidence.map((e) => (
              <div key={e.facet} className="evidence">
                <h3>
                  {e.situation}
                  <small>{e.facet}</small>
                </h3>
                <p>
                  <span>初见情境</span>
                  {e.publicText}
                  <b>{e.publicAnswer}</b>
                </p>
                <p>
                  <span>熟人情境</span>
                  {e.familiarText}
                  <b>{e.familiarAnswer}</b>
                </p>
              </div>
            ))}
          </div>
          <p className="small-note">
            这里只摘录与你的双情境变化相关的回答，供你回看和核对。
          </p>
        </Section>
      )}
      <Section n="05" title="读懂自己，也学一个新概念">
        <div className="learning-list">
          {r.learning.map((l, i) => (
            <div key={l.title}>
              <span>0{i + 1}</span>
              <div>
                <h3>{l.title}</h3>
                <p>{l.body}</p>
                <small>
                  {r.references[l.source].author} ·{" "}
                  {r.references[l.source].year}
                  {i === 2 ? " · 本工具的设计解释" : ""}
                </small>
              </div>
            </div>
          ))}
        </div>
      </Section>
      <Section n="06" title="给接下来一周的你">
        <ol className="action-list">
          {r.actions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ol>
      </Section>
      <div className="report-closing">
        <span>✳</span>
        <h2>
          愿你在不同的关系里，
          <br />
          都能给自己留一点位置。
        </h2>
        <p>有些面貌，值得慢慢被看见。</p>
      </div>
      <details className="method-details" open={exporting || undefined}>
        <summary>这份报告如何形成？</summary>
        <p>{r.method}</p>
        <p>
          “相处同频”＜20、“渐进解锁”20–39、“熟人限定”≥40，均为初版展示区间。类型依据公开情境的表达主动度、主张直接度，以及熟人情境的情绪可见度、玩心释放度，在50分中点组合命名。命名维度落在45–55分时显示过渡画像，保留相邻风格。阈值尚未通过本土样本验证。
        </p>
        <div className="reference-list">
          {r.references.map((ref) => (
            <p key={ref.url}>
              <a href={ref.url} target="_blank" rel="noreferrer">
                {ref.author} ({ref.year}) · {ref.title} ↗
              </a>
              <small>{ref.detail}</small>
            </p>
          ))}
        </div>
      </details>
      <footer className="report-footer">
        <Mark />
        <b>{config.brand} · THE OTHER SIDE OF YOU</b>
        <p>{r.note}</p>
        <p>
          {config.storeName} · {config.supportContact}
          {config.supportWeChat && ` · 微信：${config.supportWeChat}`}
        </p>
        <small>
          档案编号 {r.id?.slice(-10).toUpperCase()} · {r.version}
        </small>
      </footer>
    </article>
  );
}
