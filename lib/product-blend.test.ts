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

test("unified product blend prompt requires visible relighting on the product itself", () => {
  const prompt = buildProductBlendPrompt("加强左侧暖光", { hasGuide: true });
  assert.match(prompt, /保持产品身份、轮廓、比例、结构、材质属性、Logo、包装文字与图案/);
  assert.doesNotMatch(prompt, /固有色识别|编辑蒙版/);
  assert.match(prompt, /第2张图.*定位/);
  assert.match(prompt, /暗面和底部.*环境色与承载面反弹光/);
  assert.match(prompt, /白色、黑色和金属表面.*高光与反射/);
  assert.match(prompt, /受光变化不是重新着色/);
  assert.match(prompt, /原产品图中的高光、阴影、明暗分布和白平衡不属于保护内容/);
  assert.match(prompt, /校正.*产品表面.*亮面、暗面、高光、色温和环境染色/);
  assert.match(prompt, /仅增加地面阴影.*失败/);
  assert.match(prompt, /首要任务.*整个产品表面.*亮面、暗面、高光、色温和环境染色/);
  assert.match(prompt, /环境光影响必须清晰可见且自然/);
  assert.match(prompt, /先判断背景属于方向光还是漫射光/);
  assert.match(prompt, /主光明确时.*符合产品曲面和光向的连续明暗与冷暖变化/);
  assert.match(prompt, /漫射场景.*不虚构强方向光/);
  assert.match(prompt, /不得仅通过整体压暗或提亮产品来表现融合/);
  assert.match(prompt, /受光面.*场景主光色/);
  assert.match(prompt, /暗面和底部.*环境色与承载面反弹光/);
  assert.match(prompt, /环境色只作用于合理的暗面、背光边缘和反射面/);
  assert.match(prompt, /不得给整个产品统一染色/);
  assert.match(prompt, /受光面.*保持产品原有的中性基色和材质通透感/);
  assert.match(prompt, /主光明确时，投影方向必须与主光方向一致/);
  assert.match(prompt, /漫射光下只生成紧凑的接触阴影、环境遮蔽和轻微地面反射/);
  assert.match(prompt, /接触处最深.*向外自然变软变淡/);
  assert.match(prompt, /随承载面的高度、凹凸和遮挡关系变形/);
  assert.match(prompt, /不得形成均匀黑边或悬浮感/);
  assert.match(prompt, /消除.*视觉接缝/);
  assert.match(prompt, /提升整体环境融合度/);
  assert.match(prompt, /不要改变.*风格/);
  assert.ok(prompt.indexOf("首要任务") < prompt.indexOf("接触阴影"));
  assert.ok(prompt.split("\n").length <= 9);
  assert.match(prompt, /加强左侧暖光/);
});

test("product blend keeps environmental relighting clean and continuous", () => {
  const prompt = buildProductBlendPrompt("", { hasGuide: true });
  assert.match(prompt, /清晰可见且自然/);
  assert.match(prompt, /先判断背景属于方向光还是漫射光/);
  assert.match(prompt, /不得形成污渍、云斑、块状染色、颗粒、噪点或不规则涂抹/);
  assert.match(prompt, /保持背景原有的平滑渐变与干净表面，不增加任何纹理/);
  assert.match(prompt, /白色、黑色和金属表面.*高光与反射.*服从场景光源/);
  assert.doesNotMatch(prompt, /必须让产品明显但自然地接受场景光/);
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
  assert.match(prepared.prompt, /保持产品身份、轮廓、比例、结构、材质属性、Logo、包装文字与图案/);
});
