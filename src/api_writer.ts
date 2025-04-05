import { ReporterFormat } from './configs';
import { Logger } from './utils';
import exceljs from 'exceljs';
import fs from 'fs';
import path from 'path';
import { ApiDeclarationInformation } from './api_recognizer';

class ApiJsonWriter {
  outputPath: string;
  apiInfos: ApiDeclarationInformation[];
  noSerializeKeys: Set<string>;

  constructor(outputPath: string) {
    this.outputPath = outputPath;
    this.apiInfos = [];
    this.noSerializeKeys = new Set(['apiSourceFile', 'apiNode']);
  }

  add(apiInfos: ApiDeclarationInformation[]): void {
    this.apiInfos.push(...apiInfos);
  }

  flush(): void {
    const output = path.resolve(this.outputPath, 'collectedApi.json');
    fs.writeFileSync(output, JSON.stringify(this.apiInfos, (key, value) => {
      if (this.noSerializeKeys.has(key)) {
        return undefined;
      }
      return value;
    }));
    Logger.info('ApiJsonWriter', `report is in ${output}`);
  }
}

class ApiExcelWriter {
  outputDir: string;
  apiInfos: ApiDeclarationInformation[];
  enable: boolean;
  noRepeat: boolean;

  constructor(outputDir: string, noRepeat: boolean) {
    this.outputDir = outputDir;
    this.apiInfos = [];
    this.enable = true;
    this.noRepeat = noRepeat;
  }

  close(): void {
    this.enable = false;
  }

  open(): void {
    this.enable = true;
  }

  add(apiInfos: ApiDeclarationInformation[]): void {
    this.apiInfos.push(...apiInfos.filter((value) => {
      return !(value.packageName === 'ArkUI' && value.qualifiedTypeName === '');
    }));
  }

  async flush(): Promise<void> {
    if (!this.enable) {
      return;
    }
    await this.writeSubscribeApi();
    await this.writeAppApi();
  }

  async writeSubscribeApi(): Promise<void> {
    const apiInfoSet = new Set<string>();
    const subscribeWorkbook = new exceljs.Workbook();
    const subscribeSheet = subscribeWorkbook.addWorksheet('Js Api', { views: [{ xSplit: 1 }] });
    subscribeSheet.getRow(1).values = ['类名', '接口名', '接口类型', '方法声明', '接口全路径'];
    let lineNumber = 0;
    const STARTING_LINE_NUMBER = 2;
    this.apiInfos.forEach((apiInfo) => {
      let typeName = 'unnamed';
      if (apiInfo.typeName) {
        typeName = apiInfo.typeName;
      }
      if (apiInfo.qualifiedTypeName) {
        typeName = apiInfo.qualifiedTypeName;
      }

      const formattedInfo = formatInfo(apiInfo, typeName);
      if (!apiInfoSet.has(formattedInfo)) {
        subscribeSheet.getRow(lineNumber + STARTING_LINE_NUMBER).values = [
          typeName,
          apiInfo.propertyName,
          apiInfo.apiType,
          apiInfo.apiText.replace(/;$/g, ''),
          apiInfo.dtsPath
        ];
        lineNumber++;
        apiInfoSet.add(formattedInfo);
      }
    });
    const subscribeBuffer = await subscribeWorkbook.xlsx.writeBuffer();
    const subscribeOutputFile = path.resolve(this.outputDir, 'subscribe_api.xlsx');
    fs.writeFileSync(subscribeOutputFile, new Uint8Array(subscribeBuffer));
  }

  async writeAppApi(): Promise<void> {
    let lineNumber = 0;
    const apiInfoSet = new Set<string>();
    const workbook = new exceljs.Workbook();
    const sheet = workbook.addWorksheet('Js Api', { views: [{ xSplit: 1 }] });
    sheet.getRow(1).values = ['模块名', '类名', '方法名', '函数', '文件位置'];
    this.apiInfos.forEach((apiInfo) => {
      let typeName: string;
      if (apiInfo.componentName) {
        typeName = apiInfo.componentName;
      } else if (apiInfo.typeName) {
        typeName = apiInfo.typeName;
      } else {
        typeName = apiInfo.qualifiedTypeName;
      }
      const formattedInfo = formatInfo(apiInfo, typeName);
      if (this.noRepeat && !apiInfoSet.has(formattedInfo)) {
        this.createSheet(sheet, typeName, apiInfo, lineNumber);
        apiInfoSet.add(formattedInfo);
        lineNumber++;
      } else if (!this.noRepeat) {
        this.createSheet(sheet, typeName, apiInfo, this.apiInfos.indexOf(apiInfo));
      }
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const outputFile = path.resolve(this.outputDir, 'app_api.xlsx');
    fs.writeFileSync(outputFile, new Uint8Array(buffer));
    Logger.info('ApiExcelWriter', `report is in ${outputFile}`);
  }

  createSheet(sheet: exceljs.Worksheet, typeName: string, apiInfo: ApiDeclarationInformation, lineNumber: number): void {
    const STARTING_LINE_NUMBER = 2;
    sheet.getRow(lineNumber + STARTING_LINE_NUMBER).values = [
      path.basename(apiInfo.packageName, '.d.ts').replace('@', ''),
      typeName,
      apiInfo.propertyName,
      apiInfo.apiRawText,
      `${apiInfo.sourceFileName}(${apiInfo.pos})`
    ];
  }
}

class ApiWriter {
  outputPath: string;
  formatFlag: number;
  noRepeat: boolean;
  apiInfos: ApiDeclarationInformation[];

  constructor(outputPath: string, formatFlag: number, noRepeat: boolean) {
    this.outputPath = outputPath;
    this.formatFlag = formatFlag;
    this.noRepeat = noRepeat;
    this.apiInfos = [];
  }

  add(apiInfos: ApiDeclarationInformation[]): void {
    this.apiInfos.push(...apiInfos);
  }

  async flush(): Promise<void> {
    if (this.formatFlag === ReporterFormat.FLAG_JSON) {
      this.writeJson(this.apiInfos);
    } else if (this.formatFlag === ReporterFormat.FLAG_EXCEL) {
      await this.writeExcel(this.apiInfos);
    } else if (this.formatFlag === ReporterFormat.FLAG_DEBUG) {
      this.writeJson(this.apiInfos);
      await this.writeExcel(this.apiInfos);
    } else {
      this.writeJson(this.apiInfos);
    }
  }

  writeJson(apiInfos: ApiDeclarationInformation[]): void {
    const apiJsonWriter = new ApiJsonWriter(this.outputPath);
    apiJsonWriter.add(apiInfos);
    apiJsonWriter.flush();
  }

  async writeExcel(apiInfos: ApiDeclarationInformation[]): Promise<void> {
    const apiExcelWriter = new ApiExcelWriter(this.outputPath, this.noRepeat);
    apiExcelWriter.add(apiInfos);
    await apiExcelWriter.flush();
  }
}

function formatInfo(apiInfo: ApiDeclarationInformation, typeName: string): string {
  return `${typeName}_${apiInfo.propertyName}_${apiInfo.apiText}_ ${apiInfo.dtsPath}`;
}

export { ApiJsonWriter, ApiExcelWriter, ApiWriter };
