/* 
从 TypeScript 的库目录中复制 .d.ts 类型声明文件到项目的 libs 目录。
排除特定的文件（如 lib.dom.d.ts）。
确保目标目录中不存在重复文件或不需要的文件。
*/

import fs from 'fs';
import path from 'path';

// 定义 copyESLibs 函数，用于复制 ES 库文件
function copyESLibs(): void {
  const targetLibPath: string = path.resolve(__dirname, '..', 'libs');
  if (!fs.existsSync(targetLibPath)) {
    fs.mkdirSync(targetLibPath);
  }
  
  const esLibPath: string = path.resolve(__dirname, '../node_modules/typescript/lib');
  const libFiles: string[] = fs.readdirSync(esLibPath);
  const excludeFiles: string[] = ['lib.dom.d.ts'];
  
  libFiles.forEach((file: string) => {
    const srcFilePath: string = path.resolve(esLibPath, file);
    if (fs.statSync(srcFilePath).isDirectory()) {
      return;
    }
    const targetFile: string = path.resolve(targetLibPath, file);
    if (fs.existsSync(targetFile)) {
      return;
    }
    
    if (file.endsWith('.d.ts') && file.startsWith('lib.') && !excludeFiles.includes(file)) {
      fs.copyFileSync(srcFilePath, targetFile);
    }
  });
  
  excludeFiles.forEach((excludeFile: string) => {
    const targetFile: string = path.resolve(targetLibPath, excludeFile);
    if (fs.existsSync(targetFile)) {
      fs.unlinkSync(targetFile);
    }
  });
}

copyESLibs();

export { copyESLibs };
