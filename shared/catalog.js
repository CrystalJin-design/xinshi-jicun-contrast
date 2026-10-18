export { VERSION } from "./contrast.js";
export const catalog = [
  {
    id: "contrast",
    number: "01",
    category: "反差人格",
    title: "你的反差人格有多大？",
    shortTitle: "反差人格",
    english: "THE OTHER SIDE OF YOU",
    description: "初见限定版，和熟人解锁版。两个你，都值得被看见。",
    intro:
      "从微信接话到聚餐点菜，用48个生活片刻，看看你在不太熟的人面前、与放心的熟人相处时，会展现怎样的自己。",
    minutes: 10,
    count: 48,
    color: "#304e43",
    tint: "#e8eddf",
    art: "contrast",
    dimensions: ["表达主动度", "情绪可见度", "主张直接度", "玩心释放度"],
    profiles: 16,
  },
];
export const getTest = (id) => catalog.find((test) => test.id === id);
