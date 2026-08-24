import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProductBlendPrompt,
  isValidProductBox,
  persistentProductBlendReferences,
  prepareProductBlendInput,
  productBlendContactGeometry,
  productBlendGuideGeometry,
  productBlendGuideLayers,
} from "./product-blend.ts";

test("product selection needs at least one percent on both axes", () => {
  assert.equal(isValidProductBox({ x: 0.1, y: 0.1, width: 0.01, height: 0.4 }), true);
  assert.equal(isValidProductBox({ x: 0.1, y: 0.1, width: 0.009, height: 0.4 }), false);
});

test("product blend prompt stays concise while preserving the blend goal", () => {
  const prompt = buildProductBlendPrompt("加强左侧暖光", { hasGuide: true });
  assert.equal(prompt, [
    "第1张图是唯一底图；第2张图仅用于定位产品与接触区域，其颜色不得进入结果。",
    "将产品自然融入场景，重塑光影和接触关系。产品表面自然反射周围环境色，色调、色温、明暗和景深与场景一致，并产生合理的反弹光、接触阴影及必要倒影，看起来原本就在这个环境中，避免贴图感。不改变产品外观，不改变背景。",
    "用户补充要求：加强左侧暖光",
  ].join("\n"));
});

test("product blend without a guide uses only the core instruction", () => {
  const prompt = buildProductBlendPrompt("");
  assert.equal(prompt.split("\n").length, 1);
  assert.doesNotMatch(prompt, /方向光|漫射光下|污渍|云斑|失败/);
});

test("location guide uses solid regions without copying source-image lighting", () => {
  assert.deepEqual(
    productBlendGuideLayers({ x: 0.2, y: 0.2, width: 0.4, height: 0.5 }, 1000, 1000),
    [
      { role: "background", x: 0, y: 0, width: 1000, height: 1000, color: "#050607" },
      { role: "contact", x: 100, y: 640, width: 600, height: 285, color: "#6b7280" },
      { role: "product", x: 200, y: 200, width: 400, height: 500, color: "#ffffff" },
    ],
  );
});

test("guide references are not persisted", () => {
  assert.deepEqual(persistentProductBlendReferences([
    { name: "原图.png", transient: false },
    { name: "产品定位图.png", transient: true },
  ]), [{ name: "原图.png", transient: false }]);
});

test("guide geometry converts normalized selection to pixels", () => {
  assert.deepEqual(
    productBlendGuideGeometry({ x: 0.1, y: 0.2, width: 0.5, height: 0.4 }, 1000, 500),
    { x: 100, y: 100, width: 500, height: 200 },
  );
});

test("contact blend area extends below and around the product while staying in canvas", () => {
  assert.deepEqual(
    productBlendContactGeometry({ x: 0.2, y: 0.2, width: 0.4, height: 0.5 }, 1000, 1000),
    { x: 100, y: 640, width: 600, height: 285 },
  );
  assert.deepEqual(
    productBlendContactGeometry({ x: 0.02, y: 0.55, width: 0.3, height: 0.4 }, 1000, 1000),
    { x: 0, y: 902, width: 395, height: 98 },
  );
});

test("product blend input uses one standard even for history carrying a legacy style", () => {
  const prepared = prepareProductBlendInput({
    sourceImage: { name: "商品.png", data: "data:image/png;base64,source" },
    productBox: { x: 0.1, y: 0.2, width: 0.5, height: 0.4 },
    blendStyle: "visual-priority",
    additionalPrompt: "加强左侧暖光",
  }, "data:image/png;base64,guide");
  assert.equal(prepared.references[0].name, "商品.png");
  assert.deepEqual(prepared.references[1], {
    name: "产品定位图.png",
    data: "data:image/png;base64,guide",
    transient: true,
  });
  assert.match(prepared.prompt, /加强左侧暖光/);
  assert.doesNotMatch(prepared.prompt, /视觉优先|允许加强广告氛围/);
  assert.match(prepared.prompt, /不改变产品外观，不改变背景/);
});
