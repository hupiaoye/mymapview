// Bug2 实证验证（兼容入口）：委托给 test_gcd_attrib.mjs，保证整个 __verify__ 套件一致可用。
// 运行：node __verify__/verify_gcd.mjs
import { runGcdAttribTest } from './test_gcd_attrib.mjs';
runGcdAttribTest().then(ok => process.exit(ok ? 0 : 1));
