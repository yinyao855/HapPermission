import { ReporterFormat } from './configs';
import { Logger } from './utils';
import exceljs from 'exceljs';
import fs from 'fs';
import path from 'path';
import { ApiDeclarationInformation } from './api_recognizer';
import {PermissionInfo} from "./api_analyzer";

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
  perInfos: PermissionInfo[];
  enable: boolean;
  noRepeat: boolean;

  constructor(outputDir: string, noRepeat: boolean) {
    this.outputDir = outputDir;
    this.apiInfos = [];
    this.perInfos = [];
    this.enable = true;
    this.noRepeat = noRepeat;
  }

  close(): void {
    this.enable = false;
  }

  open(): void {
    this.enable = true;
  }

  add(apiInfos: ApiDeclarationInformation[], perInfos: PermissionInfo[]): void {
    this.apiInfos.push(...apiInfos.filter((value) => {
      return !(value.packageName === 'ArkUI' && value.qualifiedTypeName === '');
    }));
    this.perInfos.push(...perInfos);
  }

  async flush(): Promise<void> {
    if (!this.enable) {
      return;
    }
    await this.writeReport();
  }

  async writeReport(): Promise<void> {
    let lineNumber = 0;
    const apiInfoSet = new Set<string>();
    const workbook = new exceljs.Workbook();
    const sheet1 = workbook.addWorksheet('Permission', { views: [{ xSplit: 1 }] });
    sheet1.getRow(1).values = ['权限名称', '类型', '使用次数'];
    this.perInfos.forEach((perInfo) => {
      sheet1.getRow(lineNumber + 2).values = [perInfo.name, perInfo.type, perInfo.usedCount];
      lineNumber++;
    })
    lineNumber = 0;
    const sheet = workbook.addWorksheet('API', { views: [{ xSplit: 1 }] });
    sheet.getRow(1).values = ['模块名', '类名', '方法名', '函数', '权限', '文件位置'];
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
    const outputFile = path.resolve(this.outputDir, 'haper_report.xlsx');
    fs.writeFileSync(outputFile, new Uint8Array(buffer));
    Logger.info('ApiExcelWriter', `save report is in ${outputFile}`);
  }

  createSheet(sheet: exceljs.Worksheet, typeName: string, apiInfo: ApiDeclarationInformation, lineNumber: number): void {
    const STARTING_LINE_NUMBER = 2;
    sheet.getRow(lineNumber + STARTING_LINE_NUMBER).values = [
      path.basename(apiInfo.packageName, '.d.ts').replace('@', ''),
      typeName,
      apiInfo.propertyName,
      apiInfo.apiRawText,
      apiInfo.apiPermission,
      `${apiInfo.sourceFileName}(${apiInfo.pos})`
    ];
  }
}

class ApiWriter {
  outputPath: string;
  formatFlag: number;
  noRepeat: boolean;
  apiInfos: ApiDeclarationInformation[];
  perInfos: PermissionInfo[];

  constructor(outputPath: string, formatFlag: number, noRepeat: boolean) {
    this.outputPath = outputPath;
    this.formatFlag = formatFlag;
    this.noRepeat = noRepeat;
    this.apiInfos = [];
    this.perInfos = [];
  }

  add(apiInfos: ApiDeclarationInformation[], perInfos: PermissionInfo[]): void {
    this.apiInfos.push(...apiInfos);
    this.perInfos.push(...perInfos);
  }

  async flush(): Promise<void> {
    if (this.formatFlag === ReporterFormat.FLAG_JSON) {
      this.writeJson(this.apiInfos);
    } else if (this.formatFlag === ReporterFormat.FLAG_EXCEL) {
      await this.writeExcel();
    } else if (this.formatFlag === ReporterFormat.FLAG_DEBUG) {
      this.writeJson(this.apiInfos);
      await this.writeExcel();
    } else {
      this.writeJson(this.apiInfos);
    }
  }

  writeJson(apiInfos: ApiDeclarationInformation[]): void {
    const apiJsonWriter = new ApiJsonWriter(this.outputPath);
    apiJsonWriter.add(apiInfos);
    apiJsonWriter.flush();
  }

  async writeExcel(): Promise<void> {
    const apiExcelWriter = new ApiExcelWriter(this.outputPath, this.noRepeat);
    apiExcelWriter.add(this.apiInfos, this.perInfos);
    await apiExcelWriter.flush();
  }
}

function formatInfo(apiInfo: ApiDeclarationInformation, typeName: string): string {
  return `${typeName}_${apiInfo.propertyName}_${apiInfo.apiText}_ ${apiInfo.dtsPath}`;
}

export { ApiJsonWriter, ApiExcelWriter, ApiWriter };
