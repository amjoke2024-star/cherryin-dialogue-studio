import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProductBlendPrompt,
  isValidProductBox,
  persistentProductBlendReferences,
  prepareProductBlendInput,
  productBlendContactGeometry,
  productBlendGuideGeometry,
  productBlendMaskRegions,
} from "./product-blend.ts";

test("product selection needs at least one percent on both axes", () => {
  assert.equal(isValidProductBox({ x: 0.1, y: 0.1, width: 0.01, height: 0.4 }), true);
  assert.equal(isValidProductBox({ x: 0.1, y: 0.1, width: 0.009, height: 0.4 }), false);
});

test("unified product blend prompt preserves identity while allowing visible ambient relighting", () => {
  const prompt = buildProductBlendPrompt("加强左侧暖光", { hasMask: true });
  assert.match(prompt, /保持产品身份、轮廓、比例、结构、材质属性、Logo、包装文字与图案/);
  assert.doesNotMatch(prompt, /固有色识别|第2张图|定位图/);
  assert.match(prompt, /白色、黑色和金属表面.*可见的.*环境色/);
  assert.match(prompt, /受光变化不是重新着色/);
  assert.match(prompt, /原产品图中的高光、阴影、明暗分布和白平衡不属于保护内容/);
  assert.match(prompt, /必须替换原有产品光影/);
  assert.match(prompt, /亮暗面、高光位置、环境色和反弹光产生真实变化/);
  assert.match(prompt, /编辑蒙版.*产品和接触区域/);
  assert.match(prompt, /首要任务.*整个产品表面.*亮面、暗面、高光、色温和环境染色/);
  assert.match(prompt, /必须让产品明显但自然地接受场景光，不能只增加地面阴影/);
  assert.match(prompt, /根据场景光源和承载面.*接触阴影、投影和必要反射/);
  assert.match(prompt, /消除.*视觉接缝/);
  assert.match(prompt, /提升整体环境融合度/);
  assert.match(prompt, /不要改变.*风格/);
  assert.ok(prompt.indexOf("首要任务") < prompt.indexOf("接触阴影"));
  assert.ok(prompt.split("\n").length <= 9);
  assert.match(prompt, /加强左侧暖光/);
});

test("edit mask exposes the product and contact regions", () => {
  assert.deepEqual(
    productBlendMaskRegions({ x: 0.2, y: 0.2, width: 0.4, height: 0.5 }, 1000, 1000),
    [
      { role: "contact", x: 100, y: 640, width: 600, height: 285 },
      { role: "product", x: 200, y: 200, width: 400, height: 500 },
    ],
  );
});

test("mask references are not persisted", () => {
  assert.deepEqual(persistentProductBlendReferences([
    { name: "原图.png", transient: false },
    { name: "产品编辑蒙版.png", transient: true, role: "mask" as const },
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
  }, "data:image/png;base64,mask");
  assert.equal(prepared.references[0].name, "商品.png");
  assert.deepEqual(prepared.references[1], {
    name: "产品编辑蒙版.png",
    data: "data:image/png;base64,mask",
    transient: true,
    role: "mask",
  });
  assert.match(prepared.prompt, /加强左侧暖光/);
  assert.doesNotMatch(prepared.prompt, /视觉优先|允许加强广告氛围/);
  assert.match(prepared.prompt, /保持产品身份、轮廓、比例、结构、材质属性、Logo、包装文字与图案/);
});
