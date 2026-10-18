import { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  LockKeyhole,
  Eye,
  EyeOff,
  Check,
  ChevronRight,
  Clock3,
  ShieldCheck,
  Download,
  Link2,
  RotateCcw,
  Gift,
  X,
  LoaderCircle,
  BookOpen,
  CloudCheck,
  Copy,
  Share2,
  LogOut,
  History,
  Info,
} from "lucide-react";
import { api, getToken, setToken, resultUrl, copyText } from "./api.js";
import { createAttemptSaver } from "./attempt-saver.js";
import configDefault from "../site.config.json";
import { Mark, HeroArt, PersonaArt } from "./Art.jsx";
import Report, { dateText } from "./Report.jsx";

const readRoute = () => {
  const hash = location.hash;
  const r = hash.match(/^#\/result\/([^/]+)$/);
  return r
    ? { type: "result", id: r[1] }
    : {
        type:
          hash === "#/quiz" ? "quiz" : hash === "#/ready" ? "ready" : "home",
      };
};
const go = (path) => {
  location.hash = path;
  window.scrollTo({ top: 0, behavior: "instant" });
};
const requestId = () =>
  globalThis.crypto.randomUUID?.() ||
  "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (
      Number(c) ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))
    ).toString(16),
  );
const contextLabel = {
  public: "不太熟的人面前",
  familiar: "放心的熟人面前",
  support: "关于你的相处感受",
};

function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    el.showModal();
    return () => el.open && el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <button
        type="button"
        className="icon-button modal-close"
        aria-label="关闭弹窗"
        onClick={onClose}
      >
        <X size={20} />
      </button>
      {children}
    </dialog>
  );
}
function Brand() {
  return (
    <button
      className="brand"
      onClick={() => go("/")}
      aria-label={`${configDefault.brand}，返回首页`}
    >
      <Mark />
      <span>
        {configDefault.brand}
        <small>{configDefault.englishBrand}</small>
      </span>
    </button>
  );
}
function ErrorLine({ children }) {
  return children ? (
    <p className="error-line" role="alert">
      <Info size={16} />
      <span>{children}</span>
    </p>
  ) : null;
}
function Intro({ compact = false }) {
  return (
    <div className={`intro-guide ${compact ? "compact-guide" : ""}`}>
      <div>
        <span>01</span>
        <p>
          <b>回想最近三个月</b>选择实际出现的频率，不必挑“理想答案”。
        </p>
      </div>
      <div>
        <span>02</span>
        <p>
          <b>熟人 ≠ 所有家人或同事</b>请想到真正让你放心、能放松相处的人。
        </p>
      </div>
      <div>
        <span>03</span>
        <p>
          <b>没经历过，可以留白</b>选择“暂无这类经历”，不强迫自己猜测。
        </p>
      </div>
    </div>
  );
}

