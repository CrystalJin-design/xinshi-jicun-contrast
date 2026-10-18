import { catalog, getTest } from "./catalog.js";
import {
  questions,
  publicQuestions,
  facets,
  references,
  VERSION,
  frequency,
} from "./contrast.js";
import { outerStyles, innerStyles, profileNames } from "./contrast-profiles.js";
export function validateAnswers(id, answers, complete = false) {
  return (
    id === "contrast" &&
    Array.isArray(answers) &&
    answers.length === questions.length &&
    answers.every(
      (a) =>
        Number.isInteger(a) &&
        ((a >= 0 && a <= 4) || a === -2 || (!complete && a === -1)),
    )
  );
}
export const library = () => catalog;
export const quiz = (id) =>
  getTest(id)
    ? { ...getTest(id), version: VERSION, questions: publicQuestions() }
    : null;
const itemValue = (q, answer) => (q.reverse ? 4 - answer : answer);
const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
export function scoreAnswers(id, answers) {
  if (!validateAnswers(id, answers, true)) throw new Error("INVALID_ANSWERS");
  const data = questions.map((q, i) => ({
    ...q,
    answer: answers[i],
    value: answers[i] === -2 ? null : itemValue(q, answers[i]),
  }));
  const dimensions = facets.map((f) => {
    const pairs = data
      .filter((q) => q.facet === f.key && q.context === "public")
      .map((a) => ({
        a,
        b: data.find((b) => b.context === "familiar" && b.pair === a.pair),
      }))
      .filter(({ a, b }) => a.value !== null && b.value !== null);
    const valid = pairs.length >= 3;
    return {
      ...f,
      publicValue: valid
        ? Math.round(mean(pairs.map((p) => p.a.value)) * 25)
        : null,
      familiarValue: valid
        ? Math.round(mean(pairs.map((p) => p.b.value)) * 25)
        : null,
      delta: valid
        ? Math.round(mean(pairs.map((p) => p.b.value - p.a.value)) * 25)
        : null,
      pairedCount: pairs.length,
      valid,
    };
  });
  const supplement = (key) => {
    const items = data.filter((q) => q.facet === key && q.value !== null);
    return {
      value:
        items.length >= 3
          ? Math.round(mean(items.map((q) => q.value)) * 25)
          : null,
      count: items.length,
    };
  };
  const cue = supplement("cue"),
    cost = supplement("cost");
  const sufficient = dimensions.every((d) => d.valid);
  const contrast = sufficient
    ? Math.round(mean(dimensions.map((d) => Math.abs(d.delta))))
    : null;
  const [voice, emo, assertion, play] = dimensions;
  const outerBoundary =
    sufficient &&
    [voice.publicValue, assertion.publicValue].some(
      (v) => Math.abs(v - 50) <= 5,
    );
  const innerBoundary =
    sufficient &&
    [emo.familiarValue, play.familiarValue].some((v) => Math.abs(v - 50) <= 5);
  const hasBoundary = outerBoundary || innerBoundary;
  const outerId = sufficient
    ? Number(voice.publicValue >= 50) + 2 * Number(assertion.publicValue >= 50)
    : null;
  const innerId = sufficient
    ? Number(emo.familiarValue >= 50) + 2 * Number(play.familiarValue >= 50)
    : null;
  const outer = sufficient
    ? outerBoundary
      ? {
          name: "初见风格过渡区",
          symbol: "moon",
          text: "公开情境的表达主动度或主张直接度接近量尺中点，本次暂不把它固定成某一种初见风格。你可能会依具体场合选择何时开口、何时保留。",
          strength:
            "你如实报告了中间频率，不必为了一个鲜明称号把自己选得更极端。",
          watch:
            "接近分界时，类型名称容易随小幅回答变化。连续维度比类型更值得参考。",
          action:
            "观察下一次互动中，是什么因素让你选择主动或保留，把具体情境写下来。",
        }
      : outerStyles[outerId]
    : null;
  const inner = sufficient
    ? innerBoundary
      ? {
          name: "熟人风格过渡区",
          symbol: "sun",
          text: "熟人情境的情绪可见度或玩心释放度接近量尺中点。本次保留相邻风格的可能，暂不赋予强烈的熟人标签。",
          need: "具体时刻的意愿被尊重，可以热闹，也可以安静。",
          action:
            "向熟人讲一个具体时刻：“这种时候，我更愿意……”不必用单一标签解释自己。",
        }
      : innerStyles[innerId]
    : null;
  const ranked = dimensions
    .filter((d) => d.valid)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const largest = ranked[0];
  const band =
    contrast === null
      ? "信息待补充"
      : contrast < 20
        ? "相处同频"
        : contrast < 40
          ? "渐进解锁"
          : "熟人限定";
  const changedSide = {
    voice: "主动接话的一面",
    emotion: "表露感受的一面",
    assertion: "表达主张的一面",
    play: "爱玩的一面",
  };
  const tagline =
    contrast === null
      ? "这一次，先给尚未经历的场景留一点白。"
      : contrast < 20
        ? "你的主要表现，在两类情境里保持着相近的节奏。"
        : largest.delta > 0
          ? `熟悉之后，你${changedSide[largest.key]}更容易被看见。`
          : `在公开互动里，你${changedSide[largest.key]}反而更活跃。`;
  const explanation = !sufficient
    ? "至少一个维度少于3组有效配对。没有经历过的场景不应被当作低频或中间分，因此本次不生成反差分和16型标签。你可以按真实经历补充回答，也可以把这份留白作为之后的观察线索。"
    : `本次反差幅度为${contrast}/100，是四个维度的双情境平均差异幅度。它只描述本次自我报告，不是准确率、人群排名或人格健康分。${contrast < 20 ? "变化较小不表示你没有层次，也可能是你在这两类关系中较一致。" : "情境不同、表达不同很常见；变化本身不等于虚伪，也不自动说明哪一面更真实。"}`;
  const costText =
    cost.value === null
      ? "关于切换耗能的经历不足，暂不推断你的恢复需要。"
      : cost.value >= 65
        ? contrast !== null && contrast < 20
          ? "你的行为变化幅度较小，但自述耗能较明显。别人看见的“表现一直很稳”，未必意味着过程对你轻松。可以留意维持分寸、持续关注他人或活动本身带来的负担。"
          : "你自述切换后的耗能较明显。它提示你值得安排恢复空间，但不能仅凭这些题判断耗能原因或心理健康。"
        : "你自述切换后的耗能没有特别突出。先保留这种适合自己的节奏；低分也不意味着你任何时候都不需要休息。";
  const cueText =
    cue.value === null
      ? "关于反馈线索的经历不足，暂不解释你对他人反应的关注程度。"
      : cue.value >= 65
        ? "你较常留意他人反馈并调整表达。这可能帮助你配合场合；是否值得持续这样做，要结合自己的需要和实际代价。"
        : "你不总是根据他人的即时反应调整表达。这可能让风格较稳定，也值得观察对方是否需要更清楚的解释。";
  const evidence = ranked.slice(0, 2).map((d) => {
    const list = data
      .filter((q) => q.facet === d.key && q.context === "public")
      .map((a) => ({
        a,
        b: data.find((b) => b.context === "familiar" && b.pair === a.pair),
      }))
      .filter((p) => p.a.value !== null && p.b.value !== null)
      .sort(
        (a, b) =>
          Math.abs(b.b.value - b.a.value) - Math.abs(a.b.value - a.a.value),
      );
    const pair = list[0];
    return {
      facet: d.name,
      situation: pair.a.situation,
      publicText: pair.a.prompt,
      familiarText: pair.b.prompt,
      publicAnswer: frequency[pair.a.answer],
      familiarAnswer: frequency[pair.b.answer],
    };
  });
  return {
    version: VERSION,
    test: getTest(id),
    sufficient,
    contrast,
    band,
    tagline,
    profile: {
      name: sufficient
        ? hasBoundary
          ? "中间光谱 · 多面过渡者"
          : profileNames[outerId][innerId]
        : "留白观察者",
      outerId,
      innerId,
      outer,
      inner,
      tags: [band, "情境画像", "双面都成立"],
    },
    dimensions,
    cue: { ...cue, text: cueText },
    cost: { ...cost, text: costText },
    explanation,
    evidence,
    missing: data.filter((q) => q.answer === -2).length,
    boundary: hasBoundary
      ? "有命名维度处于45–55分的中点附近，轻微改选可能切换相邻风格，本次显示过渡画像。这个保留区同样是初版设计规则，尚未经本土样本校准。"
      : null,
    actions: sufficient
      ? [
          outer.action,
          inner.action,
          cost.value !== null && cost.value >= 65
            ? "给下一次需要照顾分寸的活动预留15分钟空白。暂不安排聊天或任务，观察怎样的休息真正有效。"
            : "一周内记录一次让你自在的互动：和谁、在做什么、你有哪些表现。用真实片刻检验报告是否贴近你。",
        ]
      : [
          "只有真正遇到过的情境才值得回答，无需为了出分补选。",
          "接下来一周观察一次不太熟的互动和一次放心的熟人互动。",
          "有更多经历后，再看看四个维度是否发生变化。",
        ],
    learning: [
      {
        title: "情境会参与塑造表达",
        body: "研究者用“如果在某种情境，就可能出现某种表现”描述行为模式。理解一个人，也包括理解他何时更放松、何时更保留。",
        source: 0,
      },
      {
        title: "看不见，不等于没感受",
        body: "情绪体验与情绪表露是两件事。一个人笑得少、讲感受少，不能据此断定他冷漠、感受浅或不在意。",
        source: 3,
      },
      {
        title: "灵活程度与耗能分开看",
        body: "调整表达可能很自然，也可能需要努力。本报告分别询问变化幅度与主观耗能，不根据其中一项推断另一项。",
        source: 1,
      },
    ],
    references,
    note: "原创情境自评初版 · 理论启发，尚未完成本土样本信效度验证。结果用于娱乐与自我观察，不作心理诊断。",
    method:
      "40道双情境题组成20组配对，另8题补充观察。每维度至少3组有效配对才计算差异；缺失不填中间分。16型按预先公开的分界命名，不是研究证实的人格分类。",
  };
}
