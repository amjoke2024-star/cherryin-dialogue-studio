import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(
  new URL("../app/model-grid.css", import.meta.url),
  "utf8",
);

test("model cards keep three columns while long names wrap to two lines", () => {
  assert.match(
    css,
    /\.model-vendor-models\s*{[^}]*grid-template-columns:\s*repeat\(3,/s,
  );
  assert.match(
    css,
    /\.model-popover \.model-option strong\s*{[^}]*display:\s*-webkit-box;[^}]*-webkit-line-clamp:\s*2;[^}]*white-space:\s*normal;/s,
  );
  assert.match(
    css,
    /\.model-popover \.model-option\s*{[^}]*height:\s*66px;/s,
  );
});