function Home({ session, onUnlock, onStart, onHistory, onAbout }) {
  return (
    <>
      <section className="hero shell">
        <div className="hero-copy">
          <p className="eyebrow">
            <i /> A LITTLE MORE THAN MEETS THE EYE
          </p>
          <div className="hero-subject">反差人格 · 情境探索</div>
          <h1>
            你的反差人格，
            <br />
            <em>到底有多大？</em>
          </h1>
          <p className="hero-description">
            初见时的礼貌克制，熟悉后的松弛放肆。
            <br />
            哪一面更像你？也许，两面都是。
          </p>
          <div className="hero-actions">
            <button
              className="button primary"
              onClick={() => (session ? go("/ready") : onUnlock())}
            >
              {session?.active ? "继续我的探索" : "解锁另一个自己"}
              <ArrowRight size={19} />
            </button>
            <button
              className="text-button"
              onClick={() =>
                document
                  .getElementById("discover")
                  .scrollIntoView({ behavior: "smooth" })
              }
            >
              先了解一下
              <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="hero-facts">
            <span>
              <b>48</b>道生活情境题
            </span>
            <span>
              <b>16</b>种趣味双面画像
            </span>
            <span>
              <b>8–12</b>分钟，留给自己
            </span>
          </div>
          <p className="hero-fineprint">
            <ShieldCheck size={14} />
            无需姓名或手机号 · 答题进度自动保存
          </p>
        </div>
        <HeroArt />
      </section>
      <div className="marquee">
        <div>
          <span>初见限定</span>
          <i>✳</i>
          <span>熟人解锁</span>
          <i>✳</i>
          <span>两个你，都成立</span>
          <i>✳</i>
          <span>EVERY SIDE IS YOUR SIDE</span>
          <i>✳</i>
          <span>给自己一点好奇</span>
        </div>
      </div>
      <section className="discover shell" id="discover">
        <div className="section-heading">
          <div>
            <p className="eyebrow">A FEW FAMILIAR MOMENTS</p>
            <h2>
              这些瞬间，<em>像不像你？</em>
            </h2>
          </div>
          <p>
            有的面貌，需要熟悉之后才能看见。
            <br />
            从小小的生活片刻，发现相处中的变化。
          </p>
        </div>
        <div className="moment-grid">
          {[
            [
              "01",
              "微信里的你",
              "新群里斟酌半天才发一句话，",
              "熟人群里，表情包比文字多。",
              "“这套表情包，只有自己人见过。”",
              "moon",
            ],
            [
              "02",
              "聚餐时的你",
              "不太熟的时候，常说“我都行”，",
              "和朋友一起，却有一张想吃清单。",
              "“不是没想法，只是还没那么熟。”",
              "flower",
            ],
            [
              "03",
              "相处后的你",
              "在人群里，能把气氛照顾得很好，",
              "回到家，却想先安静一会儿。",
              "“看起来很稳，也可能需要充电。”",
              "sun",
            ],
          ].map(([n, title, a, b, quote, kind]) => (
            <div className={`moment moment-${n}`} key={n}>
              <div className="moment-top">
                <span>FIELD NOTE / {n}</span>
                <span>↗</span>
              </div>
              <h3>{title}</h3>
              <p>
                {a}
                <br />
                {b}
              </p>
              <div className="moment-drawing">
                <PersonaArt
                  kind={kind}
                  variant={n === "03" ? "familiar" : "public"}
                />
              </div>
              <blockquote>{quote}</blockquote>
            </div>
          ))}
        </div>
      </section>
      <section className="method-section" id="method">
        <div className="shell method-layout">
          <div className="method-copy">
            <p className="eyebrow">MORE THAN A LABEL</p>
            <h2>
              有趣的称号，
              <br />
              也有认真观察的依据。
            </h2>
            <p>
              比较相似的行为在两类关系中出现的频率，
              <br />
              观察你的表达，如何随情境慢慢变化。
            </p>
            <button className="text-button" onClick={onAbout}>
              了解理论与计分
              <ArrowUpRight size={17} />
            </button>
            <div className="method-numbers">
              <div>
                <b>40</b>
                <span>
                  双情境题
                  <br />
                  20组配对
                </span>
              </div>
              <span>＋</span>
              <div>
                <b>8</b>
                <span>
                  补充题
                  <br />
                  反馈与耗能
                </span>
              </div>
            </div>
          </div>
          <div className="facet-grid">
            {[
              ["01", "表达主动度", "先安静观察，还是顺势接话？"],
              ["02", "情绪可见度", "感受在心里，还是写在脸上？"],
              ["03", "主张直接度", "先顾及分寸，还是清楚说出？"],
              ["04", "玩心释放度", "保持端正，还是轻松玩梗？"],
            ].map(([n, title, text]) => (
              <div key={n}>
                <small>{n} / OBSERVATION</small>
                <h3>{title}</h3>
                <p>{text}</p>
                <span>↔</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="shell final-invite">
        <span className="invite-symbol">✳</span>
        <p className="eyebrow">EVERY SIDE IS YOUR SIDE</p>
        <h2>
          给每一个“熟人限定”的你，
          <br />
          <em>一份温柔的自我介绍。</em>
        </h2>
        <p>
          一份双情境画像，一张可以收藏的长图，
          <br />
          还有一些，让别人更懂你的相处线索。
        </p>
        <button
          className="button primary"
          onClick={() => (session ? go("/ready") : onUnlock())}
        >
          开始认识另一个自己
          <ArrowRight size={18} />
        </button>
        <small>原创自我探索初版 · 理论启发，信效度尚待本土样本验证</small>
      </section>
    </>
  );
}

function Ready({ session, onStart, onUnlock, busy, error }) {
  return (
    <main className="ready-page shell">
      <button className="back-link" onClick={() => go("/")}>
        <ArrowLeft size={16} />
        返回首页
      </button>
      <div className="ready-layout">
        <div className="ready-picture">
          <HeroArt />
        </div>
        <div className="ready-content">
          <p className="eyebrow">BEFORE WE BEGIN</p>
          <h1>
            慢一点，
            <br />
            <em>照着真实的自己选。</em>
          </h1>
          <p>
            题目里的两种情境，是“不太熟的人面前”和“放心的熟人面前”。它们描述不同关系里的你，都不必更像某种标准答案。
          </p>
          <Intro />
          <div className="quota-note">
            <LockKeyhole size={17} />
            {session
              ? `此密码剩余 ${session.remaining} / 3 次${session.active ? " · 可继续未完成测评" : ""}`
              : "输入购买后收到的密码，即可开始。"}
          </div>
          <ErrorLine>{error}</ErrorLine>
          <button
            className="button primary full-width"
            disabled={busy}
            onClick={session ? onStart : onUnlock}
          >
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <>
                {session?.active
                  ? "继续未完成测评"
                  : session && session.remaining === 0
                    ? "更换密码后开始"
                    : "开始测评"}
                <ArrowRight size={18} />
              </>
            )}
          </button>
          <p className="small-note">
            开始新测评扣1次；验证密码、刷新和继续答题均不重复扣次。
            <br />
            48题，预计8–12分钟。完成后可保存及分享报告。
          </p>
        </div>
      </div>
    </main>
  );
}

function Quiz({ initial, onComplete, onReload, onHome, onReauth }) {
  const [quiz, setQuiz] = useState(null),
    [attempt, setAttempt] = useState(initial),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(null),
    [loadError, setLoadError] = useState(""),
    [submitting, setSubmitting] = useState(false),
    [showMap, setShowMap] = useState(false),
    [showIncomplete, setShowIncomplete] = useState(false);
  const saver = useRef(null);
  const titleRef = useRef(null);
  useEffect(() => {
    const instance = createAttemptSaver(initial, {
      onChange: setAttempt,
      onSaving: setSaving,
      onError: setError,
      request: (snapshot) =>
        api(`/attempts/${snapshot.id}`, {
          method: "PUT",
          body: {
            answers: snapshot.answers,
            currentQuestion: snapshot.currentQuestion,
            revision: snapshot.revision,
          },
        }),
    });
    saver.current = instance;
    setAttempt(instance.get());
    instance.resume();
    let cancelled = false;
    api("/tests/contrast")
      .then((data) => {
        if (!cancelled) setQuiz(data);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message);
      });
    return () => {
      cancelled = true;
      instance.dispose();
    };
  }, []);
  const move = (index) => {
    saver.current.update({ currentQuestion: index });
    setShowMap(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const choose = (value) => {
    const current = saver.current.get();
    const answers = [...current.answers];
    answers[current.currentQuestion] = value;
    saver.current.update({ answers });
  };
  const submit = async () => {
    const current = saver.current.get();
    const missing = current.answers.indexOf(-1);
    if (missing >= 0) {
      move(missing);
      return;
    }
    if (!showIncomplete && current.answers.filter((a) => a === -2).length > 4) {
      setShowIncomplete(true);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (!(await saver.current.flush())) return;
      const latest = saver.current.get();
      const data = await api(`/attempts/${latest.id}/submit`, {
        method: "POST",
        body: { answers: latest.answers, revision: latest.revision },
      });
      saver.current.dispose({ discard: true });
      onComplete(data);
    } catch (e) {
      setError(e);
    } finally {
      setSubmitting(false);
    }
  };
  const leave = async () => {
    await saver.current?.flush();
    onHome();
  };
  if (loadError)
    return (
      <main className="empty-state shell">
        <ErrorLine>{loadError}</ErrorLine>
        <button className="button primary" onClick={onReload}>
          重新载入
        </button>
      </main>
    );
  if (!quiz) return <Loading text="正在取出你的生活情境卡…" />;
  const index = attempt.currentQuestion,
    q = quiz.questions[index],
    selected = attempt.answers[index],
    answered = attempt.answers.filter((a) => a !== -1).length;
  return (
    <main className="quiz-page shell">
      <div className="quiz-top">
        <button className="back-link" onClick={leave}>
          <ArrowLeft size={16} />
          稍后继续
        </button>
        <span className={`save-state ${error ? "has-error" : ""}`}>
          {saving ? (
            <LoaderCircle size={14} className="spin" />
          ) : (
            <CloudCheck size={14} />
          )}{" "}
          {error
            ? "本机已留存，待同步"
            : saving
              ? "正在同步进度"
              : "进度已保存"}
        </span>
      </div>
      <div className="quiz-layout">
        <aside className="quiz-aside">
          <p className="eyebrow">YOUR OTHER SIDE</p>
          <h2>
            反差人格
            <br />
            探索手记
          </h2>
          <p>
            每一种相处状态，
            <br />
            都有自己的来由。
          </p>
          <div className="quiz-side-art">
            <PersonaArt
              kind={q.context === "familiar" ? "sun" : "moon"}
              variant={q.context === "familiar" ? "familiar" : "public"}
            />
          </div>
          <button
            className="question-map-toggle"
            onClick={() => setShowMap(!showMap)}
          >
            已作答 {answered} / 48 题{" "}
            <span>{showMap ? "收起" : "查看题目"}</span>
          </button>
          <div className={`question-map ${showMap ? "map-open" : ""}`}>
            {quiz.questions.map((item, i) => (
              <button
                aria-label={`跳转到第${i + 1}题`}
                aria-current={i === index ? "step" : undefined}
                className={`${attempt.answers[i] !== -1 ? "answered" : ""} ${i === index ? "current" : ""}`}
                key={item.id}
                onClick={() => move(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </aside>
        <section className="question-panel">
          <div className="question-progress">
            <span>
              QUESTION <b>{String(index + 1).padStart(2, "0")}</b> / 48
            </span>
            <span>{Math.round((answered / 48) * 100)}%</span>
          </div>
          <div className="progress-track">
            <i style={{ width: `${(answered / 48) * 100}%` }} />
          </div>
          <div className={`context-chip context-${q.context}`}>
            <i />
            {contextLabel[q.context]}
          </div>
          <p className="question-instruction">
            回想最近三个月，这种情况出现的频率是？
          </p>
          <h1 ref={titleRef} tabIndex={-1} className="question-text" key={q.id}>
            {q.prompt}
          </h1>
          <div
            className="answer-options"
            role="radiogroup"
            aria-label="选择出现频率"
          >
            {q.options.map((option, i) => {
              const value = i === 5 ? -2 : i;
              return (
                <button
                  role="radio"
                  aria-checked={selected === value}
                  className={`answer-option ${selected === value ? "selected" : ""} ${i === 5 ? "not-applicable" : ""}`}
                  key={option}
                  disabled={submitting}
                  onClick={() => choose(value)}
                >
                  <span className="option-indicator">
                    {selected === value ? (
                      <Check size={15} />
                    ) : i === 5 ? (
                      "—"
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span>{option}</span>
                  {i === 0 && <small>很少发生</small>}
                  {i === 4 && <small>大多如此</small>}
                </button>
              );
            })}
          </div>
          <ErrorLine>{error?.message}</ErrorLine>
          {error && (
            <div className="sync-actions">
              {error.code === "REVISION_CONFLICT" ||
              error.code === "ATTEMPT_COMPLETED" ? (
                <button className="text-button" onClick={onReload}>
                  载入其他页面的最新进度
                </button>
              ) : error.code === "SESSION_EXPIRED" ? (
                <button className="text-button" onClick={onReauth}>
                  重新验证密码
                </button>
              ) : (
                <button
                  className="text-button"
                  onClick={() => saver.current.flush()}
                >
                  重试同步
                </button>
              )}
            </div>
          )}
          <div className="question-navigation">
            <button
              className="button secondary"
              disabled={index === 0 || submitting}
              onClick={() => move(index - 1)}
            >
              <ArrowLeft size={17} />
              上一题
            </button>
            <span>
              {index === 47
                ? "答案可以随时返回修改"
                : "没有标准答案，按真实经历选择"}
            </span>
            {index < 47 ? (
              <button
                className="button primary"
                disabled={selected === -1 || submitting}
                onClick={() => move(index + 1)}
              >
                下一题
                <ArrowRight size={17} />
              </button>
            ) : (
              <button
                className="button primary"
                disabled={selected === -1 || submitting}
                onClick={submit}
              >
                {submitting ? (
                  <>
                    <LoaderCircle size={17} className="spin" />
                    生成报告中
                  </>
                ) : (
                  <>
                    查看我的反差
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            )}
          </div>
        </section>
      </div>
      {showIncomplete && (
        <Modal
          title="关于暂无经历的回答"
          onClose={() => setShowIncomplete(false)}
        >
          <p className="eyebrow">A LITTLE ROOM FOR THE UNKNOWN</p>
          <h2>
            没经历过的地方，
            <br />
            可以先留白。
          </h2>
          <p>
            你有{attempt.answers.filter((a) => a === -2).length}
            题选择了“暂无这类经历”。每个维度需要至少3组有效配对；不足时，报告会如实说明，并不勉强生成类型或分数。
          </p>
          <div className="modal-actions">
            <button
              className="button primary"
              onClick={submit}
              disabled={submitting}
            >
              按真实回答生成报告
            </button>
            <button
              className="text-button"
              onClick={() => {
                setShowIncomplete(false);
                move(attempt.answers.indexOf(-2));
              }}
            >
              回看暂无经历的题目
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
function Loading({ text = "正在整理这一次的你…" }) {
  return (
    <main className="loading-state">
      <Mark />
      <LoaderCircle className="spin" size={22} />
      <p>{text}</p>
    </main>
  );
}

function ResultPage({ id, config, session, onRetest, onReward, onToast }) {
  const [report, setReport] = useState(null),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0),
    [exporting, setExporting] = useState(false),
    [image, setImage] = useState(null),
    [shareLink, setShareLink] = useState(false),
    [imageError, setImageError] = useState("");
  const exportRef = useRef(null);
  const imageRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    setReport(null);
    setError("");
    api(`/results/${id}`)
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id, reload]);
  useEffect(
    () => () => {
      if (imageRef.current) URL.revokeObjectURL(imageRef.current.url);
    },
    [],
  );
  const share = async () => {
    const ok = await copyText(resultUrl(id));
    ok ? onToast("结果链接已复制，发给想分享的人吧。") : setShareLink(true);
  };
  const save = async () => {
    setExporting(true);
    setImageError("");
    try {
      await document.fonts.ready;
      const { default: html2canvas } = await import("html2canvas");
      const node = exportRef.current;
      const rect = node.getBoundingClientRect();
      const canvas = await html2canvas(node, {
        backgroundColor: "#f7f5ef",
        scale: Math.min(
          2,
          Math.sqrt(10000000 / (rect.width * node.scrollHeight)),
        ),
        useCORS: true,
        logging: false,
        windowWidth: 1200,
        windowHeight: Math.max(1000, node.scrollHeight),
        scrollX: 0,
        scrollY: 0,
      });
      const blob = await new Promise((resolve, reject) =>
        canvas.toBlob(
          (b) =>
            b ? resolve(b) : reject(new Error("图片生成未成功，请重试。")),
          "image/png",
        ),
      );
      if (imageRef.current) URL.revokeObjectURL(imageRef.current.url);
      const data = {
        url: URL.createObjectURL(blob),
        blob,
        name: `${config.brand}-反差人格-${id.slice(-8)}.png`,
        width: canvas.width,
        height: canvas.height,
      };
      imageRef.current = data;
      setImage(data);
      if (!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        const a = document.createElement("a");
        a.href = data.url;
        a.download = data.name;
        a.click();
      }
    } catch (e) {
      setImageError(e.message || "图片未能生成，请稍后再试。");
    } finally {
      setExporting(false);
    }
  };
  const nativeShare = async () => {
    try {
      const file = new File([image.blob], image.name, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "我的反差人格档案" });
      } else onToast("请长按下方完整图片保存，或点击下载图片。");
    } catch (e) {
      if (e.name !== "AbortError")
        onToast("请长按图片保存，或使用下载图片按钮。");
    }
  };
  if (error)
    return (
      <main className="empty-state shell">
        <BookOpen size={40} />
        <h1>这份档案暂时没有打开</h1>
        <p>{error}</p>
        <button
          className="button primary"
          onClick={() => setReload((v) => v + 1)}
        >
          重新载入
        </button>
        <button className="text-button" onClick={() => go("/")}>
          回到首页
        </button>
      </main>
    );
  if (!report) return <Loading />;
  const owner = session?.results?.some((r) => r.id === id);
  return (
    <main className="results-page shell">
      <div className="result-breadcrumb">
        <button className="back-link" onClick={() => go("/")}>
          <ArrowLeft size={16} />
          返回首页
        </button>
        <span>{owner ? "属于你的探索档案" : "一份与你分享的探索档案"}</span>
      </div>
      <div className="results-layout">
        <div className="report-main">
          <Report report={report} config={config} />
        </div>
        <aside className="result-tools">
          <p className="eyebrow">KEEP THIS SIDE OF YOU</p>
          <h2>
            把这一面，
            <br />
            好好收藏。
          </h2>
          <p>
            分享给朋友，问问他：
            <br />
            “你见过我的哪一面？”
          </p>
          <button
            className="button primary full-width"
            onClick={save}
            disabled={exporting}
          >
            {exporting ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Download size={17} />
            )}{" "}
            {exporting ? "正在生成完整长图" : "保存结果长图"}
          </button>
          <button className="button secondary full-width" onClick={share}>
            <Link2 size={17} />
            复制结果链接
          </button>
          <ErrorLine>{imageError}</ErrorLine>
          <p className="small-note">
            长图包含完整分析。
            <br />
            知道链接的人，无需密码即可阅读本报告。
          </p>
          <div className="tool-divider" />
          <button className="tool-link" onClick={onRetest}>
            <RotateCcw size={17} />
            再测一次
            <ChevronRight size={16} />
          </button>
          <button className="tool-link reward-link" onClick={onReward}>
            <Gift size={17} />
            好评有礼<span>¥1</span>
          </button>
          <div className="mini-message">
            <span>✳</span>每一次选择，
            <br />
            都是认识自己的新线索。
          </div>
        </aside>
      </div>
      <div className="export-stage" aria-hidden="true">
        <div ref={exportRef} className="export-surface">
          <Report report={report} config={config} exporting />
        </div>
      </div>
      {image && (
        <Modal title="保存完整结果长图" wide onClose={() => setImage(null)}>
          <p className="eyebrow">YOUR FIELD NOTES, TO KEEP</p>
          <h2>把完整的自己，留在这里。</h2>
          <p>
            手机可以长按下方图片保存到相册；电脑可下载PNG图片。
            <br />
            向下滑动，可以查看整张长图。
          </p>
          <div className="image-actions">
            <a
              className="button primary"
              href={image.url}
              download={image.name}
            >
              <Download size={17} />
              下载图片
            </a>
            <button className="button secondary" onClick={nativeShare}>
              <Share2 size={17} />
              系统分享 / 保存
            </button>
          </div>
          <img
            className="export-preview"
            src={image.url}
            alt="完整的反差人格结果长图，包含各维度、分析、回答线索与行动建议"
          />
          <p className="small-note">
            {image.width} × {image.height} 像素 · 完整PNG长图
          </p>
        </Modal>
      )}
      {shareLink && (
        <Modal title="分享结果链接" onClose={() => setShareLink(false)}>
          <h2>把这一面，分享出去。</h2>
          <p>浏览器暂未允许自动复制。请长按或选中下方链接后复制。</p>
          <input
            className="share-input"
            readOnly
            value={resultUrl(id)}
            onFocus={(e) => e.target.select()}
            aria-label="结果分享链接"
          />
        </Modal>
      )}
    </main>
  );
}

export default function App() {
  const [route, setRoute] = useState(readRoute),
    [config, setConfig] = useState(configDefault),
    [session, setSession] = useState(null),
    [boot, setBoot] = useState(false),
    [modal, setModal] = useState(null),
    [code, setCode] = useState(""),
    [showCode, setShowCode] = useState(false),
    [loginBusy, setLoginBusy] = useState(false),
    [loginError, setLoginError] = useState(""),
    [startBusy, setStartBusy] = useState(false),
    [startError, setStartError] = useState(""),
    [toast, setToast] = useState(""),
    [epoch, setEpoch] = useState(0);
  const startId = useRef(null),
    toastTimer = useRef(null);
  const notify = useCallback((text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4000);
  }, []);
  const refresh = useCallback(async () => {
    if (!getToken()) {
      setSession(null);
      setBoot(true);
      return null;
    }
    try {
      const s = await api("/session");
      setSession(s);
      return s;
    } catch (e) {
      if (e.status === 401) {
        setToken("");
        setSession(null);
      } else notify(e.message);
      return null;
    } finally {
      setBoot(true);
    }
  }, [notify]);
  useEffect(() => {
    const handler = () => setRoute(readRoute());
    window.addEventListener("hashchange", handler);
    api("/config")
      .then(setConfig)
      .catch(() => {});
    refresh();
    return () => {
      window.removeEventListener("hashchange", handler);
      clearTimeout(toastTimer.current);
    };
  }, []);
  useEffect(() => {
    if (route.type === "home" && boot) refresh();
  }, [route.type]);
  useEffect(() => {
    document.title =
      route.type === "quiz"
        ? "正在探索 · 你的反差人格有多大？"
        : route.type === "result"
          ? `我的反差人格档案 · ${configDefault.brand}`
          : `你的反差人格有多大？ · ${configDefault.brand}`;
  }, [route.type]);
  const unlock = () => {
    setCode("");
    setLoginError("");
    setModal("password");
  };
  const login = async (e) => {
    e.preventDefault();
    setLoginBusy(true);
    setLoginError("");
    try {
      const { token, ...s } = await api("/session", {
        method: "POST",
        body: { code },
      });
      setToken(token);
      setSession(s);
      setModal(null);
      setCode("");
      setEpoch((v) => v + 1);
      if (route.type !== "quiz") go("/ready");
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginBusy(false);
    }
  };
  const start = async () => {
    if (!session || (!session.active && session.remaining === 0)) {
      unlock();
      return;
    }
    setStartBusy(true);
    setStartError("");
    try {
      if (!startId.current) startId.current = requestId();
      const data = await api("/attempts", {
        method: "POST",
        body: { quizId: "contrast", requestId: startId.current },
      });
      setSession(data.session);
      startId.current = null;
      setEpoch((v) => v + 1);
      data.attempt.resultId
        ? go(`/result/${data.attempt.resultId}`)
        : go("/quiz");
    } catch (e) {
      setStartError(e.message);
      if (e.code === "SESSION_EXPIRED") unlock();
    } finally {
      setStartBusy(false);
    }
  };
  const retest = () => {
    go("/ready");
  };
  const reload = async () => {
    await refresh();
    setEpoch((v) => v + 1);
  };
  return (
    <div className="app">
      <header className="site-header shell">
        <Brand />
        <nav aria-label="主导航">
          <a
            href="#discover"
            onClick={(e) => {
              e.preventDefault();
              if (route.type !== "home") {
                go("/");
                setTimeout(
                  () =>
                    document
                      .getElementById("discover")
                      ?.scrollIntoView({ behavior: "smooth" }),
                  100,
                );
              } else
                document
                  .getElementById("discover")
                  .scrollIntoView({ behavior: "smooth" });
            }}
          >
            认识你的反差
          </a>
          <button onClick={() => setModal("about")}>关于测评</button>
        </nav>
        <button
          className="account-button"
          onClick={() => (session ? setModal("history") : unlock())}
        >
          {session ? <History size={16} /> : <LockKeyhole size={16} />}
          <span>
            {session ? `我的测评 · 余${session.remaining}次` : "测评密码"}
          </span>
          <ArrowUpRight size={14} />
        </button>
      </header>
      {route.type === "home" && (
        <Home
          session={session}
          onUnlock={unlock}
          onStart={start}
          onHistory={() => setModal("history")}
          onAbout={() => setModal("about")}
        />
      )}
      {route.type === "ready" && (
        <Ready
          session={session}
          onStart={start}
          onUnlock={unlock}
          busy={startBusy}
          error={startError}
        />
      )}
      {route.type === "quiz" &&
        (!boot ? (
          <Loading text="正在恢复你的进度…" />
        ) : session?.active ? (
          <Quiz
            key={`${session.active.id}:${epoch}`}
            initial={session.active}
            onComplete={(data) => {
              setSession(data.session);
              go(`/result/${data.resultId}`);
            }}
            onReload={reload}
            onHome={() => go("/")}
            onReauth={unlock}
          />
        ) : (
          <main className="empty-state shell">
            <h1>从一个真实的自己开始。</h1>
            <p>
              {session
                ? "当前没有未完成的测评，可以开启新测评或查看历史报告。"
                : "请先验证密码，已保存的进度会跟随密码恢复。"}
            </p>
            <button
              className="button primary"
              onClick={() => (session ? go("/ready") : unlock())}
            >
              {session ? "准备开始" : "输入测评密码"}
            </button>
          </main>
        ))}
      {route.type === "result" && (
        <ResultPage
          key={route.id}
          id={route.id}
          config={config}
          session={session}
          onRetest={retest}
          onReward={() => setModal("reward")}
          onToast={notify}
        />
      )}
      <footer className="site-footer shell">
        <div>
          <Brand />
          <p>世界有很多答案，先好奇一下自己。</p>
        </div>
        <div>
          <button onClick={() => setModal("about")}>
            理论与计分说明
            <ArrowUpRight size={14} />
          </button>
          <p>
            © 2026 {config.brand} · 原创情境自评初版
            <br />
            供娱乐与自我观察参考，尚待本土信效度验证
          </p>
        </div>
      </footer>
      {modal === "password" && (
        <Modal title="输入测评密码" onClose={() => setModal(null)}>
          <div className="modal-symbol">
            <LockKeyhole size={23} />
          </div>
          <p className="eyebrow">A KEY TO YOUR OTHER SIDE</p>
          <h2>
            有些面貌，
            <br />
            值得慢慢被看见。
          </h2>
          <p>
            输入购买后收到的测评密码，
            <br />
            为自己留一段安静探索的时间。
          </p>
          <form onSubmit={login}>
            <label className="field-label" htmlFor="access-code">
              测评密码
            </label>
            <div className="password-field">
              <input
                id="access-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                type={showCode ? "text" : "password"}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck="false"
                placeholder="请输入你的测评密码"
                maxLength={80}
                required
                autoFocus
              />
              <button
                type="button"
                className="icon-button"
                aria-label={showCode ? "隐藏密码" : "显示密码"}
                onClick={() => setShowCode((v) => !v)}
              >
                {showCode ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <ErrorLine>{loginError}</ErrorLine>
            <button
              className="button primary full-width"
              type="submit"
              disabled={loginBusy || !code.trim()}
            >
              {loginBusy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <>
                  验证并进入
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
          <div className="password-notes">
            <span>
              <Check size={14} />
              每个密码可测3次
            </span>
            <span>
              <Check size={14} />
              验证不扣次数
            </span>
          </div>
          <p className="small-note">
            没有收到密码或遇到问题？{config.supportContact}
          </p>
        </Modal>
      )}
      {modal === "about" && (
        <Modal title="关于反差人格测评" wide onClose={() => setModal(null)}>
          <p className="eyebrow">CURIOUS, AND CONSIDERED</p>
          <h2>有依据，也有分寸。</h2>
          <p>
            这是为中国日常情境编写的原创自评工具。主标题中的“反差人格”是趣味表达，测量的是自述行为在两类情境中的变化。
          </p>
          <Intro compact />
          <h3>48题，如何组成？</h3>
          <p>
            40道情境题组成20组配对，观察表达主动度、情绪可见度、主张直接度和玩心释放度。另8题分别观察对他人反馈的关注和切换后的主观耗能。
          </p>
          <h3>分数和16种称号，如何形成？</h3>
          <p>
            每个维度至少有3组有效配对才计算差异。反差幅度为四维双情境平均差的绝对值的均值，按0–100展示。16种称号按预设中点组合命名，用来方便记忆；它们不是经过研究确立的人格分类。
          </p>
          <h3>科学依据与目前的边界</h3>
          <p>
            情境人格研究（Mischel & Shoda, 1995；Fleeson,
            2001）、自我监控研究（Snyder, 1974）与情绪表达研究（Gross & John,
            2003）为设计提供启发。题目为原创，尚未完成本土样本的结构、信度和效度验证，不能宣称临床有效或判断“真实人格”。
          </p>
          <div className="reference-list">
            {[
              ["情境与人格", "https://doi.org/10.1037/0033-295X.102.2.246"],
              [
                "日常人格状态的变动",
                "https://doi.org/10.1037/0022-3514.80.6.1011",
              ],
              ["自我监控研究", "https://doi.org/10.1037/h0037039"],
              ["情绪调节与表达", "https://doi.org/10.1037/0022-3514.85.2.348"],
              [
                "量表开发与验证方法",
                "https://doi.org/10.3389/fpubh.2018.00149",
              ],
            ].map(([text, url]) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                {text}
                <ArrowUpRight size={14} />
              </a>
            ))}
          </div>
          <h3>次数、进度与分享</h3>
          <p>
            每个密码共3次，点击开始新测评才扣次。未完成可继续，已完成的报告保留。报告链接可公开阅读，并会展示报告摘录的部分回答；分享前请确认愿意让对方看见这些内容。
          </p>
          <p className="small-note">
            本工具面向成年用户的日常自我观察。无需姓名和手机号，不用于诊断、招聘或他人评判。
          </p>
        </Modal>
      )}
      {modal === "history" && (
        <Modal title="我的测评" onClose={() => setModal(null)}>
          <p className="eyebrow">YOUR FIELD NOTES</p>
          <h2>每一面，都有记录。</h2>
          <div className="history-quota">
            <b>{session?.remaining ?? 0}</b>
            <span>
              / 3 次可用
              <br />
              已完成的档案仍可查看和保存
            </span>
          </div>
          {session?.active && (
            <button
              className="history-card active-history"
              onClick={() => {
                setModal(null);
                go("/quiz");
              }}
            >
              <CloudCheck size={20} />
              <span>
                <b>继续未完成的探索</b>
                <small>
                  已选 {session.active.answers.filter((a) => a !== -1).length}
                  /48 题 · 不重复扣次
                </small>
              </span>
              <ChevronRight size={17} />
            </button>
          )}
          {session?.results?.map((r) => (
            <button
              className="history-card"
              key={r.id}
              onClick={() => {
                setModal(null);
                go(`/result/${r.id}`);
              }}
            >
              <BookOpen size={20} />
              <span>
                <b>{r.name}</b>
                <small>{dateText(r.createdAt)}</small>
              </span>
              <ChevronRight size={17} />
            </button>
          ))}
          {!session?.results?.length && !session?.active && (
            <p>你的探索档案，还等着第一笔。</p>
          )}
          <div className="modal-actions">
            <button
              className="button primary full-width"
              onClick={() => {
                setModal(null);
                go("/ready");
              }}
            >
              开始或继续测评
              <ArrowRight size={17} />
            </button>
            <button
              className="text-button"
              onClick={async () => {
                await api("/session", { method: "DELETE" }).catch(() => {});
                setToken("");
                setSession(null);
                setModal(null);
                go("/");
              }}
            >
              <LogOut size={15} />
              退出当前密码
            </button>
          </div>
        </Modal>
      )}
      {modal === "reward" && (
        <Modal title="好评有礼" onClose={() => setModal(null)}>
          <div className="modal-symbol reward-symbol">
            <Gift size={25} />
          </div>
          <p className="eyebrow">A LITTLE THANK YOU</p>
          <h2>
            谢谢你的喜欢，
            <br />
            送你一份小心意。
          </h2>
          <div className="reward-amount">
            <span>¥</span>1<small>好评返现</small>
          </div>
          <p>{config.rewardMessage}</p>
          <div className="reward-steps">
            <span>01 · 店铺好评</span>
            <ChevronRight size={14} />
            <span>02 · 截图发客服</span>
            <ChevronRight size={14} />
            <span>03 · 领取返现</span>
          </div>
          <div className="note-box">
            <b>{config.storeName}</b>
            <p>{config.supportContact}</p>
            {config.supportWeChat && (
              <button
                className="text-button"
                onClick={async () =>
                  notify(
                    (await copyText(config.supportWeChat))
                      ? "客服微信已复制。"
                      : "请手动复制客服微信。",
                  )
                }
              >
                {config.supportWeChat}
                <Copy size={15} />
              </button>
            )}
          </div>
          <button
            className="button primary full-width"
            onClick={() => setModal(null)}
          >
            知道啦，谢谢你
            <Check size={17} />
          </button>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}
