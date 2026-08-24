import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProductBlendPrompt,
  isValidProductBox,
  persistentProductBlendReferences,
  prepareProductBlendInput,
  productBlendContactGeometry,
  productBlendGuideGeometry,
} from "./product-blend.ts";

test("product selection needs at least one percent on both axes", () => {
  assert.equal(isValidProductBox({ x: 0.1, y: 0.1, width: 0.01, height: 0.4 }), true);
  assert.equal(isValidProductBox({ x: 0.1, y: 0.1, width: 0.009, height: 0.4 }), false);
});

test("realistic lighting prompt preserves product identity", () => {
  const prompt = buildProductBlendPrompt("realistic-lighting", "加强左侧暖光", { hasGuide: true });
  assert.match(prompt, /严格保持产品轮廓、比例、结构、颜色、Logo、包装文字与图案/);
  assert.match(prompt, /定位图.*不得出现在结果中/);
  assert.match(prompt, /接触融合区域/);
  assert.match(prompt, /接触暗部/);
  assert.match(prompt, /投影方向.*主光方向一致/);
  assert.match(prompt, /承载面材质.*反射/);
  assert.match(prompt, /允许改动.*接触阴影、投影和反射/);
  assert.match(prompt, /禁止出现与环境主光方向矛盾的高光/);
  assert.match(prompt, /加强左侧暖光/);
});

test("visual priority prompt permits controlled advertising polish", () => {
  const prompt = buildProductBlendPrompt("visual-priority", "", { hasGuide: true });
  assert.match(prompt, /允许加强轮廓光、高光、反射、材质表现/);
  assert.match(prompt, /不增加、删除、替换或复制产品/);
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

test("product blend input keeps source before its transient guide", () => {
  const prepared = prepareProductBlendInput({
    sourceImage: { name: "商品.png", data: "data:image/png;base64,source" },
    productBox: { x: 0.1, y: 0.2, width: 0.5, height: 0.4 },
    blendStyle: "realistic-lighting",
    additionalPrompt: "加强左侧暖光",
  }, "data:image/png;base64,guide");
  assert.equal(prepared.references[0].name, "商品.png");
  assert.deepEqual(prepared.references[1], {
    name: "产品定位图.png",
    data: "data:image/png;base64,guide",
    transient: true,
  });
  assert.match(prepared.prompt, /加强左侧暖光/);
});
