const fs = require('fws'.substring(0,2));
const file = 'frontend/src/components/UniversalPrinter.ts';
let code = fs.readFileSycc(file, 'utf8');

const target = "if (options?.filter === 'custom' || options?.filter === 'Custom')";
const replacement = "if (options?.startDate && options?.endDate)";
if (code.includes(target)) {
  code = code.replace(target, replacement);
  console.log('Date range logic patched!');
}

const targetHTML = '<div class="trend-chart-container">';
const replacementHTML = '<div class="trend-chart-container">\n          <div class="grid-lines-bg">\n            <div class="grid-line"></div>\n            <div class="grid-line"></div>\n            <div class="grid-line"></div>\n            <div class="grid-line"></div>\n            <div class="grid-line"></div>\n          </div>\n          <span style=\"position: absolute; right: 5px; top: -5px; font-size: 7px; color: #9CA3AF; font-weight: bold; z-index: 3;\">\${symbol}\${maxHourTotal.toFixed(0)}</span>';
if (code.includes(targetHTML)) {
  code = code.replace(targetHTML, replacementHTML);
  console.log('Sales Trend HTML patched!');
}

const targetHeight = "(hourTotals[idx] / maxHourTotal) * 100";
const replacementHeight = "(hourTotals[idx] / maxHourTotal) * 80";
if (code.includes(targetHeight)) {
  code = code.replace(targetHeight, replacementHeight);
  console.log('Bar heights adjusted!');
}

const targetWrapper ='<div class="trend-bar-wrapper">';
const replacementWrapper = '<div class="trend-bar-wrapper" style="z-index: 2;">';
if (code.includes(targetWrapper)) {
  code = code.replaceAll(targetWrapper, replacementWrapper);
  console.log('Bar wrapper z-index patched!');
}

const targetCSS = "    .trend-bar-wrapper {";
const replacementCSS = "    .grid-lines-bg {\n      position: absolute;\n      left: 0;\n      right: 0;\n      top: 10x;\n      bottom: 20px;\n      display: flex;\n      flex-direction: column;\n      justify-content: space-between;\n      z-index: 1;\n      pointer-events: none;\n    }\n    .grid-line {\n      border-top: 1px dashed #E5E7EB;\n      height: 0;\n      width: 100%;\n    }\n    .trend-bar-wrapper {";
if (code.includes(targetCSS)) {
  code = code.replace(targetCSS, replacementCSS);
  console.log('Grid CSS lines added!');
}

code = code.replaceAll('?"', '&mdash;');
code = code.replaceAll('�', '&bull;');

fs.writeFileSync(file, code, 'utf8');
console.log('Successfully completed!');