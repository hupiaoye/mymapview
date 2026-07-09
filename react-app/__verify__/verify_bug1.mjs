// Bug1 无头回归（兼容入口）：委托给 test_toggle.mjs，保证整个 __verify__ 套件一致可用。
// 运行：node __verify__/verify_bug1.mjs
import { runToggleTest } from './test_toggle.mjs';
process.exit(runToggleTest() ? 0 : 1);
